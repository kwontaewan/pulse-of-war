#!/usr/bin/env python3
"""Generate og:image PNGs for homepage + each conflict.

Output:
  public/og.png                     — homepage (existing, now auto-gen)
  public/og-<slug>.png              — per-conflict cards (e.g. og-ukraine-russia-war.png)

Twitter/X + Meta og:image standard: 1200x630. Same ratio as P&L card.

Runs daily via .github/workflows/daily-update.yml after stocks are updated.
Depends on: Pillow. Installed via scripts/requirements.txt.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CONFLICTS_JSON = ROOT / "data" / "conflicts.json"
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

W, H = 1200, 630

BG = (0, 0, 0)
BRAND_RED = (255, 32, 32)
TEXT = (255, 255, 255)
TEXT_DIM = (180, 180, 180)
GAIN = (46, 230, 122)
LOSS = (255, 32, 32)
RULE = (40, 40, 40)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Try a short list of fonts, fall back to Pillow default."""
    candidates = [
        # GitHub Actions (ubuntu-latest) has these preinstalled
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        # macOS
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        # Common Linux bold fallback
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:  # noqa: BLE001
                continue
    return ImageFont.load_default()


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^a-z0-9-]", "", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def draw_text(draw: ImageDraw.ImageDraw, xy, text: str, font, fill=TEXT, anchor="la"):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def text_w(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def base_canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # Red brand strip
    d.rectangle([(0, 0), (8, H)], fill=BRAND_RED)
    return img, d


def render_homepage(conflicts: list[dict]) -> Image.Image:
    img, d = base_canvas()

    total_casualties = sum(c.get("casualties", 0) for c in conflicts)
    total_refugees = sum(c.get("refugees", 0) for c in conflicts)
    parties = set()
    for c in conflicts:
        for p in c.get("parties", []):
            parties.add(p)

    pad_x = 72
    y = 60

    f_brand = load_font(22, bold=True)
    f_live = load_font(18, bold=True)
    f_headline = load_font(64, bold=True)
    f_stats_num = load_font(88, bold=True)
    f_stats_label = load_font(20)
    f_sub = load_font(24)
    f_watermark = load_font(20)

    draw_text(d, (pad_x, y), "PULSE OF WAR", f_brand, fill=TEXT_DIM)
    live = "● LIVE"
    draw_text(d, (W - pad_x - text_w(d, live, f_live), y), live, f_live, fill=BRAND_RED)

    y += 80

    draw_text(d, (pad_x, y), "More wars than at any point", f_headline, fill=TEXT)
    y += 76
    draw_text(d, (pad_x, y), "since World War II.", f_headline, fill=TEXT)

    y += 110

    def fmt_big(n: int) -> str:
        if n >= 1_000_000:
            v = n / 1_000_000
            return f"{v:.1f}M+" if v < 10 else f"{int(v)}M+"
        if n >= 1000:
            return f"{n // 1000}K+"
        return str(n)

    # Stats row
    col_w = (W - 2 * pad_x) // 3
    stats = [
        (f"{len(conflicts)}", "active conflicts"),
        (fmt_big(total_refugees), "displaced"),
        (fmt_big(total_casualties), "casualties"),
    ]
    for i, (num, label) in enumerate(stats):
        cx = pad_x + col_w * i
        draw_text(d, (cx, y), num, f_stats_num, fill=TEXT)
        draw_text(d, (cx, y + 90), label.upper(), f_stats_label, fill=TEXT_DIM)

    y = H - 78
    draw_text(d, (pad_x, y), "live map + war stocks", f_sub, fill=TEXT_DIM)
    draw_text(d, (W - pad_x - text_w(d, "pulseofwar.com", f_watermark), y + 12), "pulseofwar.com", f_watermark, fill=TEXT_DIM)

    return img


