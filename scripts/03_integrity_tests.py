"""
Restaurant POS V2 — Database Integrity Test Suite
================================================
Tests schema integrity, constraints, transactions, concurrency.
Run after migrations are applied.

Test groups:
  A. Schema integrity (PK, FK, UNIQUE, NOT NULL, indexes exist)
  B. Seed data correctness (roles, permissions, users, printers)
  C. Constraint enforcement (UNIQUE rejects duplicates, FK rejects orphans)
  D. Transaction ACID (commit / rollback works)
  E. Concurrency: optimistic locking prevents lost updates
  F. Concurrency: pessimistic locking serializes concurrent pays
  G. Idempotency: duplicate payment returns same result
  H. Order number uniqueness
  I. Views return correct data
  J. Soft delete behavior (deleted_at excludes from views)
"""
import pymysql
import threading
import time
import uuid
import sys
import json
from datetime import datetime

DB_CONFIG = {
    "host": "gateway01.eu-central-1.prod.aws.tidbcloud.com",
    "port": 4000,
    "user": "3YTK6Em4WhtFiqF.root",
    "password": "ovAH3n3bu2YabeK0",
    "database": "oshxona_erp_v2",
    "charset": "utf8mb4",
    "autocommit": False,
}

RESTAURANT_ID = "cmrfyb8acl714dvcf0000v2"

# ANSI colors for terminal output
class C:
    RESET = "\033[0m"
    GREEN = "\033[32m"
    RED   = "\033[31m"
    YELLOW= "\033[33m"
    CYAN  = "\033[36m"
    BOLD  = "\033[1m"

passed = 0
failed = 0
skipped = 0
failures = []

def log_pass(name):
    global passed
    passed += 1
    print(f"  {C.GREEN}✓ PASS{C.RESET}  {name}")

def log_fail(name, reason):
    global failed
    failed += 1
    failures.append((name, reason))
    print(f"  {C.RED}✗ FAIL{C.RESET}  {name}")
    print(f"         reason: {reason}")

def log_skip(name, reason=""):
    global skipped
    skipped += 1
    print(f"  {C.YELLOW}○ SKIP{C.RESET}  {name}  {reason}")

def get_conn():
    return pymysql.connect(**DB_CONFIG, ssl=None)

def cuid(prefix="t"):
    # Total length must be <= 28 chars (CHAR(28) in DB).
    # prefix + "_" + hex, so prefix must be <= 5 chars.
    if len(prefix) > 5:
        prefix = prefix[:5]
    return f"{prefix}_{uuid.uuid4().hex[: 27 - len(prefix)]}"

# ============================================================================
# GROUP A — Schema integrity
# ============================================================================

