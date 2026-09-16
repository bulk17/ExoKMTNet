"""Regenerate assets/data/planets.js from data/kmtnet_planets.json.

Run this after editing data/kmtnet_planets.json (e.g. after
scripts/merge_nasa.py) so the static site picks up the changes.
"""
import json
from datetime import datetime, timezone

with open("data/kmtnet_planets.json", encoding="utf-8") as f:
    data = json.load(f)

build_date = datetime.now(timezone.utc).date().isoformat()

with open("assets/data/planets.js", "w", encoding="utf-8") as f:
    f.write("// Auto-generated from data/kmtnet_planets.json — do not edit by hand.\n")
    f.write("// Regenerate with: python scripts/build_site_data.py\n")
    f.write("window.KMTNET_PLANETS = ")
    json.dump(data, f, ensure_ascii=False)
    f.write(";\n")
    f.write("window.KMTNET_LIST_UPDATED = " + json.dumps(build_date) + ";\n")

print(f"wrote {len(data)} records to assets/data/planets.js")
