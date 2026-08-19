"""
Write data/processed/naming_conventions.csv using the csv module (not hand-typed
text) so that fields containing commas are quoted correctly.

Covers TWO category systems, distinguished by category_system:
  - sa_furniture_category: the 17 categories from the Kaggle-style IKEA SA
    furniture scrape (data/raw/ikea_furniture_raw.csv)
  - us_department: the 22 top-level departments from the IKEA US 2025 full
    catalog scrape (data/raw/ikea_us_2025_products.jsonl), which covers non-
    furniture departments (kitchen, lighting, bathroom, textiles, plants...)

Source: manual research (web search against a naming agency writeup +
an academic thesis on IKEA's naming convention, both fetched during this
project). See git history / conversation for the source URLs used. Where a
row's confidence is "low", it means no documented source was found - not
that the theme is wrong, just unverified.
"""
import csv
from pathlib import Path

OUT = Path(__file__).parent.parent / "data" / "processed" / "naming_conventions.csv"

FIELDS = ["category_system", "category", "theme_label", "theme_description", "confidence", "sources"]

PRIMARY_SOURCES = "https://highnames.com/ikea-naming-system/; academic thesis (Lund University) on IKEA naming convention"

SA_ROWS = [
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
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Bookcases & shelving units",
        theme_label="Boys' names / occupations",
        theme_description="Bookcases are named after Scandinavian boys' first names and, in some documented cases, occupational terms.",
        confidence="high",
        sources=PRIMARY_SOURCES,
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
        sources=PRIMARY_SOURCES,
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
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Nursery furniture",
        theme_label="Animals / birds / adjectives",
        theme_description="Same convention as Children's furniture: animals, birds, and descriptive adjectives.",
        confidence="high",
        sources=PRIMARY_SOURCES,
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
        sources=PRIMARY_SOURCES,
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
        sources=PRIMARY_SOURCES,
    ),
]

