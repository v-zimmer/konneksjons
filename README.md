# KONNEKSJONS

An NYT "Connections"-style word game built entirely from IKEA product names.

This repo currently covers **phase 1: data only** (word database). The webapp
and deployment are later phases.

## Data pipeline

The CSVs under `data/processed/` are the **source of truth**. The SQLite
database and Excel/CSV exports are disposable, regenerated artifacts — never
hand-edit `data/konneksjons.db` or anything under `data/export/`; if either
gets into a bad state, just delete it and rerun the build scripts. Real
backups live in git history on the CSVs (commit as you go).

```
data/
  raw/ikea_furniture_raw.csv     source scrape (Kaggle-style IKEA SA furniture export, 3694 listings, 17 categories)
  processed/
    products.csv                 502 unique product names, deduped/cleaned from the raw scrape
    meanings.csv                 literal meaning / language / word type for each of the 502 names (LLM + web research, confidence-tagged)
    naming_conventions.csv       IKEA's real per-category naming convention (e.g. bookcases = boys' names), confidence-tagged
    groups.csv                   puzzle-candidate word groups, tagged by grouping_type (category / naming_convention / wordplay)
    group_members.csv            join table: which product names belong to which group
  konneksjons.db                 (gitignored) SQLite build of the above, for the webapp to query
  export/                        (gitignored) konneksjons.xlsx + per-table CSVs, for eyeballing

scripts/
  build_products.py              raw scrape -> products.csv
  build_naming_conventions.py    writes naming_conventions.csv (edit this script, not the CSV, to fix data)
  build_groups.py                products.csv + naming_conventions.csv -> groups.csv / group_members.csv
  build_meanings.py              merges data/tmp/meanings_batch_*.csv research output -> meanings.csv
  build_db.py                    all processed CSVs -> konneksjons.db
  export_db.py                   konneksjons.db -> data/export/ (xlsx + CSVs)
```

To rebuild everything from scratch:

```
pip install -r requirements.txt
python scripts/build_products.py
python scripts/build_naming_conventions.py
python scripts/build_groups.py
python scripts/build_db.py
python scripts/export_db.py
```

## Data quality notes

- `meanings.csv` and `naming_conventions.csv` carry a `confidence` column
  (high/medium/low). Low confidence means "no source found" — treat as
  unverified, not as false.
- `naming_conventions.csv` marks several IKEA.com categories as
  `Undocumented` where no real naming rule could be confirmed (Bar furniture,
  Cabinets & cupboards, Café furniture, Chests of drawers & drawer units,
  Room dividers, Sideboards, Trolleys). Don't present these as real IKEA
  facts in the game without further research.
- The source dataset is furniture-only (no kitchen, textiles, lighting, or
  plant pots), so several of IKEA's documented naming themes (e.g. bathroom
  items = Scandinavian lakes/rivers, curtains = girls' names) have no
  corresponding products here.
