#!/usr/bin/env python3
"""Fetch latest stock data from Yahoo Finance and update stocks.json."""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import yfinance as yf

STOCKS_PATH = Path(__file__).parent.parent / "data" / "stocks.json"

# Ticker mapping: our ticker → yfinance ticker (when different)
TICKER_MAP = {
    "RHMT.ME": "RHM.DE",
    "BA.L": "BA.L",
    "LDOF.MI": "LDO.MI",
    "012450.KS": "012450.KS",
    "079550.KS": "079550.KS",
    "064350.KS": "064350.KS",
    "BTC-USD": "BTC-USD",
    "ETH-USD": "ETH-USD",
}

# Currency format by exchange
CURRENCY_FMT = {
    "NYSE": ("$", ""),
    "NASDAQ": ("$", ""),
    "CRYPTO": ("$", ""),
    "KRX": ("₩", ""),
    "XETRA": ("€", ""),
    "LSE": ("£", ""),
    "MIL": ("€", ""),
}


def format_price(price, exchange):
    prefix, suffix = CURRENCY_FMT.get(exchange, ("$", ""))
    if exchange == "KRX":
        return f"{prefix}{int(price):,}"
    elif price >= 1000:
        return f"{prefix}{int(price):,}"
    elif price >= 100:
        return f"{prefix}{price:.0f}"
    else:
        return f"{prefix}{price:.2f}"


def format_mcap(mcap, exchange):
    if mcap is None:
        return "—"
    if exchange == "KRX":
        # Convert to 조 (trillion KRW)
        jo = mcap / 1e12
        if jo >= 1:
            return f"₩{jo:.0f}조"
        return f"₩{mcap / 1e8:.0f}억"
    if mcap >= 1e12:
        return f"${mcap / 1e12:.1f}T"
    if mcap >= 1e9:
        return f"${mcap / 1e9:.0f}B"
    return f"${mcap / 1e6:.0f}M"


def format_volume(vol):
    if vol is None:
        return "—"
    if vol >= 1e9:
        return f"{vol / 1e9:.0f}B"
    if vol >= 1e6:
        return f"{vol / 1e6:.1f}M"
    if vol >= 1e3:
        return f"{vol / 1e3:.0f}K"
    return str(int(vol))


def pct_change(current, previous):
    if previous is None or previous == 0 or current is None:
        return None
    return round(((current - previous) / previous) * 100, 1)


def fetch_stock(ticker, exchange):
    """Fetch data for a single stock from yfinance."""
    yf_ticker = TICKER_MAP.get(ticker, ticker)

    try:
        stock = yf.Ticker(yf_ticker)
        info = stock.info

        # Current price
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        if price is None:
            print(f"  SKIP {ticker}: no price data")
            return None

        prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
        dod = pct_change(price, prev_close)

        # Historical data for MoM and YoY
        hist = stock.history(period="1y")
        mom = None
        yoy = None
        ytd_return = None

        if len(hist) > 0:
            current_price = hist["Close"].iloc[-1]

            # MoM: ~21 trading days ago
            if len(hist) > 21:
                mom_price = hist["Close"].iloc[-22]
                mom = pct_change(current_price, mom_price)

            # YoY: earliest available in 1y history
            if len(hist) > 200:
                yoy_price = hist["Close"].iloc[0]
                yoy = pct_change(current_price, yoy_price)

            # YTD: Jan 1 of current year
            year_start = datetime(datetime.now().year, 1, 1)
            ytd_data = hist[hist.index >= year_start.strftime("%Y-%m-%d")]
            if len(ytd_data) > 1:
                ytd_return = pct_change(ytd_data["Close"].iloc[-1], ytd_data["Close"].iloc[0])

        # 52-week range
        week_high = info.get("fiftyTwoWeekHigh")
        week_low = info.get("fiftyTwoWeekLow")

        # Volume
        volume = info.get("volume") or info.get("regularMarketVolume")

        # Valuation
        pe = info.get("trailingPE") or info.get("forwardPE")
        if pe:
            pe = round(pe, 1)

        div_yield = info.get("dividendYield")
        if div_yield:
            div_yield = round(div_yield * 100, 1)

        mcap = info.get("marketCap")

        return {
            "price": format_price(price, exchange),
            "priceNumeric": round(price, 2),
            "dod": dod,
            "mom": mom,
            "yoy": yoy,
            "ytdReturn": ytd_return if ytd_return is not None else yoy,
            "weekHigh52": round(week_high, 2) if week_high else None,
            "weekLow52": round(week_low, 2) if week_low else None,
            "volume": format_volume(volume),
            "pe": pe,
            "dividendYield": div_yield,
            "marketCap": format_mcap(mcap, exchange),
        }

    except Exception as e:
        print(f"  ERROR {ticker}: {e}")
        return None


def main():
    print(f"[{datetime.now().isoformat()}] Starting stock update...")

    with open(STOCKS_PATH, "r") as f:
        data = json.load(f)

    updated = 0
    failed = 0

    for stock in data["stocks"]:
        ticker = stock["ticker"]
        exchange = stock.get("exchange", "NYSE")
        print(f"  Fetching {ticker} ({exchange})...", end=" ")

        result = fetch_stock(ticker, exchange)
        if result:
            for key, value in result.items():
                if value is not None:
                    stock[key] = value
            print(f"OK — {result['price']} (DoD: {result['dod']}%)")
            updated += 1
        else:
            print("SKIPPED")
            failed += 1

    # Update timestamp
    data["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")

    with open(STOCKS_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Updated: {updated}, Failed: {failed}")
    if failed > len(data["stocks"]) // 2:
        print("WARNING: More than half of stocks failed. Check yfinance connection.")
        sys.exit(1)


if __name__ == "__main__":
    main()