# US 2025 catalog departments. Mapped against the same two sources where
# their category boundaries line up reasonably; several IKEA.com departments
# bundle multiple of the "real" naming-convention categories together (e.g.
# "Home textiles" spans curtains/girls'-names AND bed linen/flowers-and-gems),
# so those are marked medium/mixed rather than a single confident theme.
US_ROWS = [
    dict(
        category="Sofas & armchairs",
        theme_label="Swedish place names",
        theme_description="Upholstered furniture (sofas, armchairs) plus rattan furniture and coffee tables are named after Swedish place names.",
        confidence="high",
        sources="https://highnames.com/ikea-naming-system/",
    ),
    dict(
        category="Beds & mattresses",
        theme_label="Norwegian place names",
        theme_description="Beds are named after towns and places in Norway (mattresses themselves may not follow this - needs spot-checking).",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Storage & organization",
        theme_label="Mixed: boys' names/occupations (bookcases) or colloquial expressions/place names (boxes, decor storage)",
        theme_description="Bookcases/shelving use boys' names and occupations. Boxes and similar small storage/decor items are documented separately as using colloquial expressions and Swedish place names. This broad IKEA.com department likely mixes both plus generic modular-system names (e.g. storage system names repeated across many SKUs).",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Tables & chairs",
        theme_label="Mixed: Swedish/Finnish place names (tables) or Swedish place names (general chairs)",
        theme_description="Dining tables and chairs are documented as using Finnish and Swedish place names.",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Desk & desk chairs",
        theme_label="Swedish men's names",
        theme_description="Desks and office/desk chairs are documented as using Swedish men's first names.",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Outdoor",
        theme_label="Scandinavian islands / coastal place names",
        theme_description="Garden/outdoor furniture series are named after Scandinavian islands and coastal place names.",
        confidence="medium",
        sources="web search corroboration via IKEA product listings",
    ),
    dict(
        category="Home decor & accessories",
        theme_label="Colloquial expressions / Swedish place names",
        theme_description="Wall decorations, clocks, boxes, pictures, and frames are documented as using colloquial Swedish expressions and Swedish place names.",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Lighting",
        theme_label="Music, chemistry, weather/season, measurement, and nautical terms",
        theme_description="Lighting products are documented as drawn from music terms, chemical terms, measuring units, seasons, months, days, ships, and navigation terms.",
        confidence="high",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Bathroom: furniture, supplies & more",
        theme_label="Scandinavian lakes, rivers, and bays",
        theme_description="Bathroom furnishings and storage are documented as using Swedish/Scandinavian water-related names (lakes, rivers, bays).",
        confidence="high",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Home textiles",
        theme_label="Mixed: girls' names (fabrics/curtains) or flowers/plants/gems (bed linen)",
        theme_description="Fabrics, materials, and curtains are documented as using Swedish/Scandinavian girls' first names. Bed linen, covers, pillows, and cushions are documented separately as using flowers, plants, and precious-stone names. This department likely mixes both.",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Kitchen, appliances & supplies",
        theme_label="Mixed: abstract/grammatical terms (cabinet systems) or loan-words/spices/fish/fruit (utensils)",
        theme_description="Kitchen (cabinet) systems are documented as using abstract/grammatical terms. Kitchen utensils are documented separately as using prominent foreign loan-words, spices, herbs, mushrooms, fruits, berries, fish, and functional descriptions. This department is dominated by a small number of modular cabinet-system names (e.g. SEKTION, MAXIMERA) repeated across thousands of size/finish variants.",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Kitchenware & tableware",
        theme_label="Loan-words / spices / fish / mushrooms / fruit / functional descriptions",
        theme_description="Kitchen utensils and tableware are documented as using prominent foreign loan-words, spices, herbs, mushrooms, fruits, berries, fish, and functional descriptions.",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Baby & kids",
        theme_label="Animals / birds / adjectives",
        theme_description="Children's items and toys are documented as using animals, birds, and descriptive adjectives.",
        confidence="high",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Plants & planters",
        theme_label="Botanical/Latin species names (live plants) or Swedish common nouns (pots/planters)",
        theme_description="Not found in the two primary documented sources. Empirically observed directly in our own extracted data: living potted-plant products are named with their literal Latin botanical species name (e.g. ALOE VERA, DRACAENA MARGINATA, CHAMAEDOREA ELEGANS), while planters/pots use ordinary Swedish common-noun names like other product lines.",
        confidence="medium",
        sources="derived from data/processed/products_us2025_extract.csv rather than an external citation",
    ),
    dict(
        category="Flooring, rugs & mats",
        theme_label="Danish place names (rugs specifically)",
        theme_description="Carpets/rugs are documented as using Danish place names. Non-rug flooring and mats in this department may not follow that rule.",
        confidence="medium",
        sources=PRIMARY_SOURCES,
    ),
    dict(
        category="Storage containers, organizers & baskets",
        theme_label="Undocumented / possibly colloquial expressions",
        theme_description="No dedicated source found; may overlap with the 'boxes, decorations' convention (colloquial expressions, Swedish place names) but not confirmed for this specific department.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Home improvement",
        theme_label="Undocumented",
        theme_description="No documented naming rule found; likely mostly functional/generic product names (hardware, fittings) rather than the classic lore-driven naming system.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Laundry & cleaning",
        theme_label="Undocumented",
        theme_description="No documented naming rule found for this department.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Smart home",
        theme_label="Undocumented",
        theme_description="No documented naming rule found; a newer product category not covered by the classic (1970s-era) naming convention sources.",
        confidence="low",
        sources="",
    ),
    dict(
        category="Home electronics",
        theme_label="Undocumented",
        theme_description="No documented naming rule found for this department.",
        confidence="low",
        sources="",
    ),
    dict(
        category="IKEA Food & Swedish restaurant",
        theme_label="Descriptive Swedish food/flavor words",
        theme_description="Not part of the classic furniture-naming-convention lore. Empirically these are plain descriptive Swedish words for the food item/flavor itself (e.g. CHOKLAD MORK = 'dark chocolate', SYLT HALLON = 'raspberry jam') rather than an arbitrary product-line name.",
        confidence="medium",
        sources="derived from data/processed/products_us2025_extract.csv rather than an external citation",
    ),
    dict(
        category="Pet accessories",
        theme_label="Undocumented",
        theme_description="No documented naming rule found; a newer product category not covered by the classic naming convention sources.",
        confidence="low",
        sources="",
    ),
]


def main():
    all_rows = (
        [{"category_system": "sa_furniture_category", **r} for r in SA_ROWS]
        + [{"category_system": "us_department", **r} for r in US_ROWS]
    )
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"Wrote {len(all_rows)} rows to {OUT} ({len(SA_ROWS)} sa_furniture_category + {len(US_ROWS)} us_department)")


if __name__ == "__main__":
    main()
