"""
Export data/konneksjons.db to human-eyeball-friendly formats:
  - data/export/konneksjons.xlsx   (one sheet per table)
  - data/export/csv/<table>.csv    (one CSV per table)

Run this any time after build_db.py to get a fresh look at the data.
Never edit data/export/* by hand - it's regenerated output, not source data.
"""
import csv
import sqlite3
from pathlib import Path

from openpyxl import Workbook

BASE = Path(__file__).parent.parent
DB_PATH = BASE / "data" / "konneksjons.db"
EXPORT_DIR = BASE / "data" / "export"
CSV_DIR = EXPORT_DIR / "csv"
XLSX_PATH = EXPORT_DIR / "konneksjons.xlsx"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    tables = [r[0] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )]

    CSV_DIR.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    wb.remove(wb.active)

    for table in tables:
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        cols = rows[0].keys() if rows else [d[0] for d in conn.execute(f"SELECT * FROM {table} LIMIT 0").description]

        csv_path = CSV_DIR / f"{table}.csv"
        with csv_path.open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for row in rows:
                w.writerow([row[c] for c in cols])

        ws = wb.create_sheet(title=table[:31])
        ws.append(list(cols))
        for row in rows:
            ws.append([row[c] for c in cols])

        print(f"  {table}: {len(rows)} rows -> {csv_path.relative_to(BASE)}")

    try:
        wb.save(XLSX_PATH)
        print(f"Wrote {XLSX_PATH.relative_to(BASE)}")
    except PermissionError:
        print(f"SKIPPED {XLSX_PATH.relative_to(BASE)} - file is open (e.g. in Excel). Close it and rerun this script.")
    conn.close()


if __name__ == "__main__":
    main()
