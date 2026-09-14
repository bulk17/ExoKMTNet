# KMTNet Exoplanet Archive

A static, browsable catalog of exoplanets (and brown-dwarf / free-floating
planet candidates) discovered through KMTNet (Korea Microlensing Telescope
Network) microlensing surveys — styled after the
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/).

Open `index.html` in a browser (or serve the folder with any static file
server) — no build step required.

## Data pipeline

1. **`data/kmtnet_planets.json`** — the merged dataset the site reads (via
   `assets/data/planets.js`, a JS-wrapped copy for `file://`-friendly
   loading without CORS issues).
2. **`scripts/parse_numbers.py`** — rebuilds the base catalog (name, ADS
   publication link, title, publication year, Planet/BD/FFP classification)
   from the source `.numbers` spreadsheet.
3. **`scripts/merge_nasa.py`** — merges physical parameters (mass,
   semi-major axis, host-star mass, distance, RA/Dec, discovery
   telescope/facility, release date) from a NASA Exoplanet Archive CSV
   export (PSCompPars table, filtered to `discoverymethod = Microlensing`)
   by matching planet name.
4. **`scripts/merge_exoplaneteu.py`** — tops up whatever fields are still
   blank after the NASA merge from an
   [exoplanet.eu](https://exoplanet.eu/) catalog export (all
   `detection_type = Microlensing` rows), matching by name and alternate
   names. Never overwrites a value the NASA merge already filled in.
5. **`scripts/build_site_data.py`** — regenerates `assets/data/planets.js`
   from `data/kmtnet_planets.json` after any of the above.

```bash
pip install numbers-parser
python scripts/parse_numbers.py path/to/source.numbers
python scripts/merge_nasa.py data/raw/nasa_pscomppars.csv
python scripts/merge_exoplaneteu.py data/raw/exoplanet_eu_catalog.csv
python scripts/build_site_data.py
```

Entries not yet matched to either source show `TBD` for physical
parameters rather than being hidden.

## Notes on the source data

- The base spreadsheet's "Notes" column mixes several kinds of annotations
  (BD/planet classification, mass estimates, running free-floating-planet
  counters, year-end subtotal notes) — `parse_numbers.py` separates the
  meaningful classification text from bookkeeping noise.
- "Type" badges (Planet / Brown dwarf / BD-planet boundary / Free-floating)
  reflect the source spreadsheet's own classification; several objects near
  the planet–brown-dwarf boundary have disputed masses and are kept in the
  catalog with that ambiguity flagged rather than dropped.
- This is a fan-maintained catalog, not an official KMTNet or NASA product.
