"""
Build the MASTER data/processed/products.csv by merging the per-source
extracts (one row per unique product name, per source):

  products_sa_furniture_extract.csv   Kaggle-style IKEA SA furniture scrape (2020ish), furniture only
  products_us2025_extract.csv         IKEA US full catalog scrape (July 2025), all departments

Plus a historical cross-reference flag from the 2010 Frontier Nerds name
list (data/raw/ikea_names_frontiernerds_2010.csv) - not merged as a full
source (it only has name+description, no categories), just used to flag
names with a long history / possible discontinuation.

Every downstream script (build_naming_conventions.py, build_groups.py,
build_db.py) should read this master file, not either per-source extract.
"""
import csv
import re
import unicodedata
from pathlib import Path

BASE = Path(__file__).parent.parent
SA = BASE / "data" / "processed" / "products_sa_furniture_extract.csv"
US = BASE / "data" / "processed" / "products_us2025_extract.csv"
FRONTIERNERDS = BASE / "data" / "raw" / "ikea_names_frontiernerds_2010.csv"
OUT = BASE / "data" / "processed" / "products.csv"


def slugify(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_name = decomposed.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def load(path):
    with path.open(encoding="utf-8", newline="") as f:
        return {row["name"]: row for row in csv.DictReader(f)}


def main():
    sa = load(SA)
    us = load(US)
    with FRONTIERNERDS.open(encoding="utf-8", newline="") as f:
        historical_names = {row["name"].strip() for row in csv.DictReader(f)}

    all_names = sorted(set(sa) | set(us))

    # Diacritic-stripping can collide two distinct real names onto the same
    # slug (e.g. TORNVIKEN vs TÖRNVIKEN both -> "tornviken") - disambiguate
    # any collision with a numeric suffix rather than silently dropping one.
    seen_ids = {}

    def unique_slug(name):
        base = slugify(name)
        seen_ids[base] = seen_ids.get(base, 0) + 1
        n = seen_ids[base]
        return base if n == 1 else f"{base}-{n}"

    out_rows = []
    for name in all_names:
        s = sa.get(name)
        u = us.get(name)
        sources = []
        if s:
            sources.append("sa_furniture_scrape")
        if u:
            sources.append("us_2025_scrape")

        sample_description = (u["sample_description_us"] if u and u.get("sample_description_us") else "") or (s["sample_description"] if s else "")
        sample_link = (u["sample_link_us"] if u and u.get("sample_link_us") else "") or (s["sample_link"] if s else "")

        out_rows.append({
            "product_id": unique_slug(name),
            "name": name,
            "data_sources": ";".join(sources),
            "in_frontiernerds_2010_list": name in historical_names,
            "categories_sa_furniture": s["categories"] if s else "",
            "designers": s["designers"] if s else "",
            "price_min_sar": s["price_min_sar"] if s else "",
            "price_max_sar": s["price_max_sar"] if s else "",
            "num_listings_sa": s["num_listings"] if s else "",
            "departments_us": u["departments_us"] if u else "",
            "sample_category_path_us": u["sample_category_path_us"] if u else "",
            "price_min_usd": u["price_min_usd"] if u else "",
            "price_max_usd": u["price_max_usd"] if u else "",
            "num_listings_us": u["num_listings_us"] if u else "",
            "sample_description": re.sub(r"\s+", " ", sample_description).strip(),
            "sample_link": sample_link,
            "word_count": len(name.split()),
            "char_len": len(name.replace(" ", "")),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)

    both = sum(1 for r in out_rows if r["data_sources"].count(";") == 1)
    print(f"Wrote {len(out_rows)} unique product names to {OUT}")
    print(f"  in both sources: {both}")
    print(f"  SA-furniture only: {sum(1 for r in out_rows if r['data_sources'] == 'sa_furniture_scrape')}")
    print(f"  US-2025 only: {sum(1 for r in out_rows if r['data_sources'] == 'us_2025_scrape')}")
    print(f"  also in 2010 historical list: {sum(1 for r in out_rows if r['in_frontiernerds_2010_list'])}")


if __name__ == "__main__":
    main()
