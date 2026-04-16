#!/usr/bin/env python3
"""Build a compact 2KB context summary for Claude system prompt.

Reduces conflicts.json (~33KB) + stocks.json (~31KB) ~= 64KB down to ~2KB of
high-signal fields. The full JSON is still available on disk for tool_use
lookups, but the compact version keeps prompt caching viable.

Output: data/context-compact.json

Run via daily-update.yml after update-stocks/update-news succeed.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFLICTS = ROOT / "data" / "conflicts.json"
STOCKS = ROOT / "data" / "stocks.json"
OUT = ROOT / "data" / "context-compact.json"


def compact_conflict(c: dict) -> dict | None:
    """One conflict → short object. Skip conflicts without economicImpact."""
    econ = c.get("economicImpact")
    if not econ:
        return None
    return {
        "name": c["name"],
        "start": c.get("startDate") or f"{c.get('startYear', '?')}-01-01",
        "parties": c.get("parties", [])[:4],  # cap verbose lists
        "casualties": c.get("casualties"),
        "refugees": c.get("refugees"),
        "warCost": econ.get("warCost"),
        "topStocks": [
            {"t": s["ticker"], "c": s["change"], "since": s.get("since")}
            for s in sorted(
                (s for s in econ.get("stocks", []) if isinstance(s.get("change"), (int, float))),
                key=lambda s: abs(s["change"]),
                reverse=True,
            )[:5]
        ],
        "commodities": [
            {"n": co["name"], "c": co.get("change")}
            for co in econ.get("commodities", [])[:4]
            if isinstance(co.get("change"), (int, float))
        ],
    }


def compact_stock(s: dict) -> dict:
    """One stock → minimal trading-view object."""
    return {
        "ticker": s.get("ticker"),
        "name": s.get("name"),
        "price": s.get("price"),
        "dod": s.get("dod"),
        "mom": s.get("mom"),
        "ytdReturn": s.get("ytdReturn"),
        "weekHigh52": s.get("weekHigh52"),
        "weekLow52": s.get("weekLow52"),
        "sector": s.get("sector"),
    }


def main() -> int:
    conflicts_raw = json.loads(CONFLICTS.read_text())
    stocks_raw = json.loads(STOCKS.read_text())

    conflicts = [c for c in (compact_conflict(c) for c in conflicts_raw) if c]
    # stocks.json has sectors[] at top + (unknown) structure — detect both
    stock_list = stocks_raw.get("stocks") or []
    if not stock_list and "sectors" in stocks_raw:
        # Look for per-stock data under sectors[].stocks
        for sec in stocks_raw.get("sectors", []):
            stock_list.extend(sec.get("stocks", []))
    stocks = [compact_stock(s) for s in stock_list if s.get("ticker")]

    compact = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "conflictCount": len(conflicts_raw),
        "conflictsWithImpact": conflicts,
        "stocks": stocks,
        "sectors": [
            {
                "id": sec.get("id"),
                "name": sec.get("name"),
                "outlook": sec.get("outlook"),
                "note": sec.get("outlookNote"),
            }
            for sec in stocks_raw.get("sectors", [])
        ],
        "note": (
            "This is a compact projection. Full conflict/stock data lives at "
            "conflicts.json / stocks.json. Only reference numbers, tickers, and "
            "conflict names that appear in this object."
        ),
    }

    OUT.write_text(json.dumps(compact, ensure_ascii=False, indent=2) + "\n")
    raw_kb = (CONFLICTS.stat().st_size + STOCKS.stat().st_size) / 1024
    out_kb = OUT.stat().st_size / 1024
    print(
        f"Raw: {raw_kb:.1f}KB → Compact: {out_kb:.1f}KB "
        f"({out_kb / raw_kb * 100:.1f}% of original). "
        f"{len(conflicts)} conflicts w/ impact, {len(stocks)} stocks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
