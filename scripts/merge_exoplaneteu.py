"""Fill remaining TBD fields in data/kmtnet_planets.json from an exoplanet.eu
catalog export (all "Microlensing" detection-type rows).

This runs *after* scripts/merge_nasa.py and only fills fields that are
still null — it never overwrites a value the NASA Exoplanet Archive merge
already supplied. exoplanet.eu tends to carry more/newer microlensing
entries than the NASA archive (including some brown-dwarf-boundary
objects NASA excludes), so this catches additional matches.

Usage:
    python scripts/merge_exoplaneteu.py data/raw/exoplanet_eu_catalog.csv
    python scripts/build_site_data.py
"""
import csv
import json
import re
import sys

FIELD_MAP = {
    # our field -> (csv column, caster)
    "pl_bmassj": "mass",
    "pl_orbsmax": "semi_major_axis",
    "st_mass": "star_mass",
    "sy_dist": "star_distance",
    "ra": "ra",
    "dec": "dec",
    "disc_year": "discovered",
}

JUPITER_TO_EARTH_MASS = 317.828


def normalize(name):
    n = name.strip().lower()
    n = n.replace("(", " ").replace(")", " ")
    n = n.replace(":", "-")
    n = re.sub(r"(\d{4})blg", r"\1-blg", n)
    n = re.sub(r"-\s+", "-", n)
    n = re.sub(r"(\d)l([a-h])$", r"\1l \2", n)
    n = re.sub(r"\s+", " ", n)
    return n.strip()


def canon(name):
    n = normalize(name)
    tokens = n.split(" ")
    letter = None
    if tokens and re.fullmatch(r"[a-h]", tokens[-1]):
        letter = tokens.pop()
    host = " ".join(tokens)
    if host.endswith("l"):
        host = host[:-1]
    return host + (" " + letter if letter else "")


def to_float(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def load_eu_csv(path):
    by_name = {}
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            keys = [row.get("name", "")]
            alt = row.get("alternate_names") or ""
            keys += [a.strip() for a in re.split(r"[,;|]", alt) if a.strip()]
            for k in keys:
                if k:
                    by_name[canon(k)] = row
    return by_name


def main(csv_path):
    with open("data/kmtnet_planets.json", encoding="utf-8") as f:
        data = json.load(f)

    eu = load_eu_csv(csv_path)

    filled_entries = 0
    filled_fields = 0
    newly_matched = 0
    for entry in data:
        row = eu.get(canon(entry["name"]))
        if not row:
            continue
        was_matched_before = entry.get("eu_matched") or entry.get("nasa_matched")
        this_entry_filled = 0
        for our_field, csv_field in FIELD_MAP.items():
            if entry.get(our_field) is not None:
                continue
            val = to_float(row.get(csv_field))
            if val is not None:
                entry[our_field] = val
                filled_fields += 1
                this_entry_filled += 1
        if entry.get("pl_bmasse") is None and entry.get("pl_bmassj") is not None:
            entry["pl_bmasse"] = round(entry["pl_bmassj"] * JUPITER_TO_EARTH_MASS, 2)
        if entry.get("discoverymethod") is None:
            entry["discoverymethod"] = "Microlensing"
        if not entry.get("disc_facility") and row.get("star_name"):
            pass  # exoplanet.eu doesn't give a facility/telescope name; leave as-is
        if this_entry_filled:
            entry["eu_matched"] = True
            filled_entries += 1
        if not was_matched_before and (entry.get("eu_matched")):
            newly_matched += 1

    with open("data/kmtnet_planets.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"filled {filled_fields} fields across {filled_entries} entries")
    print(f"{newly_matched} entries gained data that had none from NASA before")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
