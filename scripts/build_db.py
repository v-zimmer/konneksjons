"""
Assemble data/konneksjons.db (SQLite) from the processed CSVs.

The CSVs under data/processed/ are the source of truth for this research
phase. This script is fully idempotent: it always drops and rebuilds the
database from scratch, so the .db file itself never needs to be hand-edited
or "protected" - if it ever gets into a weird state, just delete it and
rerun this script. (Real backups live in git history on the CSVs.)
"""
import csv
import sqlite3
from pathlib import Path

BASE = Path(__file__).parent.parent
PROCESSED = BASE / "data" / "processed"
DB_PATH = BASE / "data" / "konneksjons.db"

SCHEMA = """
CREATE TABLE products (
    product_id          TEXT PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    categories           TEXT,
    num_categories       INTEGER,
    num_listings         INTEGER,
    designers            TEXT,
    price_min_sar        REAL,
    price_max_sar        REAL,
    sellable_online_any  INTEGER,
    has_color_variants    INTEGER,
    sample_description   TEXT,
    sample_link          TEXT,
    word_count           INTEGER,
    char_len             INTEGER
);

CREATE TABLE meanings (
    name                 TEXT PRIMARY KEY REFERENCES products(name),
    literal_meaning_en   TEXT,
    language_origin      TEXT,
    word_type            TEXT,
    confidence           TEXT,
    notes                TEXT
);

CREATE TABLE naming_conventions (
    category             TEXT PRIMARY KEY,
    theme_label           TEXT,
    theme_description     TEXT,
    confidence            TEXT,
    sources               TEXT
);

CREATE TABLE groups (
    group_id             TEXT PRIMARY KEY,
    grouping_type         TEXT NOT NULL,
    label                 TEXT,
    description           TEXT,
    confidence            TEXT
);

CREATE TABLE group_members (
    group_id             TEXT NOT NULL REFERENCES groups(group_id),
    product_id            TEXT NOT NULL REFERENCES products(product_id),
    name                  TEXT NOT NULL,
    PRIMARY KEY (group_id, product_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_product ON group_members(product_id);
CREATE INDEX idx_groups_type ON groups(grouping_type);
"""

BOOL_COLS = {"sellable_online_any", "has_color_variants"}
INT_COLS = {"num_categories", "num_listings", "word_count", "char_len"}
FLOAT_COLS = {"price_min_sar", "price_max_sar"}


def load_csv(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def coerce(col, val):
    if val == "" or val is None:
        return None
    if col in BOOL_COLS:
        return 1 if val.strip().lower() == "true" else 0
    if col in INT_COLS:
        return int(val)
    if col in FLOAT_COLS:
        return float(val)
    return val


def insert_rows(conn, table, rows):
    if not rows:
        return
    cols = list(rows[0].keys())
    placeholders = ",".join("?" for _ in cols)
    sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})"
    conn.executemany(sql, [tuple(coerce(c, r[c]) for c in cols) for r in rows])


def main():
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    products = load_csv(PROCESSED / "products.csv")
    meanings = load_csv(PROCESSED / "meanings.csv")
    naming = load_csv(PROCESSED / "naming_conventions.csv")
    groups = load_csv(PROCESSED / "groups.csv")
    members = load_csv(PROCESSED / "group_members.csv")

    insert_rows(conn, "products", products)
    insert_rows(conn, "meanings", meanings)
    insert_rows(conn, "naming_conventions", naming)
    insert_rows(conn, "groups", groups)
    insert_rows(conn, "group_members", members)

    conn.commit()

    counts = {}
    for table in ["products", "meanings", "naming_conventions", "groups", "group_members"]:
        counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    conn.close()

    print(f"Built {DB_PATH}")
    for table, n in counts.items():
        print(f"  {table}: {n} rows")


if __name__ == "__main__":
    main()
