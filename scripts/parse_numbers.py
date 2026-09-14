"""Extract the KMTNet planet list from the source .numbers spreadsheet into
data/kmtnet_planets.json.

Usage:
    pip install numbers-parser
    python scripts/parse_numbers.py path/to/KMTNet_exoplanets_pub_YYYYMMDD.numbers

The spreadsheet's "Planet list" sheet has one row per catalog entry with
columns: [seq, Name, Publication (ADS link), Title, Publication Year, index,
Notes]. The Notes column is hand-curated and mixes several kinds of values
(brown-dwarf/planet classification, mass estimates, running FFP counters,
year-end subtotal annotations in Korean/English) — this script separates the
meaningful classification/mass text from the bookkeeping noise.
"""
import json
import re
import sys

BIBCODE_YEAR_RE = re.compile(r"abs/(\d{4})")


def parse_pub_year(raw, ads_link):
    if raw:
        m = re.search(r"(19|20)\d{2}", str(raw))
        if m:
            return int(m.group(0))
    if ads_link:
        m = BIBCODE_YEAR_RE.search(ads_link)
        if m:
            return int(m.group(1))
    return None


def classify_notes(notes):
    if notes is None:
        return None, None
    n = str(notes).strip()
    if not n:
        return None, None
    if any(ch in n for ch in "개중"):  # Korean running-total annotations
        return None, None
    if re.fullmatch(r"\d+(\.0)?", n):  # bare FFP counters
        return None, None
    if re.fullmatch(r"(19|20)\d{2}(\.0)?", n):  # bare year markers
        return None, None
    if re.match(r"(19|20)\d{2}\s*\n?\(\d+ ?BDs?\)", n):  # year-end BD subtotal
        return None, None
    low = n.lower()
    mass_m = re.search(r"([\d.]+\s*[+\-^0-9._]*\s*M_?J)", n, re.IGNORECASE)
    mass_note = mass_m.group(0).replace("\n", " ").strip() if mass_m else None
    if "bd/planet" in low or ("bd" in low and "planet" in low):
        return "BD/Planet", mass_note
    if low.startswith("bd"):
        return "BD", mass_note
    if low.startswith("planet"):
        return "Planet(low-conf)", mass_note
    return n.replace("\n", " ").strip(), mass_note


def extract(path):
    from numbers_parser import Document

    doc = Document(path)
    sheet = doc.sheets["Planet list"]
    table = sheet.tables[0]
    rows = table.rows(values_only=True)

    data = []
    for r in rows[2:]:  # skip the title comment row and the header row
        idx, name, ads_link, title, pub_year_raw, idx2, notes = r
        if not name:
            continue
        name = str(name).strip()
        title = title.strip() if title else None
        is_host_only = bool(pub_year_raw and "(Host star)" in str(pub_year_raw))
        is_ffp = bool(title and re.search(r"free[- ]floating|rogue planet", title, re.IGNORECASE))
        type_note, mass_note = classify_notes(notes)
        pub_year = parse_pub_year(pub_year_raw, ads_link)

        data.append({
            "seq": int(idx),
            "name": name,
            "host_guess": re.sub(r"\s[a-h](\s*\([A-Za-z]+\))?$", "", name).strip(),
            "ads_link": ads_link,
            "title": title,
            "pub_year": pub_year,
            "is_host_only_row": is_host_only,
            "is_ffp": is_ffp,
            "type_note": type_note,
            "mass_note": mass_note,
            # filled in later by scripts/merge_nasa.py
            "pl_bmassj": None,
            "st_mass": None,
            "pl_orbsmax": None,
            "sy_dist": None,
            "disc_year": None,
            "disc_facility": None,
            "disc_telescope": None,
            "ra": None,
            "dec": None,
            "releasedate": None,
            "discoverymethod": None,
            "nasa_matched": False,
        })
    return data


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    result = extract(sys.argv[1])
    with open("data/kmtnet_planets.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"wrote {len(result)} records to data/kmtnet_planets.json")