def render_conflict(conflict: dict) -> Image.Image | None:
    econ = conflict.get("economicImpact") or {}
    stocks = econ.get("stocks") or []
    if not stocks:
        return None

    img, d = base_canvas()

    pad_x = 72
    y = 54

    f_brand = load_font(22, bold=True)
    f_live = load_font(18, bold=True)
    f_name = load_font(56, bold=True)
    f_sub = load_font(22)
    f_ticker = load_font(42, bold=True)
    f_pct = load_font(48, bold=True)
    f_label = load_font(18)
    f_watermark = load_font(18)

    draw_text(d, (pad_x, y), "PULSE OF WAR", f_brand, fill=TEXT_DIM)
    live = "● WAR STOCKS"
    draw_text(d, (W - pad_x - text_w(d, live, f_live), y), live, f_live, fill=BRAND_RED)

    y += 72

    # Conflict name (may wrap for long names)
    name = conflict["name"]
    # Use textwrap-lite: if name > ~28 chars, split at sensible point
    if len(name) > 30:
        parts = name.split(" - ", 1) if " - " in name else name.rsplit(" ", 1)
        for p in parts:
            draw_text(d, (pad_x, y), p, f_name, fill=TEXT)
            y += 66
    else:
        draw_text(d, (pad_x, y), name, f_name, fill=TEXT)
        y += 80

    start_date = conflict.get("startDate") or f"{conflict.get('startYear', '—')}-01-01"
    sub = f"Since {start_date} — who profited"
    draw_text(d, (pad_x, y), sub, f_sub, fill=TEXT_DIM)

    y += 56

    # Top 3 stocks by absolute change
    top = sorted(
        [s for s in stocks if isinstance(s.get("change"), (int, float))],
        key=lambda s: abs(s["change"]),
        reverse=True,
    )[:3]

    row_h = 76
    for s in top:
        # ticker column
        ticker_str = f"${s['ticker']}"
        draw_text(d, (pad_x, y), ticker_str, f_ticker, fill=TEXT)
        ticker_w = text_w(d, ticker_str, f_ticker)
        # name column (dim) — start after ticker with breathing room, min 260
        name_x = pad_x + max(260, ticker_w + 32)
        nm = s.get("name", "")
        # pct width reserved on the right — name must fit between
        chg = s["change"]
        pct_str = f"{'+' if chg >= 0 else ''}{chg:.1f}%"
        pct_w = text_w(d, pct_str, f_pct)
        name_max_w = W - pad_x - pct_w - name_x - 24
        # truncate name if too wide
        while nm and text_w(d, nm, f_sub) > name_max_w:
            nm = nm[:-2] + "…"
        draw_text(d, (name_x, y + 8), nm, f_sub, fill=TEXT_DIM)
        # pct — right aligned, colored
        color = GAIN if chg >= 0 else LOSS
        draw_text(d, (W - pad_x - pct_w, y), pct_str, f_pct, fill=color)
        y += row_h

    # Footer
    y = H - 72
    d.line([(pad_x, y - 12), (W - pad_x, y - 12)], fill=RULE, width=1)
    draw_text(d, (pad_x, y), "war is a trade.", f_sub, fill=TEXT_DIM)
    wm = f"pulseofwar.com/#conflict={slugify(conflict['name'])}"
    draw_text(d, (W - pad_x - text_w(d, wm, f_watermark), y + 4), wm, f_watermark, fill=TEXT_DIM)

    return img


def main() -> int:
    conflicts = json.loads(CONFLICTS_JSON.read_text())
    print(f"Loaded {len(conflicts)} conflicts.")

    # Homepage
    img = render_homepage(conflicts)
    out = PUBLIC / "og.png"
    img.save(out, "PNG", optimize=True)
    print(f"  ✓ {out.relative_to(ROOT)}")

    # Per-conflict
    skipped = 0
    written = 0
    for c in conflicts:
        img = render_conflict(c)
        if img is None:
            skipped += 1
            continue
        out = PUBLIC / f"og-{slugify(c['name'])}.png"
        img.save(out, "PNG", optimize=True)
        written += 1
        print(f"  ✓ {out.relative_to(ROOT)}")

    print(f"\nog:images generated: 1 homepage + {written} per-conflict ({skipped} skipped — no economicImpact).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
