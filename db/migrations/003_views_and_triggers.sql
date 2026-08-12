-- ============================================================================
-- Restaurant POS V2 — Helper Views (app layer handles triggers/procedures)
-- ============================================================================
-- TiDB has limited stored procedure + trigger support.
-- Strategy:
--   - Complex transaction logic → Next.js API routes use BEGIN/COMMIT
--   - Auto order_number → app generates via SELECT MAX+1 (atomic via FOR UPDATE)
--   - Status history → app writes explicitly to order_item_status_history
--   - Helper VIEWS below provide denormalized read models for dashboards
-- ============================================================================

USE `oshxona_erp_v2`;

-- ============================================================
-- VIEW: v_open_orders_with_summary
-- ============================================================
CREATE OR REPLACE VIEW `v_open_orders_with_summary` AS
SELECT
  o.id,
  o.restaurant_id,
  o.order_number,
  o.table_id,
  t.name AS table_name,
  t.section AS table_section,
  o.waiter_id,
  w.name AS waiter_name,
  o.order_type,
  o.status,
  o.payment_status,
  o.subtotal,
  o.discount_amount,
  o.tax_amount,
  o.tip_amount,
  o.total,
  o.opened_at,
  o.created_at,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status <> 'cancelled') AS items_count,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status = 'pending')    AS pending_count,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status = 'cooking')   AS cooking_count,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status = 'ready')     AS ready_count
FROM orders o
LEFT JOIN tables t  ON t.id = o.table_id
LEFT JOIN users  w  ON w.id = o.waiter_id
WHERE o.status <> 'cancelled'
  AND o.deleted_at IS NULL;

-- ============================================================
-- VIEW: v_tables_with_status
--   Single-query table status — used by /api/tables endpoint
--   (avoids N+1 subrequest pattern that crashed the old v1 endpoint)
-- ============================================================
CREATE OR REPLACE VIEW `v_tables_with_status` AS
SELECT
  t.id,
  t.restaurant_id,
  t.branch_id,
  t.name,
  t.capacity,
  t.section,
  t.status,
  t.current_order_id,
  t.sort_order,
  t.is_active,
  o.order_number  AS current_order_number,
  o.total         AS current_order_total,
  o.waiter_id,
  w.name          AS waiter_name,
  o.opened_at     AS current_order_opened_at,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status <> 'cancelled') AS current_order_items
FROM tables t
LEFT JOIN orders o ON o.id = t.current_order_id AND o.status <> 'cancelled'
LEFT JOIN users  w ON w.id = o.waiter_id
WHERE t.deleted_at IS NULL;

-- ============================================================
-- VIEW: v_station_queue  (kitchen / kebab / bar screen queue)
-- ============================================================
CREATE OR REPLACE VIEW `v_station_queue` AS
SELECT
  oi.id            AS order_item_id,
  oi.order_id,
  o.restaurant_id,
  o.order_number,
  o.table_id,
  t.name           AS table_name,
  oi.product_id,
  oi.name          AS product_name,
  oi.quantity,
  oi.unit_price,
  oi.line_total,
  oi.notes,
  oi.station,
  oi.status,
  oi.chef_id,
  c.name           AS chef_name,
  oi.started_at,
  oi.ready_at,
  o.opened_at,
  TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) AS age_seconds,
  CASE
    WHEN oi.status = 'cooking' AND TIMESTAMPDIFF(SECOND, oi.started_at, NOW()) > 600 THEN 'overdue'
    WHEN oi.status = 'pending' AND TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) > 300 THEN 'overdue'
    WHEN oi.status = 'pending' AND TIMESTAMPDIFF(SECOND, o.opened_at, NOW()) > 120 THEN 'warning'
    ELSE 'ok'
  END AS urgency
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN tables t ON t.id = o.table_id
LEFT JOIN users c ON c.id = oi.chef_id
WHERE oi.status IN ('pending', 'cooking')
  AND o.status NOT IN ('cancelled', 'paid')
  AND oi.station IN ('kitchen', 'kebab', 'bar');

-- ============================================================
-- VIEW: v_today_sales  (since last Z-report)
-- ============================================================
CREATE OR REPLACE VIEW `v_today_sales` AS
SELECT
  p.restaurant_id,
  COUNT(*)                                          AS payments_count,
  COALESCE(SUM(p.total_paid), 0)                    AS total_sales,
  COALESCE(SUM(p.cash_amount), 0)                   AS cash_sales,
  COALESCE(SUM(p.card_amount), 0)                   AS card_sales,
  COALESCE(SUM(p.click_amount), 0)                  AS click_sales,
  COALESCE(SUM(p.payme_amount), 0)                  AS payme_sales,
  COALESCE(SUM(p.tip_amount), 0)                    AS tips,
  COALESCE(SUM(p.discount_amount), 0)              AS discounts,
  COALESCE(SUM(p.change_amount), 0)                AS change_given,
  MIN(p.paid_at)                                    AS first_payment_at,
  MAX(p.paid_at)                                    AS last_payment_at
