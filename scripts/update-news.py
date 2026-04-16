#!/usr/bin/env python3
"""Fetch latest news from Google News RSS for each conflict."""

import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import feedparser

CONFLICTS_PATH = Path(__file__).parent.parent / "data" / "conflicts.json"

# Search terms for each conflict (English)
CONFLICT_SEARCH = {
    "US-Iran Conflict 2026": "US Iran war 2026",
    "Ukraine-Russia War": "Ukraine Russia war",
    "Gaza War": "Gaza war Israel",
    "Sudan Civil War": "Sudan civil war",
    "Myanmar Civil War": "Myanmar civil war",
    "Yemen Civil War": "Yemen Houthi war",
    "DR Congo - M23 & ADF": "Congo M23 war",
    "Mexico Drug War": "Mexico cartel war",
}

MAX_NEWS = 3


def fetch_news(search_query):
    """Fetch news from Google News RSS."""
    url = f"https://news.google.com/rss/search?q={quote(search_query)}&hl=en-US&gl=US&ceid=US:en"

    try:
        feed = feedparser.parse(url)
        items = []

        for entry in feed.entries[:MAX_NEWS]:
            # Extract source from title (Google News format: "Title - Source")
            title = entry.get("title", "")
            source = "Unknown"
            if " - " in title:
                parts = title.rsplit(" - ", 1)
                title = parts[0]
                source = parts[1]

            # Parse date
            published = entry.get("published", "")
            try:
                dt = datetime(*entry.published_parsed[:6])
                date_str = dt.strftime("%Y-%m-%d")
            except (AttributeError, TypeError):
                date_str = datetime.now().strftime("%Y-%m-%d")

            items.append({
                "headline": title[:120],  # Truncate long headlines
                "date": date_str,
                "source": source[:30],
                "url": entry.get("link", ""),
            })

        return items

    except Exception as e:
        print(f"  ERROR fetching news: {e}")
        return []


def main():
    print(f"[{datetime.now().isoformat()}] Starting news update...")

    with open(CONFLICTS_PATH, "r") as f:
        conflicts = json.load(f)

    updated = 0

    for conflict in conflicts:
        name = conflict["name"]
        search = CONFLICT_SEARCH.get(name)

        if not search:
            continue

        if "economicImpact" not in conflict:
            continue

        print(f"  Fetching news for {name}...", end=" ")
        news = fetch_news(search)

        if news:
            # Keep headline_ko from existing news if present
            existing = {n.get("url"): n for n in conflict["economicImpact"].get("news", [])}
            for item in news:
                if item["url"] in existing and "headline_ko" in existing[item["url"]]:
                    item["headline_ko"] = existing[item["url"]]["headline_ko"]

            conflict["economicImpact"]["news"] = news
            print(f"OK — {len(news)} articles")
            updated += 1
        else:
            print("SKIPPED (no results)")

    with open(CONFLICTS_PATH, "w") as f:
        json.dump(conflicts, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Updated news for {updated} conflicts.")


if __name__ == "__main__":
    main()
