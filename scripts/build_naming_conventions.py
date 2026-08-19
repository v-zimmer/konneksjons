"""
Write data/processed/naming_conventions.csv using the csv module (not hand-typed
text) so that fields containing commas are quoted correctly.

Source: manual research (web search + an academic thesis on IKEA's naming
convention) against the 17 categories present in our furniture-only dataset.
See git history / conversation for the source URLs used.
"""
import csv
from pathlib import Path

OUT = Path(__file__).parent.parent / "data" / "processed" / "naming_conventions.csv"

ROWS = [
    dict(
        category="Bar furniture",
        theme_label="Undocumented",
        theme_description="No documented IKEA naming rule found for this specific category in the sources checked; may overlap with the general seating/table place-name convention. Needs manual pattern-spotting against actual names.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Beds",
        theme_label="Norwegian place names",
        theme_description="Beds (plus wardrobes and hall furniture) are named after towns and places in Norway.",
        confidence="high",
        sources="https://highnames.com/ikea-naming-system/; academic thesis (Lund University) on IKEA naming convention",
    ),
    dict(
        category="Bookcases & shelving units",
        theme_label="Boys' names / occupations",
        theme_description="Bookcases are named after Scandinavian boys' first names and, in some documented cases, occupational terms.",
        confidence="high",
        sources="https://highnames.com/ikea-naming-system/; academic thesis (Lund University)",
    ),
    dict(
        category="Cabinets & cupboards",
        theme_label="Undocumented",
        theme_description="No documented rule found specifically for general cabinets/cupboards (as distinct from bathroom or media storage); sources cover bathroom storage (rivers/lakes/bays) and media storage (Swedish place names) but not this broader IKEA.com category.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Café furniture",
        theme_label="Undocumented",
        theme_description="No documented rule found; likely overlaps with the general table/chair place-name and men's-name conventions but not confirmed.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Chairs",
        theme_label="Mixed: men's names (desk/office chairs) or place names (general seating)",
        theme_description="Desks and office chairs are documented as using Swedish men's first names. Other chairs (dining/occasional) fall under the broader upholstered-furniture convention of Swedish place names. Since this dataset's 'Chairs' category lumps both, expect a mix.",
        confidence="medium",
        sources="https://highnames.com/ikea-naming-system/; academic thesis (Lund University)",
    ),
    dict(
        category="Chests of drawers & drawer units",
        theme_label="Undocumented",
        theme_description="No documented rule found specifically for chests of drawers/storage units distinct from bookcases.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Children's furniture",
        theme_label="Animals / birds / adjectives",
        theme_description="Children's and nursery items (including toys) are named after animals, birds, and descriptive adjectives.",
        confidence="high",
        sources="https://highnames.com/ikea-naming-system/; academic thesis (Lund University)",
    ),
    dict(
        category="Nursery furniture",
        theme_label="Animals / birds / adjectives",
        theme_description="Same convention as Children's furniture: animals, birds, and descriptive adjectives.",
        confidence="high",
        sources="https://highnames.com/ikea-naming-system/; academic thesis (Lund University)",
    ),
    dict(
        category="Outdoor furniture",
        theme_label="Scandinavian islands / coastal place names",
        theme_description="Garden/outdoor furniture series are named after Scandinavian islands and coastal place names (e.g. ASKHOLMEN, NAMMARO, VITTSKAR, TORPARO).",
        confidence="medium",
        sources="web search corroboration via IKEA product listings; not in the two primary academic/agency sources but consistent with their place-name pattern",
    ),
    dict(
        category="Room dividers",
        theme_label="Undocumented",
        theme_description="No documented rule found for this category.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Sideboards, buffets & console tables",
        theme_label="Undocumented",
        theme_description="No documented rule found specifically for sideboards; may overlap with general upholstered/case-furniture place-name convention.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Sofas & armchairs",
        theme_label="Swedish place names",
        theme_description="Upholstered furniture (sofas, armchairs) plus rattan furniture and coffee tables are named after Swedish place names.",
        confidence="high",
        sources="https://highnames.com/ikea-naming-system/",
    ),
    dict(
        category="TV & media furniture",
        theme_label="Swedish place names",
        theme_description="Media storage furniture is documented as using Swedish place names.",
        confidence="medium",
        sources="https://highnames.com/ikea-naming-system/",
    ),
    dict(
        category="Tables & desks",
        theme_label="Mixed: Swedish/Finnish place names (tables) or men's names (desks)",
        theme_description="Dining tables and chairs use Finnish and Swedish place names; desks specifically use Swedish men's first names. This dataset's 'Tables & desks' category lumps both.",
        confidence="medium",
        sources="https://highnames.com/ikea-naming-system/; academic thesis (Lund University)",
    ),
    dict(
        category="Trolleys",
        theme_label="Undocumented",
        theme_description="No documented rule found for this category.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Wardrobes",
        theme_label="Norwegian place names",
        theme_description="Wardrobes, along with beds and hall furniture, are named after towns and places in Norway.",
        confidence="high",
        sources="https://highnames.com/ikea-naming-system/; academic thesis (Lund University)",
    ),
]


def main():
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["category", "theme_label", "theme_description", "confidence", "sources"])
        w.writeheader()
        w.writerows(ROWS)
    print(f"Wrote {len(ROWS)} rows to {OUT}")


if __name__ == "__main__":
    main()
