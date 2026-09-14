"""Merge a NASA Exoplanet Archive CSV export into data/kmtnet_planets.json.

Expected CSV columns (as exported from the archive's table UI):
    planet_name, discovery_year, discovery_facility,
    planet_mass_jupiter_mass, planet_mass_earth_mass,
    orbit_semi_major_axis_au, stellar_mass_solar, ra_deg, dec_deg, distance_pc

`discovery_facility` is used for both the "facility" and "telescope" display
fields since the archive doesn't separate them for microlensing discoveries
(the facility IS the survey/telescope, e.g. "KMTNet", "OGLE", "MOA").

Note: brown-dwarf candidate entries in the KMTNet source list are generally
absent from the NASA Exoplanet Archive (which tracks confirmed planets, not
brown dwarfs) and will legitimately stay unmatched/TBD.

Usage:
    python scripts/merge_nasa.py data/raw/nasa_exoplanets_20260914.csv
    python scripts/build_site_data.py   # regenerate assets/data/planets.js
"""
import csv
import json
import re
import sys


def normalize(name):
    """Fix up common typos/inconsistencies between the two source spreadsheets
    (missing hyphens, stray colons, extra/missing spaces) before comparing."""
    n = name.strip().lower()
    n = n.replace("(", " ").replace(")", " ")  # "(AB)" -> " AB "
    n = n.replace(":", "-")  # "2018:blg" -> "2018-blg"
    n = re.sub(r"(\d{4})blg", r"\1-blg", n)  # "2018blg" -> "2018-blg"
    n = re.sub(r"-\s+", "-", n)  # "blg- 0448l" -> "blg-0448l"
    n = re.sub(r"(\d)l([a-h])$", r"\1l \2", n)  # "0736lb" -> "0736l b"
    n = re.sub(r"\s+", " ", n)
    return n.strip()


def canon(name):
    """Collapse the optional trailing lens-designator 'L' (present in some
    entries, absent in others, e.g. 'KMT-...-1820 b' vs 'KMT-...-1820L b')
    so both sides of the match agree regardless of which source includes it."""
    n = normalize(name)
    tokens = n.split(" ")
    letter = None
    if tokens and re.fullmatch(r"[a-h]", tokens[-1]):
        letter = tokens.pop()
    host = " ".join(tokens)
    if host.endswith("l"):
        host = host[:-1]
    return host + (" " + letter if letter else "")


def load_nasa_csv(path):
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


def to_float(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def main(csv_path):
    with open("data/kmtnet_planets.json", encoding="utf-8") as f:
        data = json.load(f)

    nasa = load_nasa_csv(csv_path)

    matched = 0
    unmatched = []
    for entry in data:
        row = nasa.get(canon(entry["name"]))
        if row:
            matched += 1
            entry["nasa_matched"] = True
            entry["disc_year"] = to_float(row.get("discovery_year"))
            entry["disc_facility"] = row.get("discovery_facility") or None
            entry["disc_telescope"] = row.get("discovery_facility") or None
            entry["pl_bmassj"] = to_float(row.get("planet_mass_jupiter_mass"))
            entry["pl_bmasse"] = to_float(row.get("planet_mass_earth_mass"))
            entry["pl_orbsmax"] = to_float(row.get("orbit_semi_major_axis_au"))
            entry["st_mass"] = to_float(row.get("stellar_mass_solar"))
            entry["ra"] = to_float(row.get("ra_deg"))
            entry["dec"] = to_float(row.get("dec_deg"))
            entry["sy_dist"] = to_float(row.get("distance_pc"))
            entry["discoverymethod"] = "Microlensing"
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
