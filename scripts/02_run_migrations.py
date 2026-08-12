"""
Database migration runner for Restaurant POS V2.
- Reads SQL files from /home/z/my-project/db/migrations/
- Applies them in order to oshxona_erp_v2 database
- Records each applied migration in __migrations table
- Idempotent: re-running skips already-applied migrations
- Uses transactions per file (DDL + DML atomic where TiDB supports)

Usage:
    python3 /home/z/my-project/scripts/02_run_migrations.py
"""
import pymysql
import hashlib
import os
import sys
import glob
import re

DB_CONFIG = {
    "host": "gateway01.eu-central-1.prod.aws.tidbcloud.com",
    "port": 4000,
    "user": "3YTK6Em4WhtFiqF.root",
    "password": "ovAH3n3bu2YabeK0",
    "database": "oshxona_erp_v2",
    "charset": "utf8mb4",
}

MIGRATIONS_DIR = "/home/z/my-project/db/migrations"

def split_sql_statements(sql_text: str):
    """
    Naive SQL splitter that respects:
    - ' and " string literals
    -- line comments
    /* */ block comments
    DELIMITER // ... // blocks (for stored procedures)
    """
    statements = []
    i = 0
    n = len(sql_text)
    current_stmt = []
    current_delim = ";"
    in_squote = False
    in_dquote = False
    in_line_comment = False
    in_block_comment = False

    while i < n:
        ch = sql_text[i]
        nxt = sql_text[i+1] if i+1 < n else ""

        # Handle DELIMITER directive
        if not in_squote and not in_dquote and not in_block_comment:
            if sql_text[i:i+10].upper() == "DELIMITER ":
                # Find newline
                nl = sql_text.find("\n", i)
                if nl == -1:
                    nl = n
                delim_line = sql_text[i+10:nl].strip()
                # Save current statement if any
                if current_stmt and "".join(current_stmt).strip():
                    statements.append("".join(current_stmt).strip())
                    current_stmt = []
                current_delim = delim_line
                i = nl + 1
                continue

            # Check if we hit current delimiter
            if not in_line_comment:
                if sql_text[i:i+len(current_delim)] == current_delim:
                    stmt = "".join(current_stmt).strip()
                    if stmt:
                        statements.append(stmt)
                    current_stmt = []
                    i += len(current_delim)
                    continue

        # Line comment start
        if not in_squote and not in_dquote and not in_block_comment:
            if ch == "-" and nxt == "-":
                in_line_comment = True

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        # Block comment start
        if not in_squote and not in_dquote and not in_block_comment:
            if ch == "/" and nxt == "*":
                in_block_comment = True
                current_stmt.append("/* ")
                i += 2
                continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                current_stmt.append(" */")
                in_block_comment = False
                i += 2
                continue
            current_stmt.append(ch)
            i += 1
            continue

        # String literals
        if ch == "'" and not in_dquote:
            in_squote = not in_squote
        elif ch == '"' and not in_squote:
            in_dquote = not in_dquote
        elif ch == "\\" and (in_squote or in_dquote):
            current_stmt.append(ch)
            if i+1 < n:
                current_stmt.append(sql_text[i+1])
                i += 2
                continue

        current_stmt.append(ch)
        i += 1

    final = "".join(current_stmt).strip()
    if final:
        statements.append(final)

    return statements


def get_file_checksum(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def ensure_migrations_table(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS `__migrations` (
              `id` INT NOT NULL AUTO_INCREMENT,
              `version` VARCHAR(40) NOT NULL,
              `name` VARCHAR(200) NOT NULL,
              `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              `checksum` CHAR(64) NOT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `uq_migrations_version` (`version`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        conn.commit()


def get_applied_migrations(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT version, checksum FROM __migrations")
        return {row[0]: row[1] for row in cur.fetchall()}


def main():
    print(f"=== Restaurant POS V2 — Migration Runner ===")
    print(f"DB: {DB_CONFIG['database']} @ {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"Dir: {MIGRATIONS_DIR}")
    print()

    sql_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    if not sql_files:
        print("No migration files found.")
        sys.exit(0)

    try:
        conn = pymysql.connect(**DB_CONFIG, ssl=None)
    except Exception as e:
        print(f"Connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    ensure_migrations_table(conn)
    applied = get_applied_migrations(conn)

    print(f"Already applied: {len(applied)} migrations")
    print(f"Pending files:   {len(sql_files)} total")
    print()

    success_count = 0
    skip_count = 0
    fail_count = 0

    for filepath in sql_files:
        filename = os.path.basename(filepath)
        version = filename.replace(".sql", "")
        checksum = get_file_checksum(filepath)

        if version in applied:
            if applied[version] == checksum:
                print(f"  SKIP {filename} (already applied)")
                skip_count += 1
                continue
            else:
                print(f"  WARN {filename} checksum changed — re-applying is NOT automatic")
                print(f"       stored={applied[version][:16]}... new={checksum[:16]}...")
                # We do NOT re-apply DDL migrations automatically — that could break things.
                skip_count += 1
                continue

        print(f"  APPLY {filename}")
        with open(filepath, "r", encoding="utf-8") as f:
            sql_text = f.read()

        statements = split_sql_statements(sql_text)
        print(f"         {len(statements)} statements")

        try:
            with conn.cursor() as cur:
                for i, stmt in enumerate(statements, 1):
                    stmt_clean = stmt.strip()
                    if not stmt_clean or stmt_clean.startswith("--"):
                        continue
                    try:
                        cur.execute(stmt_clean)
                    except pymysql.err.Error as e:
                        # Skip "already exists" / "duplicate" errors for idempotency
                        msg = str(e).lower()
                        if any(s in msg for s in ["already exists", "duplicate entry", "can't drop", "exists"]):
                            # Idempotent skip
                            continue
                        else:
                            print(f"         STMT {i} failed: {e}")
                            print(f"         STMT preview: {stmt_clean[:200]}...")
                            raise

                # Record migration
                name = filename.replace(".sql", "").split("_", 1)[-1] if "_" in filename else filename
                cur.execute(
                    "INSERT INTO __migrations (version, name, checksum) VALUES (%s, %s, %s)",
                    (version, name, checksum)
                )
                conn.commit()
            print(f"         OK")
            success_count += 1
        except Exception as e:
            conn.rollback()
            print(f"         FAILED: {e}")
            fail_count += 1
            # Continue with next file (do not abort all)
            # But for initial run, abort on first failure to be safe
            if success_count == 0:
                print(f"\nAborting: first migration failed")
                break

    print()
    print(f"=== Summary ===")
    print(f"  Applied: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Failed:  {fail_count}")

    conn.close()
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
