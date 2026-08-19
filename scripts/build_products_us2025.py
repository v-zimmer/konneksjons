"""
Extract unique product names + categories from the US 2025 full-catalog
dataset (data/raw/ikea_us_2025_products.jsonl), which covers departments
the furniture-only Kaggle scrape doesn't have (Kitchen, Storage, Bathroom,
Lighting, Plants, Home textiles, Baby & kids, etc).

The title field looks like "NAME product type, variant, size - IKEA US" or
"NAME1 / NAME2 product type, ... " for combo/system products. We extract the
name(s) as the leading run of tokens that are either ALL-CAPS or contain no
letters at all (so things like "2017" in "IKEA PS 2017" are kept), split
combo names on " / " the same way build_products.py does for the other
source.

Writes: data/processed/products_us2025_extract.csv (one row per unique name)
"""
import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

RAW = Path(__file__).parent.parent / "data" / "raw" / "ikea_us_2025_products.jsonl"
OUT = Path(__file__).parent.parent / "data" / "processed" / "products_us2025_extract.csv"


def slugify(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_name = decomposed.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def is_name_token(tok: str) -> bool:
    if tok == "/":
        return True
    letters = [c for c in tok if c.isalpha()]
    if not letters:
        return True  # pure number/symbol token, e.g. "2017", "365+"
    return tok.upper() == tok  # ALL-CAPS (diacritics-aware via str.upper())


# Trailing tokens that are technical descriptors, not part of the product
# name, but happen to be ALL-CAPS acronyms so they pass the naive name-token
# test (e.g. "JANSJO LED USB spotlight" -> name should be just JANSJO).
TRAILING_DESCRIPTOR_STOPWORDS = {"LED", "TV", "USB", "USB-C", "USB-A", "GPS", "WIFI", "USB-C/A"}

YEAR_RE = re.compile(r"^(19|20)\d{2}$")


def is_bare_number(tok: str) -> bool:
    return not any(c.isalpha() for c in tok)


def strip_trailing_noise(name_tokens: list[str]) -> list[str]:
    tokens = list(name_tokens)
    changed = True
    while changed and tokens:
        changed = False
        last = tokens[-1]
        if last in TRAILING_DESCRIPTOR_STOPWORDS:
            tokens.pop()
            changed = True
        elif is_bare_number(last) and not YEAR_RE.match(last) and not last.endswith("+"):
            tokens.pop()
            changed = True
    return tokens


def extract_name(title: str) -> str | None:
    # Strip the trailing " - IKEA US" suffix and leading/trailing whitespace.
    title = re.sub(r"\s*-\s*IKEA US\s*$", "", title).strip()
    tokens = title.split(" ")
    name_tokens = []
    for tok in tokens:
        tok = tok.replace("®", "").replace("™", "")  # strip (R)/(TM) marks
        if not tok:
            continue
        if is_name_token(tok):
            name_tokens.append(tok)
        else:
            break
    name_tokens = strip_trailing_noise(name_tokens)
    if not name_tokens:
        return None
    return " ".join(name_tokens).strip()


def main():
    groups = defaultdict(list)  # base_name -> list of records
    skipped = 0
    total = 0

    with RAW.open(encoding="utf-8") as f:
        for line in f:
            total += 1
            rec = json.loads(line)
            title = rec.get("title", "")
            raw_name = extract_name(title)
            if not raw_name:
                skipped += 1
                continue
            parts = [p.strip() for p in raw_name.split("/")]
            for part in parts:
                if part:
                    groups[part].append(rec)

    print(f"Processed {total} listings, {skipped} had no extractable name, {len(groups)} unique base names found.")

    out_rows = []
    for name in sorted(groups.keys()):
        recs = groups[name]
        departments = sorted({r["category_tree"][1] for r in recs if len(r.get("category_tree", [])) > 1})
        sample_path = " > ".join(recs[0].get("category_tree", []))
        prices = []
        for r in recs:
            try:
                prices.append(float(r["price"]))
            except (ValueError, TypeError):
                pass
        sample_desc = next((r["description"] for r in recs if r.get("description")), "")
        sample_link = next((r["source_url"] for r in recs if r.get("source_url")), "")

        out_rows.append({
            "product_id": slugify(name),
            "name": name,
            "departments_us": ";".join(departments),
            "sample_category_path_us": sample_path,
            "num_listings_us": len(recs),
            "price_min_usd": min(prices) if prices else "",
            "price_max_usd": max(prices) if prices else "",
            "sample_description_us": re.sub(r"\s+", " ", sample_desc).strip()[:300],
            "sample_link_us": sample_link,
            "word_count": len(name.split()),
            "char_len": len(name.replace(" ", "")),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)

    print(f"Wrote {len(out_rows)} unique product names to {OUT}")


if __name__ == "__main__":
    main()
