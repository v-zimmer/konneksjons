"""
Merge the 6 research-agent batch CSVs (data/tmp/meanings_batch_*.csv) into
data/processed/meanings.csv, validated against the canonical product list.
"""
import csv
from pathlib import Path

BASE = Path(__file__).parent.parent
PRODUCTS = BASE / "data" / "processed" / "products.csv"
TMP = BASE / "data" / "tmp"
OUT = BASE / "data" / "processed" / "meanings.csv"

FIELDS = ["name", "literal_meaning_en", "language_origin", "word_type", "confidence", "notes"]


def main():
    with PRODUCTS.open(encoding="utf-8", newline="") as f:
        product_names = [row["name"] for row in csv.DictReader(f)]
    product_name_set = set(product_names)

    merged = {}
    dupes = []
    unexpected = []
    for i in range(1, 7):
        batch_path = TMP / f"meanings_batch_{i}.csv"
        with batch_path.open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            missing_cols = set(FIELDS) - set(reader.fieldnames or [])
            if missing_cols:
                raise SystemExit(f"{batch_path} missing columns: {missing_cols}, has {reader.fieldnames}")
            for row in reader:
                name = row["name"].strip()
                if name in merged:
                    dupes.append((batch_path.name, name))
                    continue
                if name not in product_name_set:
                    unexpected.append((batch_path.name, name))
                merged[name] = {k: row.get(k, "").strip() for k in FIELDS}

    missing = product_name_set - merged.keys()

    print(f"Merged {len(merged)} name rows from 6 batches.")
    if dupes:
        print(f"WARNING: {len(dupes)} duplicate name rows across batches (kept first occurrence): {dupes[:10]}{'...' if len(dupes) > 10 else ''}")
    if unexpected:
        print(f"WARNING: {len(unexpected)} names in batch files not found in products.csv: {unexpected[:20]}")
    if missing:
        print(f"WARNING: {len(missing)} product names have NO meaning row: {sorted(missing)}")
    else:
        print("OK: every product name has a meaning row.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for name in product_names:  # preserve products.csv's canonical order
            if name in merged:
                w.writerow(merged[name])
            else:
                w.writerow({"name": name, "literal_meaning_en": "", "language_origin": "", "word_type": "", "confidence": "", "notes": "NO RESEARCH DATA - agent output missing this name"})

    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
