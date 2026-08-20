"""
Seed a webapp database with a small hand-authored fixture.

This is NOT derived from data/konneksjons.db - it's a standalone mock dataset
(~10 groups, ~50 words) sized for exercising the puzzle generator and
conflict-avoidance logic during app development, decoupled from the real
research pipeline's completeness or correctness. See the webapp plan, "Local
dev: mock dataset, not the real pipeline".

Assumes the target tables already exist - run `pnpm db:push` (from web/) to
create them from db/schema.ts before running this script.

Targets web/local.db by default. If TURSO_DATABASE_URL (and
TURSO_AUTH_TOKEN) are set in the environment, targets that Turso database
instead - e.g. so the freshly-deployed site has something playable.

Reads:
  (nothing - fixture data is defined inline below)
Writes:
  content_words, content_groups, content_group_members,
  content_group_conflicts (game-state tables are left untouched)
"""
from pathlib import Path

from turso_http import get_connection

BASE = Path(__file__).parent.parent
DB_PATH = BASE / "web" / "local.db"

# Mix of group sizes (some near the 4-word minimum, some larger) so sampling
# logic actually gets exercised.
GROUPS = [
    {
        "group_id": "swedish-place-names",
        "label": "Swedish place names",
        "description": "Products named after towns and regions in Sweden",
        "difficulty_hint": 2,
        "members": [
            ("malm", "MALM"),
            ("kallax", "KALLAX"),
            ("hemnes", "HEMNES"),
            ("lack", "LACK"),
            ("bjorkudden", "BJÖRKUDDEN"),
        ],
    },
    {
        "group_id": "sofas-armchairs",
        "label": "Sofas & armchairs",
        "description": "Products from IKEA's sofa and armchair category",
        "difficulty_hint": 1,
        "members": [
            ("klippan", "KLIPPAN"),
            ("ektorp", "EKTORP"),
            ("soderhamn", "SÖDERHAMN"),
            ("poang", "POÄNG"),
            ("strandmon", "STRANDMON"),
            ("vimle", "VIMLE"),
        ],
    },
    {
        "group_id": "boy-names",
        "label": "Scandinavian boys' names",
        "description": "Products named after (mostly) Scandinavian male first names",
        "difficulty_hint": 3,
        "members": [
            ("billy", "BILLY"),
            ("sten", "STEN"),
            ("gunnar", "GUNNAR"),
            ("erik", "ERIK"),
            ("oskar", "OSKAR"),
        ],
    },
    {
        "group_id": "kitchen-verbs",
        "label": "Kitchen-related verbs",
        "description": "Products named after everyday Swedish verbs",
        "difficulty_hint": 4,
        "members": [
            ("blanda", "BLANDA"),
            ("smaka", "SMAKA"),
            ("koka", "KOKA"),
            ("servera", "SERVERA"),
        ],
    },
    {
        "group_id": "storage-furniture",
        "label": "Storage furniture",
        "description": "Products from IKEA's storage & organization category",
        "difficulty_hint": 1,
        "members": [
            ("kallax-storage", "KALLAX"),
            ("besta", "BESTÅ"),
            ("pax", "PAX"),
            ("trofast", "TROFAST"),
            ("algot", "ALGOT"),
            ("ivar", "IVAR"),
        ],
    },
    {
        "group_id": "weather-words",
        "label": "Weather words",
        "description": "Products named after weather phenomena",
        "difficulty_hint": 3,
        "members": [
            ("sol", "SOL"),
            ("regn", "REGN"),
            ("snofsig", "SNÖFSIG"),
            ("vind", "VIND"),
            ("dimma", "DIMMA"),
        ],
    },
    {
        "group_id": "girl-names",
        "label": "Scandinavian girls' names",
        "description": "Products named after (mostly) Scandinavian female first names",
        "difficulty_hint": 2,
        "members": [
            ("linnea", "LINNEA"),
            ("hilda", "HILDA"),
            ("greta", "GRETA"),
            ("alva", "ALVA"),
        ],
    },
    {
        "group_id": "numbers-in-disguise",
        "label": "Sound like numbers",
        "description": "Product names that sound like (or contain) numbers, wordplay group",
        "difficulty_hint": 4,
        "members": [
            ("tvarsno", "TVÄRSNÖ"),
            ("fyrkantig", "FYRKANTIG"),
            ("femton", "FEMTON"),
            ("attring", "ÅTTRING"),
        ],
    },
    {
        "group_id": "textiles",
        "label": "Textiles",
        "description": "Products from IKEA's textile category",
        "difficulty_hint": 2,
        "members": [
            ("gunnvor", "GUNNVOR"),
            ("majsmaskros", "MAJSMASKROS"),
            ("ranunkel", "RANUNKEL"),
            ("gulsporre", "GULSPORRE"),
            ("aina", "AINA"),
        ],
    },
    {
        "group_id": "lighting",
        "label": "Lighting",
        "description": "Products from IKEA's lighting category",
        "difficulty_hint": 3,
        "members": [
            ("fado", "FADO"),
            ("hektar", "HEKTAR"),
            ("ranarp", "RANARP"),
            ("nymane", "NYMÅNE"),
            ("skaftet", "SKAFTET"),
        ],
    },
]

# Deliberate conflict pair, declared explicitly (not derived from shared word
# ids) - mirrors how the real pipeline flags two groups that shouldn't appear
# in the same puzzle (see plan, naming_convention/category overlap). KALLAX
# appears in both groups under separate word ids on purpose, so this conflict
# can't be caught by "no duplicate word" logic alone.
CONFLICT_PAIRS = [("swedish-place-names", "storage-furniture")]


def main():
    conn = get_connection(DB_PATH)
    conn.execute("DELETE FROM content_group_conflicts")
    conn.execute("DELETE FROM content_group_members")
    conn.execute("DELETE FROM content_groups")
    conn.execute("DELETE FROM content_words")

    words = {}
    for g in GROUPS:
        for word_id, display_text in g["members"]:
            words[word_id] = display_text

    conn.executemany(
        "INSERT INTO content_words (word_id, display_text) VALUES (?, ?)",
        list(words.items()),
    )

    conn.executemany(
        "INSERT INTO content_groups (group_id, label, description, difficulty_hint, admin_tag) "
        "VALUES (?, ?, ?, ?, ?)",
        [
            (g["group_id"], g["label"], g["description"], g["difficulty_hint"], "dev-fixture")
            for g in GROUPS
        ],
    )

    conn.executemany(
        "INSERT INTO content_group_members (group_id, word_id) VALUES (?, ?)",
        [(g["group_id"], word_id) for g in GROUPS for word_id, _ in g["members"]],
    )

    conflict_rows = []
    for a, b in CONFLICT_PAIRS:
        conflict_rows.append((a, b))
        conflict_rows.append((b, a))
    conn.executemany(
        "INSERT INTO content_group_conflicts (group_id_a, group_id_b) VALUES (?, ?)",
        conflict_rows,
    )

    conn.commit()
    conn.close()

    print(f"Seeded {len(words)} words across {len(GROUPS)} groups, {len(CONFLICT_PAIRS)} conflict pair(s).")


if __name__ == "__main__":
    main()