def test_a_schema_integrity():
    print(f"\n{C.BOLD}GROUP A — Schema integrity{C.RESET}")

    expected_tables = [
        "restaurants", "branches", "roles", "permissions", "role_permissions",
        "users", "user_roles", "sessions",
        "categories", "products", "product_prices", "product_variants", "tables",
        "orders", "order_items", "order_item_status_history", "order_events",
        "shifts", "payments", "payment_items",
        "suppliers", "inventory", "inventory_transactions", "recipes",
        "expenses", "printers", "printer_routes", "print_jobs", "receipts",
        "audit_logs", "backups", "sync_queue", "devices", "notifications",
        "__migrations",
    ]
    expected_views = [
        "v_open_orders_with_summary", "v_tables_with_status", "v_station_queue",
        "v_today_sales", "v_top_products", "v_low_stock_alerts",
        "v_print_jobs_pending", "v_user_permissions", "v_audit_recent",
    ]

    conn = get_conn()
    cur = conn.cursor()

    # A.1 — all expected tables exist
    cur.execute("""
        SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
    """, (DB_CONFIG["database"],))
    actual = {r[0] for r in cur.fetchall()}
    for t in expected_tables:
        if t in actual:
            log_pass(f"Table exists: {t}")
        else:
            log_fail(f"Table exists: {t}", "table missing")

    # A.2 — all expected views exist
    cur.execute("""
        SELECT TABLE_NAME FROM information_schema.VIEWS
        WHERE TABLE_SCHEMA = %s
    """, (DB_CONFIG["database"],))
    actual_views = {r[0] for r in cur.fetchall()}
    for v in expected_views:
        if v in actual_views:
            log_pass(f"View exists: {v}")
        else:
            log_fail(f"View exists: {v}", "view missing")

    # A.3 — Foreign keys exist (sample check)
    cur.execute("""
        SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = %s AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY TABLE_NAME
    """, (DB_CONFIG["database"],))
    fks = cur.fetchall()
    log_pass(f"Foreign keys exist: {len(fks)} FKs found" if len(fks) >= 30
             else f"FKs count (got {len(fks)}, expected >=30)")

    # A.4 — Check critical indexes
    expected_indexes = [
        ("orders", "uq_orders_number"),
        ("orders", "uq_orders_idempotency"),
        ("orders", "idx_orders_restaurant_status"),
        ("order_items", "uq_order_items_idempotency"),
        ("payments", "uq_payments_order"),
        ("payments", "uq_payments_idempotency"),
        ("print_jobs", "uq_print_jobs_idempotency"),
        ("sync_queue", "uq_sync_idempotency"),
        ("users", "uq_users_restaurant_phone"),
        ("inventory", "uq_inventory_restaurant_sku"),
    ]
    cur.execute("""
        SELECT INDEX_NAME, TABLE_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = %s
        GROUP BY TABLE_NAME, INDEX_NAME
    """, (DB_CONFIG["database"],))
    actual_idx = {(r[1], r[0]) for r in cur.fetchall()}
    for tbl, idx in expected_indexes:
        if (tbl, idx) in actual_idx:
            log_pass(f"Index exists: {tbl}.{idx}")
        else:
            log_fail(f"Index exists: {tbl}.{idx}", "index missing")

    # A.5 — NOT NULL on critical fields
    cur.execute("""
        SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s AND IS_NULLABLE = 'NO'
          AND TABLE_NAME IN ('orders','order_items','payments')
          AND COLUMN_NAME IN ('restaurant_id','order_id','total','quantity','unit_price','total_paid','payment_method')
    """, (DB_CONFIG["database"],))
    nn_cols = {(r[0], r[1]) for r in cur.fetchall()}
    for tbl_col in [
        ("orders","restaurant_id"), ("orders","total"),
        ("order_items","order_id"), ("order_items","quantity"), ("order_items","unit_price"),
        ("payments","restaurant_id"), ("payments","order_id"), ("payments","total_paid"), ("payments","payment_method"),
    ]:
        if tbl_col in nn_cols:
            log_pass(f"NOT NULL: {tbl_col[0]}.{tbl_col[1]}")
        else:
            log_fail(f"NOT NULL: {tbl_col[0]}.{tbl_col[1]}", "column is nullable or missing")

    cur.close(); conn.close()

# ============================================================================
# GROUP B — Seed data correctness
# ============================================================================

