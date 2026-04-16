#!/usr/bin/env python3
"""One-shot: backfill startDate ISO field into data/conflicts.json.

Uses well-known historical dates for each conflict's 'current phase' start.
Run once. Check diff. Commit.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFLICTS = ROOT / "data" / "conflicts.json"

# Keyed by exact conflict name. Dates chosen as the widely-cited start of the
# current phase of the conflict (e.g. Ukraine = Feb 24, 2022 full invasion,
# not the 2014 Donbas war).
START_DATES = {
    "US-Iran Conflict 2026": "2026-02-28",          # US-Israeli airstrike on Khamenei
    "Ukraine-Russia War": "2022-02-24",             # Full Russian invasion
    "Gaza War": "2023-10-07",                        # Hamas attack + Israel response
    "Sudan Civil War": "2023-04-15",                 # RSF vs SAF clashes in Khartoum
    "Myanmar Civil War": "2021-02-01",               # Military coup
    "Ethiopian Conflicts": "2020-11-04",             # Tigray war onset
    "Syrian Civil War": "2011-03-15",                # Daraa protests → civil war
    "Yemen Civil War": "2014-09-21",                 # Houthi takeover of Sanaa
    "Somalia - Al-Shabaab": "2006-12-24",            # Ethiopian intervention, Shabaab insurgency
    "DR Congo - M23 & ADF": "2021-11-07",            # M23 resurgence
    "Sahel Insurgency - Burkina Faso": "2015-08-23", # First major jihadist attack
    "Sahel Insurgency - Mali": "2012-01-17",         # Tuareg rebellion onset
    "Sahel Insurgency - Niger": "2015-02-06",        # Boko Haram cross-border
    "Nigeria - Boko Haram & Banditry": "2009-07-26", # Boko Haram uprising
    "Haiti Gang War": "2021-07-07",                  # Moïse assassination
    "Colombia - Armed Groups": "1964-05-27",         # FARC founding
    "Mexico Drug War": "2006-12-11",                 # Calderón's Michoacán operation
    "Afghanistan - Taliban vs ISIS-K": "2021-08-15", # Kabul fall, Taliban return
    "Pakistan - TTP Insurgency": "2007-12-14",       # TTP formation
    "Iraq - ISIS Remnants": "2017-12-09",            # Iraq declares ISIS defeated
    "Lebanon - Israel Border": "2023-10-08",         # Hezbollah opens border front
    "Mozambique - Cabo Delgado": "2017-10-05",       # First Mocimboa attack
    "Cameroon - Anglophone Crisis": "2017-10-01",    # Ambazonian independence declaration
    "India - Kashmir & Naxalite": "1989-07-13",      # Kashmir insurgency onset
    "Philippines - NPA & Abu Sayyaf": "1969-03-29",  # NPA founding
    "Central African Republic": "2012-12-10",        # Séléka rebellion
}


def main():
    conflicts = json.loads(CONFLICTS.read_text())
    updated = 0
    missing = []
    for c in conflicts:
        name = c["name"]
        if name in START_DATES:
            c["startDate"] = START_DATES[name]
            updated += 1
        else:
            missing.append(name)

    CONFLICTS.write_text(json.dumps(conflicts, ensure_ascii=False, indent=2) + "\n")
    print(f"Updated {updated}/{len(conflicts)} conflicts with startDate.")
    if missing:
        print("Missing (no match in START_DATES):")
        for n in missing:
            print(f"  - {n}")


if __name__ == "__main__":
    main()
