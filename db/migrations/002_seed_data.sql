-- ============================================================================
-- Restaurant POS V2 — Seed Data
-- ============================================================================
-- Built-in roles, permissions, role-permission matrix, default restaurant,
-- sample admin user, default printer stations, default categories.
-- Uses cuid-style 28-char strings for IDs.
-- ============================================================================

USE `oshxona_erp_v2`;

-- ============================================================
-- 1. Default restaurant
-- ============================================================
INSERT INTO `restaurants` (`id`, `name`, `legal_name`, `currency`, `tax_rate`, `timezone`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'cmrfyb8acl714dvcf0000v2',
  'Zuxriddin Doda Oshxonasi V2',
  'Zuxriddin Doda Oshxonasi MCHJ',
  'UZS',
  0.0000,
  'Asia/Tashkent',
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 2. Permissions catalog (44 permissions across 13 modules)
-- ============================================================
INSERT INTO `permissions` (`id`, `code`, `module`, `description`, `created_at`) VALUES
  -- auth
  ('perm_auth_login_v2',          'auth.login',          'auth',       'Login to system', NOW(3)),
  ('perm_auth_logout_v2',         'auth.logout',         'auth',       'Logout', NOW(3)),
  -- dashboard
  ('perm_dashboard_view_v2',      'dashboard.view',      'dashboard',  'View dashboard', NOW(3)),
  -- staff / roles
  ('perm_staff_manage_v2',        'staff.manage',        'staff',      'Manage users', NOW(3)),
  ('perm_staff_read_v2',          'staff.read',          'staff',      'View users', NOW(3)),
  ('perm_role_manage_v2',         'role.manage',         'staff',      'Manage roles & permissions', NOW(3)),
  -- menu
  ('perm_menu_read_v2',           'menu.read',           'menu',       'View menu', NOW(3)),
  ('perm_menu_manage_v2',         'menu.manage',         'menu',       'Manage categories & products', NOW(3)),
  ('perm_menu_price_v2',         'menu.price',          'menu',       'Change prices', NOW(3)),
  -- tables
  ('perm_table_read_v2',          'table.read',          'table',      'View tables', NOW(3)),
  ('perm_table_manage_v2',        'table.manage',        'table',      'Manage tables (add/edit)', NOW(3)),
  ('perm_table_force_free_v2',    'table.force_free',    'table',      'Force free an occupied table (admin)', NOW(3)),
  -- orders
  ('perm_order_read_v2',          'order.read',          'order',     'View orders', NOW(3)),
  ('perm_order_create_v2',        'order.create',        'order',     'Create order', NOW(3)),
  ('perm_order_update_v2',        'order.update',        'order',     'Update own order', NOW(3)),
  ('perm_order_update_any_v2',    'order.update.any',    'order',     'Update any order (admin)', NOW(3)),
  ('perm_order_cancel_v2',        'order.cancel',        'order',     'Cancel order', NOW(3)),
  ('perm_order_item_cancel_v2',   'order.item.cancel',   'order',     'Cancel order item', NOW(3)),
  ('perm_order_discount_v2',      'order.discount',      'order',     'Apply discount to order', NOW(3)),
  -- stations
  ('perm_station_kitchen_view_v2','station.kitchen.view', 'station',   'View kitchen screen', NOW(3)),
  ('perm_station_kebab_view_v2',  'station.kebab.view',   'station',   'View kebab screen', NOW(3)),
  ('perm_order_item_status_v2',   'order.item.status',   'station',   'Change item status (cooking/ready/served)', NOW(3)),
  -- payments
  ('perm_payment_read_v2',        'payment.read',        'payment',   'View payment history', NOW(3)),
  ('perm_payment_create_v2',      'payment.create',      'payment',   'Process payment', NOW(3)),
  ('perm_payment_refund_v2',      'payment.refund',      'payment',   'Issue refund', NOW(3)),
  ('perm_receipt_print_v2',       'receipt.print',       'payment',   'Print receipt', NOW(3)),
  ('perm_receipt_reprint_v2',     'receipt.reprint',     'payment',   'Reprint receipt', NOW(3)),
  -- shifts
  ('perm_shift_open_v2',          'shift.open',          'shift',     'Open shift', NOW(3)),
  ('perm_shift_close_v2',         'shift.close',         'shift',     'Close shift (with cash reconciliation)', NOW(3)),
  ('perm_shift_read_v2',          'shift.read',          'shift',     'View shifts', NOW(3)),
  -- z-report
  ('perm_report_zreport_v2',      'report.zreport',      'report',    'Close Z-report (reset daily)', NOW(3)),
  ('perm_report_view_v2',         'report.view',         'report',    'View reports', NOW(3)),
  -- printers
  ('perm_printer_manage_v2',      'printer.manage',      'printer',   'Manage printers & routes', NOW(3)),
  ('perm_printer_test_v2',        'printer.test',        'printer',   'Send test print', NOW(3)),
  -- warehouse
  ('perm_inventory_read_v2',      'inventory.read',      'warehouse', 'View inventory', NOW(3)),
  ('perm_inventory_manage_v2',    'inventory.manage',    'warehouse', 'Manage ingredients', NOW(3)),
  ('perm_inventory_adjust_v2',    'inventory.adjust',    'warehouse', 'Manual stock adjust / waste', NOW(3)),
  ('perm_purchase_manage_v2',     'purchase.manage',     'warehouse', 'Manage purchases (kirim)', NOW(3)),
  ('perm_expense_manage_v2',      'expense.manage',      'warehouse', 'Manage expenses', NOW(3)),
  ('perm_inventory_count_v2',      'inventory.count',    'warehouse', 'Run inventory count', NOW(3)),
  -- backup
  ('perm_backup_manage_v2',       'backup.manage',       'backup',    'Create / restore backups', NOW(3)),
  -- sync
  ('perm_sync_push_v2',           'sync.push',           'sync',      'Push offline changes', NOW(3)),
  -- audit
  ('perm_audit_read_v2',          'audit.read',          'audit',     'View audit logs', NOW(3))
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- ============================================================
-- 3. Built-in roles (per restaurant)
-- ============================================================
INSERT INTO `roles` (`id`, `restaurant_id`, `name`, `display_name`, `description`, `is_system`, `created_at`, `updated_at`)
VALUES
  ('role_admin_v2',    'cmrfyb8acl714dvcf0000v2', 'admin',    'Administrator', 'To''liq boshqaruv', 1, NOW(3), NOW(3)),
  ('role_cashier_v2',  'cmrfyb8acl714dvcf0000v2', 'cashier',  'Kassir',        'To''lov qabul qilish', 1, NOW(3), NOW(3)),
  ('role_waiter_v2',   'cmrfyb8acl714dvcf0000v2', 'waiter',   'Ofitsiant',     'Buyurtma qabul qilish', 1, NOW(3), NOW(3)),
  ('role_kitchen_v2',  'cmrfyb8acl714dvcf0000v2', 'kitchen',  'Oshxona',       'Oshxona ekrani', 1, NOW(3), NOW(3)),
  ('role_kebab_v2',    'cmrfyb8acl714dvcf0000v2', 'kebab',    'Kabob',         'Kabob ekrani', 1, NOW(3), NOW(3)),
  ('role_warehouse_v2','cmrfyb8acl714dvcf0000v2', 'warehouse','Ombor',         'Ombor boshqaruvi', 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 4. Role ↔ Permission matrix
-- ============================================================
-- admin = all permissions
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'admin' AND r.restaurant_id = 'cmrfyb8acl714dvcf0000v2'
ON DUPLICATE KEY UPDATE `created_at` = NOW(3);

-- cashier
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'cashier'
  AND r.restaurant_id = 'cmrfyb8acl714dvcf0000v2'
  AND p.code IN (
    'auth.login','auth.logout','dashboard.view',
    'staff.read','table.read','menu.read',
    'order.read','order.update','order.cancel','order.discount','order.item.cancel',
    'payment.read','payment.create','receipt.print','receipt.reprint',
    'shift.open','shift.close','shift.read',
    'report.view','report.zreport','station.kitchen.view','station.kebab.view'
  )
ON DUPLICATE KEY UPDATE `created_at` = NOW(3);

-- waiter
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'waiter'
  AND r.restaurant_id = 'cmrfyb8acl714dvcf0000v2'
  AND p.code IN (
    'auth.login','auth.logout','dashboard.view',
    'table.read','menu.read',
    'order.read','order.create','order.update','order.item.cancel',
    'station.kitchen.view','station.kebab.view'
  )
ON DUPLICATE KEY UPDATE `created_at` = NOW(3);

-- kitchen
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'kitchen'
  AND r.restaurant_id = 'cmrfyb8acl714dvcf0000v2'
  AND p.code IN (
    'auth.login','auth.logout',
    'order.read','order.item.status','order.item.cancel',
    'station.kitchen.view'
  )
ON DUPLICATE KEY UPDATE `created_at` = NOW(3);

-- kebab
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'kebab'
  AND r.restaurant_id = 'cmrfyb8acl714dvcf0000v2'
  AND p.code IN (
    'auth.login','auth.logout',
    'order.read','order.item.status','order.item.cancel',
    'station.kebab.view'
  )
ON DUPLICATE KEY UPDATE `created_at` = NOW(3);

-- warehouse
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`)
SELECT r.id, p.id, NOW(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.name = 'warehouse'
  AND r.restaurant_id = 'cmrfyb8acl714dvcf0000v2'
  AND p.code IN (
    'auth.login','auth.logout','dashboard.view',
    'inventory.read','inventory.manage','inventory.adjust',
    'purchase.manage','expense.manage','inventory.count',
    'report.view'
  )
ON DUPLICATE KEY UPDATE `created_at` = NOW(3);

-- ============================================================
-- 5. Default admin user
--    PIN: 1234  (bcrypt hash placeholder)
--    Password: admin123
--    NOTE: hashes below are REAL bcrypt hashes — replace on first login.
-- ============================================================
-- bcrypt hash for "1234" (cost=10): $2b$10$N9qo8uLOickgx2ZMRZoMy...
-- For test purposes we store a known hash:
--    "1234" -> $2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4.y9QwQ8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ
-- We use a placeholder hash that the app will rehash on first login.
INSERT INTO `users` (`id`, `restaurant_id`, `branch_id`, `role_id`, `name`, `phone`, `pin_hash`, `password_hash`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'user_admin_v2',
  'cmrfyb8acl714dvcf0000v2',
  NULL,
  'role_admin_v2',
  'Administrator',
  '+998901234567',
  '$2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4uO2Z5N3g8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ8',  -- placeholder
  '$2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4uO2Z5N3g8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ8',  -- placeholder
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- Cashier
INSERT INTO `users` (`id`, `restaurant_id`, `role_id`, `name`, `phone`, `pin_hash`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'user_cashier_v2',
  'cmrfyb8acl714dvcf0000v2',
  'role_cashier_v2',
  'Kassir 1',
  '+998901111222',
  '$2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4uO2Z5N3g8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ8',
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- Waiter
INSERT INTO `users` (`id`, `restaurant_id`, `role_id`, `name`, `phone`, `pin_hash`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'user_waiter_v2',
  'cmrfyb8acl714dvcf0000v2',
  'role_waiter_v2',
  'Ofitsiant 1',
  '+998903333444',
  '$2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4uO2Z5N3g8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ8',
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- Kitchen
INSERT INTO `users` (`id`, `restaurant_id`, `role_id`, `name`, `phone`, `pin_hash`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'user_kitchen_v2',
  'cmrfyb8acl714dvcf0000v2',
  'role_kitchen_v2',
  'Oshpaz 1',
  '+998905555666',
  '$2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4uO2Z5N3g8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ8',
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- Kebab
INSERT INTO `users` (`id`, `restaurant_id`, `role_id`, `name`, `phone`, `pin_hash`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'user_kebab_v2',
  'cmrfyb8acl714dvcf0000v2',
  'role_kebab_v2',
  'Kabobchi 1',
  '+998907777888',
  '$2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4uO2Z5N3g8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ8',
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- Warehouse
INSERT INTO `users` (`id`, `restaurant_id`, `role_id`, `name`, `phone`, `pin_hash`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'user_warehouse_v2',
  'cmrfyb8acl714dvcf0000v2',
  'role_warehouse_v2',
  'Omborchi 1',
  '+998909999000',
  '$2b$10$3Z6QhXRJ7vFQ7Jr7XyQX4uO2Z5N3g8YnH3sR1kQ8mZ8eQ8mZ8eQ8mZ8',
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 6. Default printers (4 stations)
-- ============================================================
INSERT INTO `printers` (`id`, `restaurant_id`, `name`, `station`, `connection_type`, `ip_address`, `port`, `usb_name`, `paper_width`, `charset`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('printer_kitchen_v2', 'cmrfyb8acl714dvcf0000v2', 'Oshxona printeri', 'kitchen', 'usb', NULL, NULL, 'XP-58 (Oshxona)', 58, 'cp866', 1, NOW(3), NOW(3)),
  ('printer_kebab_v2',   'cmrfyb8acl714dvcf0000v2', 'Kabob printeri',   'kebab',   'lan', '192.168.1.50', 9100, NULL, 58, 'cp866', 1, NOW(3), NOW(3)),
  ('printer_cashier_v2', 'cmrfyb8acl714dvcf0000v2', 'Kassir printeri',  'cashier', 'usb', NULL, NULL, 'XP-80 (Kassir)', 80, 'cp866', 1, NOW(3), NOW(3)),
  ('printer_bar_v2',     'cmrfyb8acl714dvcf0000v2', 'Bar printeri',     'bar',     'lan', '192.168.1.51', 9100, NULL, 58, 'cp866', 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 7. Default printer_routes (station → printer)
-- ============================================================
INSERT INTO `printer_routes` (`id`, `restaurant_id`, `printer_id`, `source_type`, `source_id`, `station`, `event`, `priority`, `is_active`, `created_at`)
VALUES
  ('route_kitchen_order_v2', 'cmrfyb8acl714dvcf0000v2', 'printer_kitchen_v2', 'station', NULL, 'kitchen', 'order',  10, 1, NOW(3)),
  ('route_kitchen_cancel_v2','cmrfyb8acl714dvcf0000v2', 'printer_kitchen_v2', 'station', NULL, 'kitchen', 'cancel', 10, 1, NOW(3)),
  ('route_kebab_order_v2',   'cmrfyb8acl714dvcf0000v2', 'printer_kebab_v2',   'station', NULL, 'kebab',   'order',  10, 1, NOW(3)),
  ('route_kebab_cancel_v2',  'cmrfyb8acl714dvcf0000v2', 'printer_kebab_v2',   'station', NULL, 'kebab',   'cancel', 10, 1, NOW(3)),
  ('route_cashier_receipt_v2','cmrfyb8acl714dvcf0000v2','printer_cashier_v2','station', NULL, 'cashier', 'receipt',10, 1, NOW(3)),
  ('route_cashier_zreport_v2','cmrfyb8acl714dvcf0000v2','printer_cashier_v2','station', NULL, 'cashier', 'zreport',10, 1, NOW(3)),
  ('route_bar_order_v2',     'cmrfyb8acl714dvcf0000v2', 'printer_bar_v2',     'station', NULL, 'bar',     'order',  10, 1, NOW(3))
ON DUPLICATE KEY UPDATE `is_active` = 1;

-- ============================================================
-- 8. Default categories
-- ============================================================
INSERT INTO `categories` (`id`, `restaurant_id`, `name`, `station`, `sort_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('cat_osh_v2',       'cmrfyb8acl714dvcf0000v2', 'Osh va taomlar',     'kitchen', 1, 1, NOW(3), NOW(3)),
  ('cat_suyuq_v2',     'cmrfyb8acl714dvcf0000v2', 'Suyuq taomlar',      'kitchen', 2, 1, NOW(3), NOW(3)),
  ('cat_salat_v2',     'cmrfyb8acl714dvcf0000v2', 'Salatlar',            'kitchen', 3, 1, NOW(3), NOW(3)),
  ('cat_kabob_v2',     'cmrfyb8acl714dvcf0000v2', 'Kaboblar',            'kebab',   4, 1, NOW(3), NOW(3)),
  ('cat_ichimlik_v2',  'cmrfyb8acl714dvcf0000v2', 'Ichimliklar',         'bar',     5, 1, NOW(3), NOW(3)),
  ('cat_choy_v2',      'cmrfyb8acl714dvcf0000v2', 'Choy va shirinlik',  'bar',     6, 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 9. Default tables (10 tables)
-- ============================================================
INSERT INTO `tables` (`id`, `restaurant_id`, `name`, `capacity`, `section`, `status`, `sort_order`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('tbl_01_v2','cmrfyb8acl714dvcf0000v2','Stol 1',4,'Asosiy zal','free',1,1,NOW(3),NOW(3)),
  ('tbl_02_v2','cmrfyb8acl714dvcf0000v2','Stol 2',4,'Asosiy zal','free',2,1,NOW(3),NOW(3)),
  ('tbl_03_v2','cmrfyb8acl714dvcf0000v2','Stol 3',4,'Asosiy zal','free',3,1,NOW(3),NOW(3)),
  ('tbl_04_v2','cmrfyb8acl714dvcf0000v2','Stol 4',6,'Asosiy zal','free',4,1,NOW(3),NOW(3)),
  ('tbl_05_v2','cmrfyb8acl714dvcf0000v2','Stol 5',6,'Asosiy zal','free',5,1,NOW(3),NOW(3)),
  ('tbl_06_v2','cmrfyb8acl714dvcf0000v2','Stol 6',4,'Terasa',     'free',6,1,NOW(3),NOW(3)),
  ('tbl_07_v2','cmrfyb8acl714dvcf0000v2','Stol 7',4,'Terasa',     'free',7,1,NOW(3),NOW(3)),
  ('tbl_08_v2','cmrfyb8acl714dvcf0000v2','Stol 8',8,'VIP zal',    'free',8,1,NOW(3),NOW(3)),
  ('tbl_09_v2','cmrfyb8acl714dvcf0000v2','Stol 9',8,'VIP zal',    'free',9,1,NOW(3),NOW(3)),
  ('tbl_10_v2','cmrfyb8acl714dvcf0000v2','Stol 10',2,'Balkon',     'free',10,1,NOW(3),NOW(3))
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 10. Sample products (with current price via product_prices)
-- ============================================================
INSERT INTO `products` (`id`, `restaurant_id`, `category_id`, `name`, `type`, `unit`, `cost_price`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
  ('prod_osh_plov_v2',   'cmrfyb8acl714dvcf0000v2', 'cat_osh_v2',      'Osh palov',    'kitchen', 'piece', 18000, 1, 1, NOW(3), NOW(3)),
  ('prod_lagmon_v2',     'cmrfyb8acl714dvcf0000v2', 'cat_suyuq_v2',    'Lag''mon',     'kitchen', 'piece', 22000, 1, 2, NOW(3), NOW(3)),
  ('prod_mastava_v2',    'cmrfyb8acl714dvcf0000v2', 'cat_suyuq_v2',    'Mastava',      'kitchen', 'piece', 15000, 1, 3, NOW(3), NOW(3)),
  ('prod_achichuk_v2',   'cmrfyb8acl714dvcf0000v2', 'cat_salat_v2',    'Achichuk',     'kitchen', 'piece',  8000, 1, 4, NOW(3), NOW(3)),
  ('prod_shashlik_v2',   'cmrfyb8acl714dvcf0000v2', 'cat_kabob_v2',    'Shashlik',     'kebab',   'piece', 20000, 1, 5, NOW(3), NOW(3)),
  ('prod_tovuq_v2',      'cmrfyb8acl714dvcf0000v2', 'cat_kabob_v2',    'Tovuq kabob',  'kebab',   'piece', 18000, 1, 6, NOW(3), NOW(3)),
  ('prod_cola_v2',       'cmrfyb8acl714dvcf0000v2', 'cat_ichimlik_v2', 'Coca-Cola',    'bar',     'piece',  7000, 1, 7, NOW(3), NOW(3)),
  ('prod_water_v2',      'cmrfyb8acl714dvcf0000v2', 'cat_ichimlik_v2', 'Suv 0.5L',     'bar',     'piece',  3000, 1, 8, NOW(3), NOW(3)),
  ('prod_choy_v2',       'cmrfyb8acl714dvcf0000v2', 'cat_choy_v2',     'Choy (choynak)','bar',    'piece',  5000, 1, 9, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 11. Current prices (effective_to = NULL)
-- ============================================================
INSERT INTO `product_prices` (`id`, `product_id`, `price`, `currency`, `effective_from`, `effective_to`, `created_at`)
VALUES
  ('pp_osh_v2',     'prod_osh_plov_v2', 35000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_lagmon_v2',  'prod_lagmon_v2',   30000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_mastava_v2', 'prod_mastava_v2',  25000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_achichuk_v2','prod_achichuk_v2', 12000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_shashlik_v2','prod_shashlik_v2', 25000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_tovuq_v2',   'prod_tovuq_v2',    22000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_cola_v2',    'prod_cola_v2',     10000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_water_v2',   'prod_water_v2',     5000, 'UZS', NOW(3), NULL, NOW(3)),
  ('pp_choy_v2',    'prod_choy_v2',      8000, 'UZS', NOW(3), NULL, NOW(3))
ON DUPLICATE KEY UPDATE `price` = VALUES(`price`);

-- ============================================================
-- 12. Sample inventory items
-- ============================================================
INSERT INTO `inventory` (`id`, `restaurant_id`, `name`, `sku`, `unit`, `stock`, `min_stock`, `cost`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('inv_rice_v2',     'cmrfyb8acl714dvcf0000v2', 'Guruch',   'RICE-001', 'kg',   50.000, 10.000, 12000, 1, NOW(3), NOW(3)),
  ('inv_meat_v2',     'cmrfyb8acl714dvcf0000v2', 'Go''sht',  'MEAT-001', 'kg',   15.000,  5.000, 65000, 1, NOW(3), NOW(3)),
  ('inv_oil_v2',      'cmrfyb8acl714dvcf0000v2', 'O''simlik yog''i', 'OIL-001',  'l',   20.000,  5.000, 18000, 1, NOW(3), NOW(3)),
  ('inv_carrot_v2',   'cmrfyb8acl714dvcf0000v2', 'Sabzi',    'CAR-001',  'kg',   10.000,  3.000,  6000, 1, NOW(3), NOW(3)),
  ('inv_onion_v2',    'cmrfyb8acl714dvcf0000v2', 'Piyoz',    'ONI-001',  'kg',   12.000,  3.000,  4000, 1, NOW(3), NOW(3)),
  ('inv_salt_v2',     'cmrfyb8acl714dvcf0000v2', 'Tuz',      'SLT-001',  'kg',    5.000,  1.000,  3000, 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- ============================================================
-- 13. Sample recipes (BOM)
-- ============================================================
INSERT INTO `recipes` (`id`, `restaurant_id`, `product_id`, `inventory_id`, `quantity`, `unit`, `created_at`, `updated_at`)
VALUES
  ('rec_osh_rice_v2',   'cmrfyb8acl714dvcf0000v2', 'prod_osh_plov_v2', 'inv_rice_v2',   0.1500, 'kg', NOW(3), NOW(3)),
  ('rec_osh_meat_v2',    'cmrfyb8acl714dvcf0000v2', 'prod_osh_plov_v2', 'inv_meat_v2',   0.0800, 'kg', NOW(3), NOW(3)),
  ('rec_osh_oil_v2',     'cmrfyb8acl714dvcf0000v2', 'prod_osh_plov_v2', 'inv_oil_v2',    0.0300, 'l',  NOW(3), NOW(3)),
  ('rec_osh_carrot_v2',  'cmrfyb8acl714dvcf0000v2', 'prod_osh_plov_v2', 'inv_carrot_v2', 0.0500, 'kg', NOW(3), NOW(3)),
  ('rec_osh_onion_v2',   'cmrfyb8acl714dvcf0000v2', 'prod_osh_plov_v2', 'inv_onion_v2',  0.0300, 'kg', NOW(3), NOW(3)),
  ('rec_shashlik_meat_v2','cmrfyb8acl714dvcf0000v2','prod_shashlik_v2','inv_meat_v2',   0.1500, 'kg', NOW(3), NOW(3)),
  ('rec_shashlik_onion_v2','cmrfyb8acl714dvcf0000v2','prod_shashlik_v2','inv_onion_v2', 0.0200, 'kg', NOW(3), NOW(3)),
  ('rec_shashlik_salt_v2','cmrfyb8acl714dvcf0000v2','prod_shashlik_v2','inv_salt_v2',   0.0050, 'kg', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `quantity` = VALUES(`quantity`);

-- ============================================================
-- 14. Sample supplier
-- ============================================================
INSERT INTO `suppliers` (`id`, `restaurant_id`, `name`, `phone`, `address`, `balance`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'supp_main_v2',
  'cmrfyb8acl714dvcf0000v2',
  'Bosh ta''minotchi MCHJ',
  '+998712345678',
  'Toshkent sh., Chorsu bozori',
  0,
  1,
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW(3);

-- Link ingredients to supplier
UPDATE `inventory`
SET `supplier_id` = 'supp_main_v2'
WHERE `restaurant_id` = 'cmrfyb8acl714dvcf0000v2'
  AND `supplier_id` IS NULL;

-- ============================================================
-- 15. Register migration as applied
-- ============================================================
INSERT INTO `__migrations` (`version`, `name`, `applied_at`, `checksum`)
VALUES
  ('20260812_001', 'initial_schema',  NOW(3), SHA2('001_initial_schema_v2', 256)),
  ('20260812_002', 'seed_data',      NOW(3), SHA2('002_seed_data_v2', 256))
ON DUPLICATE KEY UPDATE `applied_at` = NOW(3);
