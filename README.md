# KONNEKSJONS

An NYT "Connections"-style word game built entirely from IKEA product names.

This repo currently covers **phase 1: data only** (word database). The webapp
and deployment are later phases.

## Data sources

| Source | Coverage | Products | License / access |
|---|---|---|---|
| `data/raw/ikea_furniture_raw.csv` | Furniture only (IKEA Saudi Arabia site scrape, ~2020) | 3,694 listings / 502 unique names | Kaggle-style export, already in repo |
| `data/raw/ikea_us_2025_products.jsonl` | Full catalog incl. kitchen, lighting, bathroom, textiles, plants, decor, baby & kids, etc. (IKEA US site, July 2025) | 30,511 listings / 2,550 unique names | MIT licensed, [Hugging Face](https://huggingface.co/datasets/jeffreyszhou/ikea-us-products-2025). **Not committed to git** (49MB) - run `scripts/fetch_us2025_dataset.py` to (re)download it |
| `data/raw/ikea_names_frontiernerds_2010.csv` | Historical name list, 2010 | 2,285 names + descriptions, no categories | Public download, used only as a "does this name have a long history" cross-reference flag |

Merged, these give **2,792 unique product names** across all IKEA departments (260 names appear in both the furniture and US-2025 sources; 295 also appear in the 2010 historical list).

## Data pipeline

The CSVs under `data/processed/` are the **source of truth**. The SQLite
database and Excel/CSV exports are disposable, regenerated artifacts — never
hand-edit `data/konneksjons.db` or anything under `data/export/`; if either
gets into a bad state, just delete it and rerun the build scripts. Real
backups live in git history on the CSVs (commit as you go).

```
data/
  raw/
    ikea_furniture_raw.csv         SA furniture scrape (in git)
    ikea_us_2025_products.jsonl    US full-catalog scrape (gitignored - fetch via script)
    ikea_names_frontiernerds_2010.csv   historical name list (in git)
  processed/
    products_sa_furniture_extract.csv   502 unique names from the furniture scrape
    products_us2025_extract.csv         2,550 unique names from the US 2025 scrape
    products.csv                        MASTER: 2,792 unique names, merged across both sources
    meanings.csv                        literal meaning / language / word type (LLM + web research, confidence-tagged) - currently covers the original 502 furniture names only, NOT yet extended to the 2,290 new US-only names
    naming_conventions.csv              IKEA's real naming convention, per category_system (sa_furniture_category / us_department), confidence-tagged
    groups.csv                          puzzle-candidate word groups, tagged by grouping_type (category / naming_convention / wordplay)
    group_members.csv                   join table: which product names belong to which group
  konneksjons.db                 (gitignored) SQLite build of the above, for the webapp to query
  export/                        (gitignored) konneksjons.xlsx + per-table CSVs, for eyeballing

scripts/
  fetch_us2025_dataset.py        downloads the US 2025 JSONL from Hugging Face
  build_products.py              SA furniture scrape -> products_sa_furniture_extract.csv
  build_products_us2025.py       US 2025 scrape -> products_us2025_extract.csv (parses names out of listing titles)
  build_products_master.py       merges both extracts (+ 2010 cross-reference) -> products.csv
  build_naming_conventions.py    writes naming_conventions.csv (edit this script, not the CSV, to fix data)
  build_groups.py                products.csv + naming_conventions.csv -> groups.csv / group_members.csv
  build_meanings.py              merges data/tmp/meanings_batch_*.csv research output -> meanings.csv
  build_db.py                    all processed CSVs -> konneksjons.db
  export_db.py                   konneksjons.db -> data/export/ (xlsx + CSVs)
```

To rebuild everything from scratch:

```
pip install -r requirements.txt
python scripts/fetch_us2025_dataset.py
python scripts/build_products.py
python scripts/build_products_us2025.py
python scripts/build_products_master.py
python scripts/build_naming_conventions.py
python scripts/build_groups.py
python scripts/build_db.py
python scripts/export_db.py
```

## Data quality notes

- `meanings.csv` and `naming_conventions.csv` carry a `confidence` column
  (high/medium/low). Low confidence means "no source found" — treat as
  unverified, not as false.
- **Meanings research currently only covers the original 502 furniture
  names**, not the 2,290 additional names pulled in from the US 2025 catalog.
  Extending it is a much bigger research task (~5x the names) - do that as a
  deliberate next step, not automatically.
- `naming_conventions.csv` marks several categories/departments as
  `Undocumented` where no real naming rule could be confirmed. Don't present
  these as real IKEA facts in the game without further research.
- Product names are extracted from the US 2025 dataset's listing titles via
  a heuristic (leading run of ALL-CAPS tokens); a small residue of noise is
  possible (e.g. multi-word food/plant names that are genuinely correct, like
  Latin botanical species names for potted plants).
- `products.csv`'s `product_id` is a diacritic-stripped slug of the name;
  where two distinct real names collide after stripping (e.g. TORNVIKEN vs
  TÖRNVIKEN), a numeric suffix disambiguates them (`tornviken`, `tornviken-2`).