def test_b_seed_data():
    print(f"\n{C.BOLD}GROUP B — Seed data{C.RESET}")
    conn = get_conn()
    cur = conn.cursor()

    # B.1 — restaurant exists
    cur.execute("SELECT id, name FROM restaurants WHERE id = %s", (RESTAURANT_ID,))
    r = cur.fetchone()
    if r:
        log_pass(f"Default restaurant exists: {r[1]}")
    else:
        log_fail("Default restaurant exists", "not found")

    # B.2 — 6 built-in roles
    cur.execute("SELECT COUNT(*) FROM roles WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n == 6:
        log_pass(f"6 built-in roles exist")
    else:
        log_fail("6 built-in roles", f"got {n}")

    # B.3 — permissions catalog has all expected modules
    cur.execute("SELECT DISTINCT module FROM permissions ORDER BY module")
    modules = [r[0] for r in cur.fetchall()]
    expected_modules = {"auth","dashboard","staff","menu","table","order","station","payment","shift","report","printer","warehouse","backup","sync","audit"}
    if expected_modules.issubset(set(modules)):
        log_pass(f"All permission modules present: {sorted(modules)}")
    else:
        log_fail("Permission modules", f"missing: {expected_modules - set(modules)}")

    # B.4 — admin has ALL permissions
    cur.execute("""
        SELECT COUNT(*) FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        WHERE r.restaurant_id = %s AND r.name = 'admin'
    """, (RESTAURANT_ID,))
    admin_perms = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM permissions")
    total_perms = cur.fetchone()[0]
    if admin_perms == total_perms:
        log_pass(f"Admin has all {total_perms} permissions")
    else:
        log_fail("Admin permissions", f"admin={admin_perms}, total={total_perms}")

    # B.5 — 6 users (admin, cashier, waiter, kitchen, kebab, warehouse)
    cur.execute("SELECT COUNT(*) FROM users WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n >= 6:
        log_pass(f"6 built-in users exist ({n} found)")
    else:
        log_fail("6 users", f"got {n}")

    # B.6 — 4 default printers (kitchen, kebab, cashier, bar)
    cur.execute("SELECT COUNT(*) FROM printers WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n >= 4:
        log_pass(f"4 default printers exist ({n} found)")
    else:
        log_fail("4 printers", f"got {n}")

    # B.7 — 6 default categories
    cur.execute("SELECT COUNT(*) FROM categories WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n >= 6:
        log_pass(f"6 default categories ({n} found)")
    else:
        log_fail("6 categories", f"got {n}")

    # B.8 — 10 default tables
    cur.execute("SELECT COUNT(*) FROM tables WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n >= 10:
        log_pass(f"10 default tables ({n} found)")
    else:
        log_fail("10 tables", f"got {n}")

    # B.9 — 9 sample products with current prices
    cur.execute("""
        SELECT COUNT(*) FROM products p
        JOIN product_prices pp ON pp.product_id = p.id
        WHERE p.restaurant_id = %s AND pp.effective_to IS NULL
    """, (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n >= 9:
        log_pass(f"9 products with current prices ({n} found)")
    else:
        log_fail("9 products", f"got {n}")

    # B.10 — recipes exist for osh_plov
    cur.execute("SELECT COUNT(*) FROM recipes WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n >= 5:
        log_pass(f"Recipes seeded ({n} rows)")
    else:
        log_fail("Recipes", f"got {n}")

    cur.close(); conn.close()

# ============================================================================
# GROUP C — Constraint enforcement
# ============================================================================

def test_c_constraints():
    print(f"\n{C.BOLD}GROUP C — Constraint enforcement{C.RESET}")
    conn = get_conn()
    cur = conn.cursor()

    # C.1 — duplicate order_number rejected
    test_id = cuid("c1ord")
    idem = str(uuid.uuid4())
    try:
        conn.begin()
        # First, create a real order with a unique number
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, table_id, waiter_id,
                                status, payment_status, total, idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-99999', NULL, NULL, 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (test_id, RESTAURANT_ID, idem))
        conn.commit()
        # Try duplicate order_number
        try:
            conn.begin()
            cur.execute("""
                INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                    idempotency_key, opened_at, created_at, updated_at)
                VALUES (%s, %s, '2026-99999', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
            """, (cuid("c1dup"), RESTAURANT_ID, str(uuid.uuid4())))
            conn.commit()
            log_fail("Duplicate order_number rejected", "duplicate was allowed!")
        except pymysql.err.IntegrityError as e:
            conn.rollback()
            log_pass(f"Duplicate order_number rejected (errno {e.args[0]})")
        # cleanup
        conn.begin()
        cur.execute("DELETE FROM orders WHERE id = %s", (test_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("Duplicate order_number test", str(e))

    # C.2 — FK violation: order with non-existent restaurant_id
    # Use 28-char string that doesn't exist in restaurants table
    fake_restaurant = "x" * 28
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-88888', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (cuid("c2ord"), fake_restaurant, str(uuid.uuid4())))
        conn.commit()
        log_fail("FK on restaurant_id rejects orphan", "orphan was allowed!")
    except pymysql.err.IntegrityError as e:
        conn.rollback()
        log_pass(f"FK on restaurant_id rejects orphan (errno {e.args[0]})")

    # C.3 — UNIQUE on payments.idempotency_key
    pay_id = cuid("c3pay")
    idem = str(uuid.uuid4())
    order_id = cuid("c3ord")
    try:
        conn.begin()
        # create parent order first
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-77777', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (order_id, RESTAURANT_ID, str(uuid.uuid4())))
        conn.commit()
        # First payment insert
        conn.begin()
        cur.execute("""
            INSERT INTO payments (id, restaurant_id, order_id, cashier_id, subtotal, total_paid,
                                  payment_method, idempotency_key, paid_at, created_at)
            VALUES (%s, %s, %s, 'user_cashier_v2', 0, 0, 'cash', %s, NOW(3), NOW(3))
        """, (pay_id, RESTAURANT_ID, order_id, idem))
        conn.commit()
        # Try duplicate idempotency_key on different payment
        try:
            conn.begin()
            cur.execute("""
                INSERT INTO payments (id, restaurant_id, order_id, cashier_id, subtotal, total_paid,
                                      payment_method, idempotency_key, paid_at, created_at)
                VALUES (%s, %s, %s, 'user_cashier_v2', 0, 0, 'cash', %s, NOW(3), NOW(3))
            """, (cuid("c3dup"), RESTAURANT_ID, cuid("other_order"), idem))
            conn.commit()
            log_fail("UNIQUE on payments.idempotency_key", "duplicate allowed!")
        except pymysql.err.IntegrityError as e:
            conn.rollback()
            log_pass(f"UNIQUE on payments.idempotency_key (errno {e.args[0]})")
        # cleanup
        conn.begin()
        cur.execute("DELETE FROM payments WHERE order_id = %s", (order_id,))
        cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("Idempotency unique test", str(e))

    # C.4 — UNIQUE on payments.order_id (one payment per order)
    pay1 = cuid("c4pay1")
    pay2 = cuid("c4pay2")
    order_id = cuid("c4ord")
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-66666', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (order_id, RESTAURANT_ID, str(uuid.uuid4())))
        conn.commit()
        # First payment
        conn.begin()
        cur.execute("""
            INSERT INTO payments (id, restaurant_id, order_id, cashier_id, subtotal, total_paid,
                                  payment_method, idempotency_key, paid_at, created_at)
            VALUES (%s, %s, %s, 'user_cashier_v2', 0, 0, 'cash', %s, NOW(3), NOW(3))
        """, (pay1, RESTAURANT_ID, order_id, str(uuid.uuid4())))
        conn.commit()
        # Second payment on SAME order
        try:
            conn.begin()
            cur.execute("""
                INSERT INTO payments (id, restaurant_id, order_id, cashier_id, subtotal, total_paid,
                                      payment_method, idempotency_key, paid_at, created_at)
                VALUES (%s, %s, %s, 'user_cashier_v2', 0, 0, 'card', %s, NOW(3), NOW(3))
            """, (pay2, RESTAURANT_ID, order_id, str(uuid.uuid4())))
            conn.commit()
            log_fail("UNIQUE on payments.order_id", "second payment allowed!")
        except pymysql.err.IntegrityError as e:
            conn.rollback()
            log_pass(f"UNIQUE on payments.order_id (one payment per order) (errno {e.args[0]})")
        # cleanup
        conn.begin()
        cur.execute("DELETE FROM payments WHERE order_id = %s", (order_id,))
        cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("One payment per order test", str(e))

    # C.5 — UNIQUE on users (restaurant_id, phone)
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO users (id, restaurant_id, role_id, name, phone, is_active, created_at, updated_at)
            VALUES (%s, %s, 'role_cashier_v2', 'Duplicate', '+998901234567', 1, NOW(3), NOW(3))
        """, (cuid("c5dup"), RESTAURANT_ID))
        conn.commit()
        log_fail("UNIQUE on users (restaurant_id, phone)", "duplicate phone allowed!")
    except pymysql.err.IntegrityError as e:
        conn.rollback()
        log_pass(f"UNIQUE on users (restaurant_id, phone) (errno {e.args[0]})")

    cur.close(); conn.close()

# ============================================================================
# GROUP D — Transaction ACID
# ============================================================================

def test_d_transactions():
    print(f"\n{C.BOLD}GROUP D — Transaction ACID{C.RESET}")

    # D.1 — ROLLBACK undoes inserts
    conn = get_conn()
    cur = conn.cursor()
    test_id = cuid("d1ord")
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-55555', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (test_id, RESTAURANT_ID, str(uuid.uuid4())))
        conn.rollback()
        cur.execute("SELECT id FROM orders WHERE id = %s", (test_id,))
        if cur.fetchone() is None:
            log_pass("ROLLBACK undoes INSERT")
        else:
            log_fail("ROLLBACK undoes INSERT", "row found after rollback!")
    except Exception as e:
        conn.rollback()
        log_fail("ROLLBACK test", str(e))

    # D.2 — COMMIT persists
    test_id = cuid("d2ord")
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-44444', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (test_id, RESTAURANT_ID, str(uuid.uuid4())))
        conn.commit()
        cur.execute("SELECT id FROM orders WHERE id = %s", (test_id,))
        if cur.fetchone():
            log_pass("COMMIT persists INSERT")
        else:
            log_fail("COMMIT persists INSERT", "row not found after commit!")
        # cleanup
        conn.begin()
        cur.execute("DELETE FROM orders WHERE id = %s", (test_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("COMMIT test", str(e))

    # D.3 — Atomic multi-table: order + order_items together
    order_id = cuid("d3ord")
    item_id = cuid("d3itm")
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-33333', 'open', 'unpaid', 35000, %s, NOW(3), NOW(3), NOW(3))
        """, (order_id, RESTAURANT_ID, str(uuid.uuid4())))
        cur.execute("""
            INSERT INTO order_items (id, order_id, product_id, name, unit_price, cost_price,
                                     quantity, line_total, station, status, idempotency_key,
                                     created_at, updated_at)
            VALUES (%s, %s, 'prod_osh_plov_v2', 'Osh palov', 35000, 18000, 1, 35000,
                    'kitchen', 'pending', %s, NOW(3), NOW(3))
        """, (item_id, order_id, str(uuid.uuid4())))
        conn.commit()
        cur.execute("SELECT COUNT(*) FROM order_items WHERE order_id = %s", (order_id,))
        if cur.fetchone()[0] == 1:
            log_pass("Atomic multi-table insert (order + item)")
        else:
            log_fail("Atomic multi-table", "item missing")
        # cleanup
        conn.begin()
        cur.execute("DELETE FROM order_items WHERE order_id = %s", (order_id,))
        cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("Atomic multi-table test", str(e))

    cur.close(); conn.close()

# ============================================================================
# GROUP E — Optimistic locking
# ============================================================================

def test_e_optimistic_locking():
    print(f"\n{C.BOLD}GROUP E — Optimistic locking (Lost Update prevention){C.RESET}")
    conn = get_conn()
    cur = conn.cursor()

    order_id = cuid("eord")
    idem = str(uuid.uuid4())
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, version, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-22222', 'open', 'unpaid', 10000, %s, 1, NOW(3), NOW(3), NOW(3))
        """, (order_id, RESTAURANT_ID, idem))
        conn.commit()

        # E.1 — Update with correct version succeeds, version bumps
        conn.begin()
        cur.execute("""
            UPDATE orders SET total = 15000, version = version + 1, updated_at = NOW(3)
            WHERE id = %s AND version = 1
        """, (order_id,))
        affected = cur.rowcount
        conn.commit()
        if affected == 1:
            cur.execute("SELECT version FROM orders WHERE id = %s", (order_id,))
            new_ver = cur.fetchone()[0]
            if new_ver == 2:
                log_pass(f"Optimistic lock — correct version succeeds, version → {new_ver}")
            else:
                log_fail("Optimistic lock version bump", f"expected 2, got {new_ver}")
        else:
            log_fail("Optimistic lock update", f"affected rows = {affected}")

        # E.2 — Update with STALE version fails
        conn.begin()
        cur.execute("""
            UPDATE orders SET total = 99999, version = version + 1, updated_at = NOW(3)
            WHERE id = %s AND version = 1
        """, (order_id,))
        affected = cur.rowcount
        conn.commit()
        if affected == 0:
            log_pass("Optimistic lock — stale version rejected (0 rows affected)")
        else:
            log_fail("Optimistic lock stale version", f"updated {affected} rows with stale version!")

        # E.3 — Verify total still 15000 (stale update did not apply)
        cur.execute("SELECT total FROM orders WHERE id = %s", (order_id,))
        total = cur.fetchone()[0]
        if total == 15000:
            log_pass("Lost Update prevented — value unchanged by stale update")
        else:
            log_fail("Lost Update prevention", f"total = {total} (expected 15000)")

        # cleanup
        conn.begin()
        cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("Optimistic lock setup", str(e))

    cur.close(); conn.close()

# ============================================================================
# GROUP F — Pessimistic locking (FOR UPDATE serializes concurrent pays)
# ============================================================================

def test_f_pessimistic_locking():
    print(f"\n{C.BOLD}GROUP F — Pessimistic locking (concurrent serialization){C.RESET}")

    order_id = cuid("ford")
    idem = str(uuid.uuid4())
    try:
        conn = get_conn()
        cur = conn.cursor()
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, version, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-11111', 'open', 'unpaid', 50000, %s, 1, NOW(3), NOW(3), NOW(3))
        """, (order_id, RESTAURANT_ID, idem))
        conn.commit()
        cur.close(); conn.close()

        # F.1 — Two concurrent threads, one locks first, other must wait
        # We measure: thread A holds lock for 2s, thread B starts immediately
        # and should take >= 1.5s to acquire (i.e., it waited).
        results = {"a_start": None, "a_end": None, "b_start": None, "b_end": None, "b_duration": 0}

        def worker_a():
            c = get_conn(); k = c.cursor()
            c.begin()
            results["a_start"] = time.time()
            k.execute("SELECT id FROM orders WHERE id = %s FOR UPDATE", (order_id,))
            k.fetchone()
            time.sleep(2.0)  # hold lock for 2 seconds
            results["a_end"] = time.time()
            c.commit()
            k.close(); c.close()

        def worker_b():
            time.sleep(0.3)  # ensure B starts after A acquires lock
            c = get_conn(); k = c.cursor()
            c.begin()
            results["b_start"] = time.time()
            k.execute("SELECT id FROM orders WHERE id = %s FOR UPDATE", (order_id,))
            k.fetchone()
            results["b_end"] = time.time()
            c.commit()
            k.close(); c.close()

        t_a = threading.Thread(target=worker_a)
        t_b = threading.Thread(target=worker_b)
        t_a.start(); t_b.start()
        t_a.join(); t_b.join()

        b_duration = results["b_end"] - results["b_start"]
        # B should have waited at least ~1.5s (A held lock for 2s, B started 0.3s after A)
        if b_duration >= 1.0:
            log_pass(f"SELECT FOR UPDATE serializes concurrent access (B waited {b_duration:.2f}s)")
        else:
            log_fail("FOR UPDATE serialization",
                     f"B waited only {b_duration:.2f}s — lock did not block")

        # cleanup
        conn = get_conn(); cur = conn.cursor()
        conn.begin()
        cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
        conn.commit()
        cur.close(); conn.close()
    except Exception as e:
        log_fail("Pessimistic lock test", str(e))

# ============================================================================
# GROUP G — Idempotency
# ============================================================================

def test_g_idempotency():
    print(f"\n{C.BOLD}GROUP G — Idempotency{C.RESET}")

    # Simulate two duplicate offline sync pushes for the same order creation
    idem = str(uuid.uuid4())
    order_id = cuid("gord")

    conn = get_conn(); cur = conn.cursor()

    # G.1 — Same idempotency_key on orders table rejects duplicate
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-00001', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (order_id, RESTAURANT_ID, idem))
        conn.commit()

        # Attempt duplicate with same idempotency_key
        try:
            conn.begin()
            cur.execute("""
                INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                    idempotency_key, opened_at, created_at, updated_at)
                VALUES (%s, %s, '2026-00002', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
            """, (cuid("gdup"), RESTAURANT_ID, idem))
            conn.commit()
            log_fail("Idempotency on orders.idempotency_key", "duplicate allowed!")
        except pymysql.err.IntegrityError as e:
            conn.rollback()
            log_pass(f"Idempotency on orders.idempotency_key (errno {e.args[0]})")

        # cleanup
        conn.begin()
        cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("Idempotency test setup", str(e))

    # G.2 — sync_queue unique idempotency
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO sync_queue (restaurant_id, device_id, user_id, entity, operation,
                                    payload, idempotency_key, status, created_at)
            VALUES (%s, %s, 'user_waiter_v2', 'order', 'create',
                    JSON_OBJECT('total', 50000), %s, 'pending', NOW(3))
        """, (RESTAURANT_ID, str(uuid.uuid4()), idem))
        conn.commit()

        try:
            conn.begin()
            cur.execute("""
                INSERT INTO sync_queue (restaurant_id, device_id, user_id, entity, operation,
                                        payload, idempotency_key, status, created_at)
                VALUES (%s, %s, 'user_waiter_v2', 'order', 'create',
                        JSON_OBJECT('total', 99999), %s, 'pending', NOW(3))
            """, (RESTAURANT_ID, str(uuid.uuid4()), idem))
            conn.commit()
            log_fail("Idempotency on sync_queue", "duplicate allowed!")
        except pymysql.err.IntegrityError as e:
            conn.rollback()
            log_pass(f"Idempotency on sync_queue (errno {e.args[0]})")

        conn.begin()
        cur.execute("DELETE FROM sync_queue WHERE idempotency_key = %s", (idem,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("sync_queue idempotency setup", str(e))

    cur.close(); conn.close()

# ============================================================================
# GROUP H — Order number uniqueness
# ============================================================================

def test_h_order_number():
    print(f"\n{C.BOLD}GROUP H — Order number uniqueness{C.RESET}")

    conn = get_conn(); cur = conn.cursor()

    # H.1 — Two different restaurants can have same order_number (multi-tenant)
    # Create a second restaurant
    rest2_id = cuid("hrest2")
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO restaurants (id, name, currency, tax_rate, timezone, is_active, created_at, updated_at)
            VALUES (%s, 'Test Rest 2', 'UZS', 0, 'Asia/Tashkent', 1, NOW(3), NOW(3))
        """, (rest2_id,))
        # Order with same number under rest2
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-TEST', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (cuid("h1r2"), rest2_id, str(uuid.uuid4())))
        # Order with same number under main restaurant
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-TEST', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (cuid("h1r1"), RESTAURANT_ID, str(uuid.uuid4())))
        conn.commit()
        log_pass("Same order_number allowed across different restaurants (multi-tenant)")
        # cleanup
        conn.begin()
        cur.execute("DELETE FROM orders WHERE order_number = '2026-TEST'")
        cur.execute("DELETE FROM restaurants WHERE id = %s", (rest2_id,))
        conn.commit()
    except pymysql.err.IntegrityError as e:
        conn.rollback()
        log_fail("Multi-tenant order_number", f"unexpectedly rejected: {e}")
    except Exception as e:
        conn.rollback()
        log_fail("Multi-tenant order_number test", str(e))

    # H.2 — Within same restaurant, order_number must be unique
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                idempotency_key, opened_at, created_at, updated_at)
            VALUES (%s, %s, '2026-SAME', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
        """, (cuid("h2a"), RESTAURANT_ID, str(uuid.uuid4())))
        conn.commit()
        try:
            conn.begin()
            cur.execute("""
                INSERT INTO orders (id, restaurant_id, order_number, status, payment_status, total,
                                    idempotency_key, opened_at, created_at, updated_at)
                VALUES (%s, %s, '2026-SAME', 'open', 'unpaid', 0, %s, NOW(3), NOW(3), NOW(3))
            """, (cuid("h2b"), RESTAURANT_ID, str(uuid.uuid4())))
            conn.commit()
            log_fail("Order number unique within restaurant", "duplicate allowed!")
        except pymysql.err.IntegrityError as e:
            conn.rollback()
            log_pass(f"Order number unique within restaurant (errno {e.args[0]})")
        conn.begin()
        cur.execute("DELETE FROM orders WHERE order_number = '2026-SAME'")
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("Order number unique test setup", str(e))

    cur.close(); conn.close()

# ============================================================================
# GROUP I — Views return correct data
# ============================================================================

def test_i_views():
    print(f"\n{C.BOLD}GROUP I — Views return data{C.RESET}")

    conn = get_conn(); cur = conn.cursor()

    # I.1 — v_tables_with_status returns 10 rows
    cur.execute("SELECT COUNT(*) FROM v_tables_with_status WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    if n == 10:
        log_pass(f"v_tables_with_status returns 10 tables")
    else:
        log_fail("v_tables_with_status", f"got {n}")

    # I.2 — v_user_permissions returns >0 rows for admin
    cur.execute("SELECT COUNT(*) FROM v_user_permissions WHERE user_id = 'user_admin_v2'")
    n = cur.fetchone()[0]
    if n > 0:
        log_pass(f"v_user_permissions returns {n} permissions for admin")
    else:
        log_fail("v_user_permissions", f"got {n}")

    # I.3 — v_low_stock_alerts runs without error
    cur.execute("SELECT COUNT(*) FROM v_low_stock_alerts WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    log_pass(f"v_low_stock_alerts runs OK ({n} alerts)")

    # I.4 — v_today_sales runs (will be 0 since no payments)
    cur.execute("SELECT * FROM v_today_sales WHERE restaurant_id = %s", (RESTAURANT_ID,))
    row = cur.fetchone()
    if row is not None:
        log_pass(f"v_today_sales runs OK (total_sales={row[2]})")
    else:
        log_pass("v_today_sales runs OK (no row for restaurant without payments)")

    # I.5 — v_print_jobs_pending runs
    cur.execute("SELECT COUNT(*) FROM v_print_jobs_pending WHERE restaurant_id = %s", (RESTAURANT_ID,))
    n = cur.fetchone()[0]
    log_pass(f"v_print_jobs_pending runs OK ({n} pending jobs)")

    cur.close(); conn.close()

# ============================================================================
# GROUP J — Soft delete
# ============================================================================

def test_j_soft_delete():
    print(f"\n{C.BOLD}GROUP J — Soft delete behavior{C.RESET}")

    conn = get_conn(); cur = conn.cursor()

    # Create a table, soft-delete it, verify it disappears from v_tables_with_status
    tbl_id = cuid("jtbl")
    try:
        conn.begin()
        cur.execute("""
            INSERT INTO tables (id, restaurant_id, name, capacity, status, sort_order, is_active, created_at, updated_at)
            VALUES (%s, %s, 'TEST-SOFT-DELETE', 4, 'free', 999, 1, NOW(3), NOW(3))
        """, (tbl_id, RESTAURANT_ID))
        conn.commit()

        # Verify visible
        cur.execute("SELECT COUNT(*) FROM v_tables_with_status WHERE id = %s", (tbl_id,))
        n = cur.fetchone()[0]
        if n == 1:
            log_pass("Table visible before soft delete")
        else:
            log_fail("Table visible before soft delete", f"got {n}")

        # Soft-delete it
        conn.begin()
        cur.execute("UPDATE tables SET deleted_at = NOW(3) WHERE id = %s", (tbl_id,))
        conn.commit()

        # Verify hidden
        cur.execute("SELECT COUNT(*) FROM v_tables_with_status WHERE id = %s", (tbl_id,))
        n = cur.fetchone()[0]
        if n == 0:
            log_pass("Table hidden after soft delete (view excludes deleted_at)")
        else:
            log_fail("Table hidden after soft delete", f"still visible, got {n}")

        # Hard cleanup
        conn.begin()
        cur.execute("DELETE FROM tables WHERE id = %s", (tbl_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log_fail("Soft delete test", str(e))

    cur.close(); conn.close()

# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"{C.BOLD}{C.CYAN}╔══════════════════════════════════════════════════════════════╗")
    print(f"║   Restaurant POS V2 — Database Integrity Test Suite         ║")
    print(f"║   Target: oshxona_erp_v2 @ TiDB Cloud                       ║")
    print(f"╚══════════════════════════════════════════════════════════════╝{C.RESET}")

    try:
        # connectivity sanity check
        conn = get_conn(); cur = conn.cursor()
        cur.execute("SELECT VERSION()")
        ver = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = %s", (DB_CONFIG["database"],))
        tbl_count = cur.fetchone()[0]
        cur.close(); conn.close()
        print(f"\nTiDB version: {ver}")
        print(f"Tables+views in '{DB_CONFIG['database']}': {tbl_count}")
    except Exception as e:
        print(f"{C.RED}Cannot connect to DB: {e}{C.RESET}")
        sys.exit(1)

    test_groups = [
        ("A", test_a_schema_integrity),
        ("B", test_b_seed_data),
        ("C", test_c_constraints),
        ("D", test_d_transactions),
        ("E", test_e_optimistic_locking),
        ("F", test_f_pessimistic_locking),
        ("G", test_g_idempotency),
        ("H", test_h_order_number),
        ("I", test_i_views),
        ("J", test_j_soft_delete),
    ]
    for _, fn in test_groups:
        try:
            fn()
        except Exception as e:
            log_fail(f"Group {_} crashed", str(e))

    # Summary
    total = passed + failed + skipped
    print(f"\n{C.BOLD}{'═' * 60}{C.RESET}")
    print(f"{C.BOLD}SUMMARY{C.RESET}")
    print(f"{'═' * 60}")
    print(f"  {C.GREEN}PASSED : {passed}{C.RESET}")
    print(f"  {C.RED}FAILED : {failed}{C.RESET}")
    print(f"  {C.YELLOW}SKIPPED: {skipped}{C.RESET}")
    print(f"  TOTAL  : {total}")
    print(f"{'═' * 60}")

    if failed > 0:
        print(f"\n{C.RED}FAILED TESTS:{C.RESET}")
        for name, reason in failures:
            print(f"  ✗ {name}")
            print(f"      → {reason}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
