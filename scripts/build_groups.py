"""
Build the "groups" layer of the database: reusable pools of product names
tagged by grouping_type, so puzzle generation can later toggle which
dimensions to draw from (category / naming_convention / ...).

Reads:
  data/processed/products.csv             (master, merged across sources)
  data/processed/naming_conventions.csv   (both category_system's: sa_furniture_category, us_department)
Writes:
  data/processed/groups.csv          (group_id, grouping_type, label, description, confidence)
  data/processed/group_members.csv   (group_id, product_id, name)
"""
import csv
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).parent.parent
PRODUCTS = BASE / "data" / "processed" / "products.csv"
NAMING = BASE / "data" / "processed" / "naming_conventions.csv"
GROUPS_OUT = BASE / "data" / "processed" / "groups.csv"
MEMBERS_OUT = BASE / "data" / "processed" / "group_members.csv"

# (grouping-source system, products.csv column holding that system's category list)
CATEGORY_SYSTEMS = [
    ("sa_furniture_category", "categories_sa_furniture"),
    ("us_department", "departments_us"),
]


def slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")


def main():
    with PRODUCTS.open(encoding="utf-8", newline="") as f:
        products = list(csv.DictReader(f))

    with NAMING.open(encoding="utf-8", newline="") as f:
        naming_rows = list(csv.DictReader(f))
    naming_by_key = {(r["category_system"], r["category"]): r for r in naming_rows}

    groups = []
    members = []  # (group_id, product_id, name)

    # --- grouping_type = category: one group per category, per system ---
    for system, col in CATEGORY_SYSTEMS:
        categories = sorted({c for p in products for c in p[col].split(";") if c})
        for cat in categories:
            gid = f"category__{system}__{slug(cat)}"
            groups.append({
                "group_id": gid,
                "grouping_type": "category",
                "label": cat,
                "description": f"IKEA product category ({system}): {cat}",
                "confidence": "high",
            })
            for p in products:
                if cat in p[col].split(";"):
                    members.append((gid, p["product_id"], p["name"]))

    # --- grouping_type = naming_convention: merge categories sharing a theme ---
    # Only expose themes with medium/high confidence - "Undocumented" (low) ones
    # aren't reliable enough to present as a real IKEA naming fact. Themes can
    # be shared across the two category systems (e.g. "Swedish place names"
    # covers both SA "Sofas & armchairs" and US "Sofas & armchairs"), so we
    # merge purely on theme_label text, regardless of system.
    theme_to_keys = defaultdict(list)
    for key, row in naming_by_key.items():
        if row["confidence"] == "low":
            continue
        theme_to_keys[row["theme_label"]].append(key)

    system_to_col = dict(CATEGORY_SYSTEMS)

    for theme_label, keys in theme_to_keys.items():
        gid = f"naming_convention__{slug(theme_label)}"
        first_row = naming_by_key[keys[0]]
        groups.append({
            "group_id": gid,
            "grouping_type": "naming_convention",
            "label": theme_label,
            "description": first_row["theme_description"],
            "confidence": first_row["confidence"],
        })
        seen = set()
        for system, cat in keys:
            col = system_to_col[system]
            for p in products:
                if cat in p[col].split(";") and p["product_id"] not in seen:
                    members.append((gid, p["product_id"], p["name"]))
                    seen.add(p["product_id"])

    # --- grouping_type = wordplay: simple surface-feature groups, computed directly ---
    by_letter = defaultdict(list)
    for p in products:
        first = p["name"][0].upper()
        by_letter[first].append(p)
    for letter, plist in by_letter.items():
        if len(plist) >= 4:
            gid = f"wordplay__starts_with_{letter.lower()}"
            groups.append({
                "group_id": gid,
                "grouping_type": "wordplay",
                "label": f"Starts with '{letter}'",
                "description": f"Product names starting with the letter {letter}.",
                "confidence": "high",
            })
            for p in plist:
                members.append((gid, p["product_id"], p["name"]))

    # Single-word vs multi-word names (useful surface filter, not itself a puzzle group)
    for wc_label, pred in [
        ("single_word", lambda p: p["word_count"] == "1"),
        ("multi_word", lambda p: p["word_count"] != "1"),
    ]:
        gid = f"wordplay__{wc_label}"
        plist = [p for p in products if pred(p)]
        if plist:
            groups.append({
                "group_id": gid,
                "grouping_type": "wordplay",
                "label": wc_label.replace("_", " ").title(),
                "description": f"Product names that are {wc_label.replace('_', ' ')}.",
                "confidence": "high",
            })
            for p in plist:
                members.append((gid, p["product_id"], p["name"]))

    GROUPS_OUT.parent.mkdir(parents=True, exist_ok=True)
    with GROUPS_OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["group_id", "grouping_type", "label", "description", "confidence"])
        w.writeheader()
        w.writerows(groups)

    with MEMBERS_OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["group_id", "product_id", "name"])
        w.writerows(members)

    print(f"Wrote {len(groups)} groups to {GROUPS_OUT}")
    print(f"Wrote {len(members)} group memberships to {MEMBERS_OUT}")


if __name__ == "__main__":
    main()
