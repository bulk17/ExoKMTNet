"""Merge planet-mass error columns from a NASA Exoplanet Archive CSV export
into data/kmtnet_planets.json, without touching any other field.

Expected CSV columns (as exported from the archive's table UI, same as the
export merge_nasa.py reads, with error columns added):
    planet_name,
    planet_mass_jupiter_mass_err_upper, planet_mass_jupiter_mass_err_lower,
    planet_mass_earth_mass_err_upper, planet_mass_earth_mass_err_lower

Adds/updates on each matched entry:
    pl_bmassj_err1, pl_bmassj_err2   (M_Jup, upper/lower)
    pl_bmasse_err1, pl_bmasse_err2   (M_Earth, upper/lower)

Usage:
    python scripts/merge_mass_errors.py data/raw/nasa_exoplanets_20260916_witherr.csv
    python scripts/build_site_data.py   # regenerate assets/data/planets.js
"""
import csv
import json
import sys

from merge_nasa import canon, to_float


def load_csv(path):
    by_name = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        lines = [ln for ln in f if not ln.startswith("#")]
    reader = csv.DictReader(lines)
    for row in reader:
        name = row.get("planet_name")
        if not name:
            continue
        by_name[canon(name)] = row
    return by_name


def main(csv_path):
    with open("data/kmtnet_planets.json", encoding="utf-8") as f:
        data = json.load(f)

    src = load_csv(csv_path)

    matched = 0
    unmatched = []
    for entry in data:
        row = src.get(canon(entry["name"]))
        if not row:
            unmatched.append(entry["name"])
            continue
        errj_upper = to_float(row.get("planet_mass_jupiter_mass_err_upper"))
        errj_lower = to_float(row.get("planet_mass_jupiter_mass_err_lower"))
        erre_upper = to_float(row.get("planet_mass_earth_mass_err_upper"))
        erre_lower = to_float(row.get("planet_mass_earth_mass_err_lower"))
        if errj_upper is None and errj_lower is None and erre_upper is None and erre_lower is None:
            continue
        entry["pl_bmassj_err1"] = errj_upper
        entry["pl_bmassj_err2"] = errj_lower
        entry["pl_bmasse_err1"] = erre_upper
        entry["pl_bmasse_err2"] = erre_lower
        matched += 1

    with open("data/kmtnet_planets.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"filled mass errors for {matched} / {len(data)} entries")
    if unmatched:
        print(f"{len(unmatched)} entries not found in this CSV (left as-is):")
        for n in unmatched:
            print("  -", n)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
