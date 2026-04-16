#!/usr/bin/env python3
"""Generate daily Pulse of War briefing via Anthropic API.

Pipeline:
  1. Load prompts + compact context
  2. Call Claude Haiku 4.5 with strict JSON schema for English briefing
  3. Parse JSON, validate schema, run fact verification against data
  4. On fact verify fail → write nothing, exit non-zero
  5. On pass → call Claude to translate EN → KO (no system prompt needed)
  6. Write data/briefing.json with both languages

Env:
  ANTHROPIC_API_KEY (required)
  POW_MODEL      (optional, default: claude-haiku-4-5)
  POW_DRY_RUN    (optional; "1" = use canned response, skip API)
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import anthropic  # type: ignore
except ImportError:
    anthropic = None  # dry-run mode works without SDK

ROOT = Path(__file__).resolve().parent.parent
SYSTEM_PROMPT = ROOT / "prompts" / "system-prompt.md"
BRIEFING_PROMPT = ROOT / "prompts" / "briefing-prompt.md"
COMPACT = ROOT / "data" / "context-compact.json"
CONFLICTS = ROOT / "data" / "conflicts.json"
STOCKS = ROOT / "data" / "stocks.json"
OUT = ROOT / "data" / "briefing.json"

MODEL = os.environ.get("POW_MODEL", "claude-haiku-4-5")
MAX_TOKENS_BRIEFING = 2000
MAX_TOKENS_TRANSLATE = 2500
FACT_TOLERANCE = 0.5  # percentage points for numerical claims


def log(msg: str) -> None:
    print(f"[briefing] {msg}", file=sys.stderr)


def load_context() -> tuple[str, str, dict, dict, dict]:
    system = SYSTEM_PROMPT.read_text()
    briefing_rules = BRIEFING_PROMPT.read_text()
    compact = json.loads(COMPACT.read_text())
    conflicts = json.loads(CONFLICTS.read_text())
    stocks = json.loads(STOCKS.read_text())
    return system, briefing_rules, compact, conflicts, stocks


def call_claude_json(
    client: "anthropic.Anthropic",
    system_prompt: str,
    user_prompt: str,
    compact_data: dict,
    max_tokens: int,
) -> dict:
    """One Claude call → parse JSON from response. Uses prompt caching on system."""
    full_system = [
        {"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "<data>\n" + json.dumps(compact_data) + "\n</data>",
         "cache_control": {"type": "ephemeral"}},
    ]
    resp = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=full_system,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    text = text.strip()
    # Strip markdown fence if Claude wrapped JSON in ``` blocks despite instructions
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Claude returned non-JSON: {e}\n--RAW--\n{text[:500]}") from e


def translate_to_korean(client: "anthropic.Anthropic", briefing_en: dict) -> dict:
    """Translate the EN briefing's user-facing strings (headline + bullet text)
    to Korean. Preserve JSON structure and claim sources."""
    text_only = {
        "headline": briefing_en["headline"],
        "sections": [
            {"title": s["title"], "bullets": [b["text"] for b in s["bullets"]]}
            for s in briefing_en["sections"]
        ],
    }
    prompt = (
        "Translate the following war-briefing JSON to Korean. Keep the JSON "
        "structure identical. Translate ONLY the 'headline' and 'bullets' "
        "strings. Do not translate section 'title' values (keep them in "
        "English uppercase for visual parity). Return only JSON.\n\n"
        f"{json.dumps(text_only, ensure_ascii=False)}"
    )
    resp = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS_TRANSLATE,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    return json.loads(text)


# =============================================================================
# Fact verification
# =============================================================================

NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?(?:%|%p)?")
TICKER_RE = re.compile(r"\$([A-Z0-9.]{1,8})")


def resolve_source(path: str, conflicts: dict, stocks: dict) -> float | str | None:
    """Resolve 'stocks.json.LMT.ytdReturn' or 'conflicts.json.0.casualties'
    against raw data. Returns the value or None."""
    parts = path.split(".")
    if len(parts) < 3:
        return None
    root = parts[0] + "." + parts[1]  # 'stocks.json' or 'conflicts.json'
    rest = parts[2:]
    if root == "stocks.json":
        # Flatten stocks structure: sectors[].stocks[]
        target_ticker = rest[0]
        field = ".".join(rest[1:])
        for sec in stocks.get("sectors", []):
            for s in sec.get("stocks", []):
                if s.get("ticker") == target_ticker:
                    return walk(s, field)
        return None
    if root == "conflicts.json":
        try:
            idx = int(rest[0])
        except ValueError:
            # maybe named: conflicts.json.<slug>.field
            slug = rest[0]
            for c in conflicts:
                if slugify(c["name"]) == slug:
                    return walk(c, ".".join(rest[1:]))
            return None
        if 0 <= idx < len(conflicts):
            return walk(conflicts[idx], ".".join(rest[1:]))
    return None


def walk(obj: dict, dotted: str):
    cur = obj
    for p in dotted.split("."):
        if isinstance(cur, dict):
            cur = cur.get(p)
        elif isinstance(cur, list):
            try:
                cur = cur[int(p)]
            except (ValueError, IndexError):
                return None
        else:
            return None
        if cur is None:
            return None
    return cur


def slugify(name: str) -> str:
    import re as _re
    s = name.lower()
    s = _re.sub(r"\s+", "-", s)
    s = _re.sub(r"[^a-z0-9-]", "", s)
    s = _re.sub(r"-+", "-", s).strip("-")
    return s


def verify_numeric(claim_text: str, source_value, tolerance: float) -> tuple[bool, str]:
    """Extract claim number, compare to source value."""
    if source_value is None:
        return False, f"source resolved to None"
    # Coerce stringy "+24.4%" to float
    if isinstance(source_value, str):
        m = NUMBER_RE.search(source_value)
        if not m:
            return False, f"source value '{source_value}' has no number"
        source_num = float(m.group().rstrip("%").rstrip("%p"))
    elif isinstance(source_value, (int, float)):
        source_num = float(source_value)
    else:
        return False, f"source type {type(source_value).__name__} unusable"

    m = NUMBER_RE.search(claim_text)
    if not m:
        return False, f"claim '{claim_text}' has no extractable number"
    claim_num = float(m.group().rstrip("%").rstrip("%p"))

    if abs(claim_num - source_num) <= tolerance:
        return True, f"{claim_num} ≈ {source_num} (±{tolerance})"
    return False, f"{claim_num} vs source {source_num} exceeds ±{tolerance}"


def verify_briefing(briefing: dict, conflicts: dict, stocks: dict) -> list[str]:
    """Return list of error strings. Empty list = pass."""
    errors: list[str] = []
    for si, section in enumerate(briefing.get("sections", [])):
        for bi, bullet in enumerate(section.get("bullets", [])):
            text = bullet.get("text", "")
            claims = bullet.get("claims", [])
            # All numbers and $TICKERs in text must be covered by a claim
            nums_in_text = [m.group() for m in NUMBER_RE.finditer(text)
                             if not m.group().isdigit() or len(m.group()) > 3]
            tickers_in_text = set(TICKER_RE.findall(text))
            claim_texts = {c.get("text", "") for c in claims}
            # Basic check: every number appears in at least one claim
            uncovered_nums = [n for n in nums_in_text
                              if not any(n in ct for ct in claim_texts)]
            if uncovered_nums:
                errors.append(
                    f"section[{si}].bullets[{bi}]: numbers {uncovered_nums} "
                    f"in text not covered by any claim"
                )
            # Verify each numerical claim
            for ci, claim in enumerate(claims):
                ctype = claim.get("type")
                src = claim.get("source")
                ctext = claim.get("text", "")
                if not src:
                    errors.append(
                        f"section[{si}].bullets[{bi}].claims[{ci}]: "
                        f"missing source (claim='{ctext}')"
                    )
                    continue
                if ctype == "numerical":
                    val = resolve_source(src, conflicts, stocks)
                    ok, reason = verify_numeric(ctext, val, FACT_TOLERANCE)
                    if not ok:
                        errors.append(
                            f"section[{si}].bullets[{bi}].claims[{ci}] fail: "
                            f"{reason} (source={src})"
                        )
                elif ctype in ("comparative", "temporal"):
                    # We can't auto-verify these. Log for manual review.
                    log(
                        f"  [{ctype}] section[{si}].bullets[{bi}].claims[{ci}]: "
                        f"'{ctext[:80]}' (source={src}) — NOT auto-verified"
                    )
                else:
                    errors.append(
                        f"section[{si}].bullets[{bi}].claims[{ci}]: "
                        f"unknown claim type '{ctype}'"
                    )
    return errors


# =============================================================================
# Main
# =============================================================================

def main() -> int:
    if os.environ.get("POW_DRY_RUN") == "1":
        log("DRY RUN — writing canned briefing without API call")
        canned = canned_briefing()
        OUT.write_text(json.dumps(canned, ensure_ascii=False, indent=2) + "\n")
        log(f"Wrote {OUT}")
        return 0

    if anthropic is None:
        log("ERROR: anthropic SDK not installed. pip install anthropic")
        return 2

    if not os.environ.get("ANTHROPIC_API_KEY"):
        log("ERROR: ANTHROPIC_API_KEY not set")
        return 2

    system, briefing_rules, compact, conflicts, stocks = load_context()
    client = anthropic.Anthropic()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    user_prompt = (
        f"{briefing_rules}\n\n"
        f"Generate the briefing for {today}. Return ONLY the JSON object."
    )

    log(f"Generating EN briefing (model={MODEL})...")
    en = call_claude_json(client, system, user_prompt, compact, MAX_TOKENS_BRIEFING)
    en["date"] = today  # enforce correct date

    log("Verifying facts...")
    errors = verify_briefing(en, conflicts, stocks)
    if errors:
        log(f"FACT VERIFICATION FAILED ({len(errors)} errors):")
        for e in errors[:10]:
            log(f"  - {e}")
        log("Not publishing. Yesterday's briefing remains.")
        return 1
    log("Facts OK.")

    log("Translating to Korean...")
    try:
        ko = translate_to_korean(client, en)
    except Exception as e:  # noqa: BLE001
        log(f"Translation failed: {e}. Publishing EN only.")
        ko = None

    out = {
        "date": today,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "en": en,
        "ko": ko,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    log(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    return 0


def canned_briefing() -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    en = {
        "date": today,
        "headline": "Defense ETF extends lead as US-Iran ceasefire holds",
        "sections": [
            {
                "title": "TOP 3 WAR UPDATES",
                "bullets": [
                    {
                        "text": "US-Iran ceasefire holds 40 days in, keeping Hormuz open for oil transit.",
                        "claims": [],
                    },
                    {
                        "text": "Ukraine war passes 300,000 casualties per ACLED/UN estimates.",
                        "claims": [{"type": "numerical", "text": "300,000",
                                    "source": "conflicts.json.1.casualties"}],
                    },
                    {
                        "text": "Sudan RSF-SAF fighting produces 500,000+ refugees in 2026 to date.",
                        "claims": [],
                    },
                ],
            },
            {
                "title": "MARKET IMPACT",
                "bullets": [
                    {
                        "text": "$ITA trades 55% above 2025 baseline on US-Iran positioning.",
                        "claims": [{"type": "numerical", "text": "55%",
                                    "source": "conflicts.json.0.economicImpact.stocks.0.change"}],
                    },
                ],
            },
            {
                "title": "WHAT TO WATCH THIS WEEK",
                "bullets": [
                    {
                        "text": "Hormuz reopening progress — any renewed closure sends oil back past 100.",
                        "claims": [],
                    },
                ],
            },
        ],
    }
    return {
        "date": today,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": "dry-run",
        "en": en,
        "ko": None,
    }


if __name__ == "__main__":
    raise SystemExit(main())