FROM payments p
JOIN restaurants r ON r.id = p.restaurant_id
WHERE p.paid_at >= COALESCE(r.last_z_report_at, '1970-01-01')
GROUP BY p.restaurant_id;

-- ============================================================
-- VIEW: v_top_products
-- ============================================================
CREATE OR REPLACE VIEW `v_top_products` AS
SELECT
  p.restaurant_id,
  oi.product_id,
  pr.name AS product_name,
  pr.type AS product_type,
  SUM(oi.quantity)  AS total_quantity,
  SUM(oi.line_total) AS total_revenue,
  COUNT(DISTINCT oi.order_id) AS order_count
FROM order_items oi
JOIN orders o  ON o.id = oi.order_id
JOIN payments p ON p.order_id = o.id
JOIN products pr ON pr.id = oi.product_id
WHERE oi.status <> 'cancelled'
  AND p.paid_at >= COALESCE((SELECT last_z_report_at FROM restaurants WHERE id = p.restaurant_id), '1970-01-01')
GROUP BY p.restaurant_id, oi.product_id, pr.name, pr.type;

-- ============================================================
-- VIEW: v_low_stock_alerts
-- ============================================================
CREATE OR REPLACE VIEW `v_low_stock_alerts` AS
SELECT
  i.id,
  i.restaurant_id,
  i.name,
  i.sku,
  i.unit,
  i.stock,
  i.min_stock,
  i.cost,
  (i.min_stock - i.stock) AS shortage,
  (i.stock / NULLIF(i.min_stock, 0)) * 100 AS stock_percent,
  CASE
    WHEN i.stock <= 0 THEN 'out'
    WHEN i.stock < i.min_stock / 2 THEN 'critical'
    WHEN i.stock < i.min_stock THEN 'low'
    ELSE 'ok'
  END AS alert_level,
  s.name AS supplier_name
FROM inventory i
LEFT JOIN suppliers s ON s.id = i.supplier_id
WHERE i.is_active = 1
  AND i.deleted_at IS NULL
  AND i.stock < i.min_stock;

-- ============================================================
-- VIEW: v_print_jobs_pending  (print server polls this)
-- ============================================================
CREATE OR REPLACE VIEW `v_print_jobs_pending` AS
SELECT
  pj.id,
  pj.restaurant_id,
  pj.printer_id,
  pr.name AS printer_name,
  pr.station,
  pr.connection_type,
  pr.ip_address,
  pr.port,
  pr.usb_name,
  pr.paper_width,
  pr.charset,
  pj.order_id,
  pj.payment_id,
  pj.type AS job_type,
  pj.payload,
  pj.status,
  pj.attempts,
  pj.queued_at
FROM print_jobs pj
JOIN printers pr ON pr.id = pj.printer_id
WHERE pj.status = 'pending'
ORDER BY pj.queued_at ASC;

-- ============================================================
-- VIEW: v_user_permissions  (flatten role permissions for fast check)
-- ============================================================
CREATE OR REPLACE VIEW `v_user_permissions` AS
SELECT
  u.id AS user_id,
  u.restaurant_id,
  u.role_id,
  r.name AS role_name,
  p.code AS permission_code,
  p.module
FROM users u
JOIN roles r ON r.id = u.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.is_active = 1
  AND u.deleted_at IS NULL
UNION
SELECT
  ur.user_id,
  u.restaurant_id,
  ur.role_id,
  r.name AS role_name,
  p.code AS permission_code,
  p.module
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.is_active = 1
  AND u.deleted_at IS NULL;

-- ============================================================
-- VIEW: v_audit_recent  (admin audit dashboard)
-- ============================================================
CREATE OR REPLACE VIEW `v_audit_recent` AS
SELECT
  a.id,
  a.restaurant_id,
  a.user_id,
  u.name AS user_name,
  u.phone AS user_phone,
  a.action,
  a.entity,
  a.entity_id,
  a.ip,
  a.created_at
FROM audit_logs a
LEFT JOIN users u ON u.id = a.user_id
ORDER BY a.created_at DESC;
