#!/usr/bin/env python3
"""twse_market_snapshot.py

Phase 1 data pipeline (free TWSE OpenAPI):
- Breadth from STOCK_DAY_ALL (adv/dec/unchanged counts)
- Sector/Index rotation proxy from MI_INDEX (index change % ranking)

Writes:
- obsidian_vault/30_Fox_Trading/data/market_breadth_tw.json
- obsidian_vault/30_Fox_Trading/data/sector_strength_tw.json

Notes:
- Uses TWSE OpenAPI (no key): https://openapi.twse.com.tw/
- Snapshot is end-of-day (yesterday close) style.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

ROOT = "/home/node/.openclaw/workspace"
OUT_BREADTH = os.path.join(ROOT, "obsidian_vault/30_Fox_Trading/data/market_breadth_tw.json")
OUT_SECTOR = os.path.join(ROOT, "obsidian_vault/30_Fox_Trading/data/sector_strength_tw.json")

STOCK_DAY_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
MI_INDEX = "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX"

NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "openclaw/portal-snapshot"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    return json.loads(data.decode("utf-8"))


def to_float(x) -> float | None:
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip().replace(",", "")
    m = NUM_RE.search(s)
    return float(m.group(0)) if m else None


def main() -> int:
    ts_utc = datetime.now(timezone.utc).isoformat()

    stocks = fetch_json(STOCK_DAY_ALL)
    adv = dec = flat = 0
    total = 0
    date_code = None

    for row in stocks:
        total += 1
        if date_code is None:
            date_code = row.get("Date")
        ch = to_float(row.get("Change"))
        if ch is None:
            continue
        if ch > 0:
            adv += 1
        elif ch < 0:
            dec += 1
        else:
            flat += 1

    breadth = {
        "ts_utc": ts_utc,
        "source": "TWSE OpenAPI /exchangeReport/STOCK_DAY_ALL",
        "date": date_code,
        "universe": "TWSE listed (STOCK_DAY_ALL)",
        "total": total,
        "advancers": adv,
        "decliners": dec,
        "unchanged": flat,
        "adv_dec_ratio": (adv / dec) if dec else None,
        "adv_minus_dec": adv - dec,
    }

    mi = fetch_json(MI_INDEX)
    indices = []
    # MI_INDEX returns list of dicts with Chinese keys.
    for r in mi:
        name = r.get("指數") or r.get("Index") or r.get("index")
        close = r.get("收盤指數")
        pct = r.get("漲跌百分比(%)") or r.get("漲跌百分比")
        pts = r.get("漲跌點數")
        if not name:
            continue
        indices.append(
            {
                "name": str(name),
                "close": to_float(close),
                "change_points": to_float(pts),
                "change_pct": to_float(pct),
            }
        )

    indices_sorted = sorted(
        [x for x in indices if x.get("change_pct") is not None],
        key=lambda x: float(x["change_pct"]),
        reverse=True,
    )

    sector = {
        "ts_utc": ts_utc,
        "source": "TWSE OpenAPI /exchangeReport/MI_INDEX",
        "date": date_code,
        "note": "Uses MI_INDEX as sector/index rotation proxy. For full sector rotation, Phase 2 should compute by TEJ industry mapping.",
        "top": indices_sorted[:10],
        "bottom": list(reversed(indices_sorted[-10:])),
        "all": indices_sorted,
    }

    os.makedirs(os.path.dirname(OUT_BREADTH), exist_ok=True)
    with open(OUT_BREADTH, "w", encoding="utf-8") as f:
        json.dump(breadth, f, ensure_ascii=False, indent=2)
        f.write("\n")

    with open(OUT_SECTOR, "w", encoding="utf-8") as f:
        json.dump(sector, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
