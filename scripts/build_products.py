"""
Build data/processed/products.csv: one row per unique IKEA product NAME,
aggregated from the raw per-listing export at data/raw/ikea_furniture_raw.csv.

The raw file has one row per *listing* (e.g. a name can appear many times
across colour variants, bundle combos like "NORDVIKEN / NORDVIKEN", and even
across categories). For the Connections word pool we want one row per unique
name, with the variation folded into aggregate fields.
"""
import csv
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

RAW = Path(__file__).parent.parent / "data" / "raw" / "ikea_furniture_raw.csv"
OUT = Path(__file__).parent.parent / "data" / "processed" / "products.csv"

# Some raw rows have a scraping artifact where "designer" holds an item-number
# prefix plus marketing blurb text instead of an actual designer name, e.g.
# "902.179.72 Adjustable feet make the table stand steady..." Filter these out.
BOGUS_DESIGNER_RE = re.compile(r"^\d{3}\.\d{3}\.\d{2}")


def slugify(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_name = decomposed.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")
    return slug


def main():
    groups = defaultdict(list)
    with RAW.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    for row in rows:
        raw_name = row["name"].strip()
        # Combo listings like "NORDVIKEN / NORDVIKEN" or "BESTÅ / EKET" bundle
        # multiple base names together - split them out so each base product
        # name is tracked as itself, not as a combo string.
        parts = [p.strip() for p in raw_name.split("/")]
        for part in parts:
            if part:
                groups[part].append(row)

    out_rows = []
    for name in sorted(groups.keys()):
        listings = groups[name]
        categories = sorted({r["category"].strip() for r in listings if r["category"].strip()})
        designer_set = set()
        for r in listings:
            d = r["designer"].strip()
            if not d or d.lower() == "nan" or BOGUS_DESIGNER_RE.match(d):
                continue
            for part in d.split("/"):
                part = part.strip()
                if part:
                    designer_set.add(part)
        designers = sorted(designer_set)
        prices = [float(r["price"]) for r in listings if r.get("price") not in (None, "", "nan")]
        sellable = any(r.get("sellable_online", "").strip().lower() == "true" for r in listings)
        other_colors = any(r.get("other_colors", "").strip().lower() == "yes" for r in listings)
        sample_link = next((r["link"] for r in listings if r.get("link")), "")
        descriptions = sorted({re.sub(r"\s+", " ", r["short_description"]).strip() for r in listings if r.get("short_description")})

        out_rows.append({
            "product_id": slugify(name),
            "name": name,
            "categories": ";".join(categories),
            "num_categories": len(categories),
            "num_listings": len(listings),
            "designers": ";".join(designers),
            "price_min_sar": min(prices) if prices else "",
            "price_max_sar": max(prices) if prices else "",
            "sellable_online_any": sellable,
            "has_color_variants": other_colors,
            "sample_description": descriptions[0] if descriptions else "",
            "sample_link": sample_link,
            "word_count": len(name.split()),
            "char_len": len(name.replace(" ", "")),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        fieldnames = list(out_rows[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Wrote {len(out_rows)} unique product names to {OUT}")


if __name__ == "__main__":
    main()
