"""Merge a NASA Exoplanet Archive CSV export into data/kmtnet_planets.json.

Download the CSV from the Planetary Systems Composite Parameters (PSCompPars)
table, filtered to discoverymethod = Microlensing, with (at least) these
columns: pl_name, hostname, disc_year, disc_facility, disc_telescope,
discoverymethod, pl_bmassj, pl_orbsmax, st_mass, sy_dist, ra, dec,
releasedate.

Usage:
    python scripts/merge_nasa.py data/raw/nasa_pscomppars.csv
    python scripts/build_site_data.py   # regenerate assets/data/planets.js
"""
import csv
import json
import re
import sys

FIELDS = [
    "disc_year", "disc_facility", "disc_telescope", "discoverymethod",
    "pl_bmassj", "pl_orbsmax", "st_mass", "sy_dist", "ra", "dec", "releasedate",
]


def normalize(name):
    return re.sub(r"\s+", " ", name.strip().lower())


def load_nasa_csv(path):
    by_name = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        # NASA TAP CSV exports sometimes prepend '#'-commented metadata lines
        lines = [ln for ln in f if not ln.startswith("#")]
    reader = csv.DictReader(lines)
    for row in reader:
        name = row.get("pl_name")
        if not name:
            continue
        by_name[normalize(name)] = row
    return by_name


def main(csv_path):
    with open("data/kmtnet_planets.json", encoding="utf-8") as f:
        data = json.load(f)

    nasa = load_nasa_csv(csv_path)

    matched = 0
    unmatched = []
    for entry in data:
        key = normalize(entry["name"])
        row = nasa.get(key)
        if not row:
            # retry without a trailing space/letter-case quirks
            key2 = normalize(entry["name"].replace("  ", " "))
            row = nasa.get(key2)
        if row:
            matched += 1
            entry["nasa_matched"] = True
            for field in FIELDS:
                val = row.get(field, "")
                if val in ("", None):
                    continue
                if field in ("disc_year", "pl_bmassj", "pl_orbsmax", "st_mass", "sy_dist", "ra", "dec"):
                    try:
                        val = float(val)
                    except ValueError:
                        pass
                entry[field] = val
        else:
            unmatched.append(entry["name"])

    with open("data/kmtnet_planets.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"matched {matched} / {len(data)} entries")
    if unmatched:
        print(f"{len(unmatched)} unmatched (left as TBD):")
        for n in unmatched:
            print("  -", n)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
