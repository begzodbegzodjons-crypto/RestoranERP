"""
Inspect existing production TiDB schema.
Lists all tables, columns, indexes, constraints.
This is READ-ONLY — does NOT modify anything.
"""
import pymysql
import json
import sys

# Production credentials from previous conversation context
DB_CONFIG = {
    "host": "gateway01.eu-central-1.prod.aws.tidbcloud.com",
    "port": 4000,
    "user": "3YTK6Em4WhtFiqF.root",
    "password": "ovAH3n3bu2YabeK0",
    "database": "oshxona_erp",
    "ssl": {"ca": None},  # TiDB serverless requires TLS but pymysql auto-negotiates
    "charset": "utf8mb4",
}

def main():
    try:
        conn = pymysql.connect(**DB_CONFIG, ssl_disabled=False)
    except pymysql.err.OperationalError as e:
        # Try without explicit ssl dict
        try:
            conn = pymysql.connect(
                host=DB_CONFIG["host"],
                port=DB_CONFIG["port"],
                user=DB_CONFIG["user"],
                password=DB_CONFIG["password"],
                database=DB_CONFIG["database"],
                charset="utf8mb4",
                ssl=None,
            )
        except Exception as e2:
            print(f"Connection failed: {e2}", file=sys.stderr)
            sys.exit(1)

    cur = conn.cursor()

    # 1. List all tables
    cur.execute("""
        SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = %s
        ORDER BY TABLE_NAME
    """, (DB_CONFIG["database"],))
    tables = cur.fetchall()

    print(f"=== EXISTING TABLES IN '{DB_CONFIG['database']}' ({len(tables)} tables) ===")
    for t_name, t_rows, t_comment in tables:
        print(f"  - {t_name:35s}  rows={t_rows or 0:8d}   comment={t_comment or ''}")

    # 2. For each table, show columns and indexes
    schema_dump = {}
    for t_name, _, _ in tables:
        cur.execute("""
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY,
                   COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """, (DB_CONFIG["database"], t_name))
        cols = cur.fetchall()

        cur.execute("""
            SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX),
                   NON_UNIQUE, INDEX_TYPE
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            GROUP BY INDEX_NAME, NON_UNIQUE, INDEX_TYPE
            ORDER BY INDEX_NAME
        """, (DB_CONFIG["database"], t_name))
        idxs = cur.fetchall()

        schema_dump[t_name] = {
            "columns": [
                {"name": c[0], "type": c[1], "nullable": c[2], "key": c[3],
                 "default": c[4], "extra": c[5], "comment": c[6]}
                for c in cols
            ],
            "indexes": [
                {"name": i[0], "columns": i[1], "non_unique": i[2], "type": i[3]}
                for i in idxs
            ]
        }

    # 3. Show foreign keys
    cur.execute("""
        SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = %s AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY TABLE_NAME
    """, (DB_CONFIG["database"],))
    fks = cur.fetchall()

    # 4. Save dump to file
    out_path = "/home/z/my-project/db/existing_schema_dump.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"tables": schema_dump, "foreign_keys": [
            {"table": f[0], "column": f[1], "constraint": f[2],
             "ref_table": f[3], "ref_column": f[4]}
            for f in fks
        ]}, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n=== FOREIGN KEYS ({len(fks)}) ===")
    for f in fks:
        print(f"  {f[0]}.{f[1]} → {f[3]}.{f[4]}  (constraint: {f[2]})")

    print(f"\nSaved full schema dump to: {out_path}")
    print(f"Total tables: {len(tables)}")
    print(f"Total foreign keys: {len(fks)}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
