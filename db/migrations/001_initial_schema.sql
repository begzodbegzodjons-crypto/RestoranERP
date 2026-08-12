-- ============================================================================
-- Restaurant POS V2 — Database Schema Migration
-- ============================================================================
-- Database: oshxona_erp_v2 (TiDB Cloud, MySQL-compatible)
-- Convention: snake_case (different from v1 PascalCase so they don't clash)
-- Strategy: Forward-only, idempotent (CREATE IF NOT EXISTS)
-- ============================================================================

-- ============================================================
-- 0. Database + charset (already created from Python)
-- ============================================================
USE `oshxona_erp_v2`;

-- ============================================================
-- 1. restaurants  (multi-tenant root)
-- ============================================================
CREATE TABLE IF NOT EXISTS `restaurants` (
  `id`                CHAR(28)         NOT NULL  COMMENT 'cuid',
  `name`              VARCHAR(200)     NOT NULL,
  `legal_name`        VARCHAR(255)     NULL,
  `tax_id`            VARCHAR(50)      NULL,
  `address`           VARCHAR(500)     NULL,
  `phone`             VARCHAR(30)     NULL,
  `currency`          VARCHAR(8)       NOT NULL DEFAULT 'UZS',
  `tax_rate`          DECIMAL(6,4)     NOT NULL DEFAULT 0,
  `timezone`          VARCHAR(50)      NOT NULL DEFAULT 'Asia/Tashkent',
  `last_z_report_at`  DATETIME(3)      NULL  COMMENT 'Z-report cutoff timestamp',
  `is_active`         TINYINT(1)       NOT NULL DEFAULT 1,
  `settings`          JSON             NULL,
  `created_at`        DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`        DATETIME(3)      NULL,
  PRIMARY KEY (`id`),
  KEY `idx_restaurants_tax_id` (`tax_id`),
  KEY `idx_restaurants_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Multi-tenant root — one row per restaurant';

-- ============================================================
-- 2. branches
-- ============================================================
CREATE TABLE IF NOT EXISTS `branches` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `name`            VARCHAR(150) NOT NULL,
  `address`         VARCHAR(500) NULL,
  `phone`           VARCHAR(30)  NULL,
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_branches_restaurant` (`restaurant_id`),
  CONSTRAINT `fk_branches_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. roles
-- ============================================================
CREATE TABLE IF NOT EXISTS `roles` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `name`            VARCHAR(50)  NOT NULL  COMMENT 'admin, cashier, waiter, kitchen, kebab, warehouse',
  `display_name`    VARCHAR(100) NOT NULL,
  `description`     VARCHAR(255) NULL,
  `is_system`       TINYINT(1)   NOT NULL DEFAULT 0  COMMENT '1=built-in role, cannot delete',
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_restaurant_name` (`restaurant_id`, `name`),
  KEY `idx_roles_restaurant` (`restaurant_id`),
  CONSTRAINT `fk_roles_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. permissions  (catalog, not tenant-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS `permissions` (
  `id`           CHAR(28)     NOT NULL,
  `code`         VARCHAR(80)  NOT NULL  COMMENT 'e.g. order.create, cashier.pay',
  `module`       VARCHAR(40)  NOT NULL  COMMENT 'order, payment, menu, warehouse, ...',
  `description`  VARCHAR(255) NULL,
  `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_code` (`code`),
  KEY `idx_permissions_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. role_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id`        CHAR(28)     NOT NULL,
  `permission_id`  CHAR(28)     NOT NULL,
  `created_at`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`role_id`, `permission_id`),
  KEY `idx_rp_permission` (`permission_id`),
  CONSTRAINT `fk_rp_role`        FOREIGN KEY (`role_id`)       REFERENCES `roles`(`id`),
  CONSTRAINT `fk_rp_permission`  FOREIGN KEY (`permission_id`)  REFERENCES `permissions`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. users
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`               CHAR(28)     NOT NULL,
  `restaurant_id`    CHAR(28)     NOT NULL,
  `branch_id`        CHAR(28)     NULL,
  `role_id`          CHAR(28)     NULL  COMMENT 'primary role (NULL if multi-role via user_roles)',
  `name`             VARCHAR(150) NOT NULL,
  `phone`            VARCHAR(30)  NOT NULL,
  `pin_hash`         VARCHAR(120) NULL  COMMENT 'bcrypt hash for PIN login',
  `password_hash`    VARCHAR(120) NULL  COMMENT 'bcrypt hash for password login (admin)',
  `is_active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `last_login_at`    DATETIME(3)  NULL,
  `failed_attempts`  INT          NOT NULL DEFAULT 0,
  `locked_until`     DATETIME(3)  NULL,
  `device_id`        CHAR(36)     NULL  COMMENT 'offline device UUID',
  `created_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`       DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_restaurant_phone` (`restaurant_id`, `phone`),
  KEY `idx_users_restaurant_active` (`restaurant_id`, `is_active`),
  KEY `idx_users_branch` (`branch_id`),
  KEY `idx_users_role` (`role_id`),
  CONSTRAINT `fk_users_restaurant`  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_users_branch`      FOREIGN KEY (`branch_id`)     REFERENCES `branches`(`id`),
  CONSTRAINT `fk_users_role`        FOREIGN KEY (`role_id`)       REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6b. user_roles (multi-role support)
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id`     CHAR(28)    NOT NULL,
  `role_id`     CHAR(28)    NOT NULL,
  `branch_id`   CHAR(28)    NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `idx_ur_role` (`role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS `sessions` (
  `id`               CHAR(36)    NOT NULL  COMMENT 'UUID',
  `user_id`          CHAR(28)    NOT NULL,
  `token_hash`       CHAR(64)    NOT NULL  COMMENT 'SHA-256 of access token',
  `refresh_hash`     CHAR(64)    NOT NULL  COMMENT 'SHA-256 of refresh token',
  `ip`               VARCHAR(45) NULL,
  `user_agent`       VARCHAR(255) NULL,
  `fingerprint`      CHAR(64)    NULL  COMMENT 'SHA-256 of IP+UA for binding',
  `expires_at`       DATETIME(3) NOT NULL,
  `refresh_expires_at` DATETIME(3) NOT NULL,
  `revoked_at`       DATETIME(3) NULL,
  `created_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token` (`token_hash`),
  UNIQUE KEY `uq_sessions_refresh` (`refresh_hash`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expires` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. categories
-- ============================================================
CREATE TABLE IF NOT EXISTS `categories` (
  `id`              CHAR(28)    NOT NULL,
  `restaurant_id`   CHAR(28)    NOT NULL,
  `name`            VARCHAR(100) NOT NULL,
  `station`         VARCHAR(20) NOT NULL DEFAULT 'kitchen'  COMMENT 'kitchen, kebab, bar, other',
  `sort_order`      INT         NOT NULL DEFAULT 0,
  `is_active`       TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_categories_restaurant` (`restaurant_id`, `is_active`),
  KEY `idx_categories_station`    (`restaurant_id`, `station`),
  CONSTRAINT `fk_categories_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. products
-- ============================================================
CREATE TABLE IF NOT EXISTS `products` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `category_id`     CHAR(28)     NULL,
  `name`            VARCHAR(200) NOT NULL,
  `description`     VARCHAR(500) NULL,
  `sku`             VARCHAR(50)  NULL,
  `type`            VARCHAR(20)  NOT NULL DEFAULT 'kitchen'  COMMENT 'kitchen, kebab, bar, other',
  `unit`            VARCHAR(20)  NOT NULL DEFAULT 'piece',
  `cost_price`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `has_variants`    TINYINT(1)   NOT NULL DEFAULT 0,
  `sort_order`      INT         NOT NULL DEFAULT 0,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_restaurant_sku` (`restaurant_id`, `sku`),
  KEY `idx_products_restaurant_active` (`restaurant_id`, `is_active`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_type`     (`restaurant_id`, `type`),
  CONSTRAINT `fk_products_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_products_category`  FOREIGN KEY (`category_id`)   REFERENCES `categories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. product_prices  (price history — temporal table)
-- ============================================================
CREATE TABLE IF NOT EXISTS `product_prices` (
  `id`           CHAR(28)      NOT NULL,
  `product_id`   CHAR(28)      NOT NULL,
  `price`        DECIMAL(14,2) NOT NULL,
  `currency`     VARCHAR(8)    NOT NULL DEFAULT 'UZS',
  `effective_from` DATETIME(3) NOT NULL,
  `effective_to` DATETIME(3)   NULL  COMMENT 'NULL = current price',
  `created_by`   CHAR(28)      NULL,
  `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_prices_current` (`product_id`, `effective_to`),
  KEY `idx_pp_product` (`product_id`),
  KEY `idx_pp_effective` (`product_id`, `effective_from`, `effective_to`),
  CONSTRAINT `fk_pp_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. product_variants  (extra — not in user list but needed)
-- ============================================================
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id`           CHAR(28)      NOT NULL,
  `product_id`   CHAR(28)      NOT NULL,
  `name`         VARCHAR(100)  NOT NULL  COMMENT 'e.g. "Small", "Large"',
  `price_delta`  DECIMAL(14,2) NOT NULL DEFAULT 0,
  `is_active`    TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`   DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pv_product` (`product_id`),
  CONSTRAINT `fk_pv_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. tables  (restaurant tables, not MySQL tables!)
-- ============================================================
CREATE TABLE IF NOT EXISTS `tables` (
  `id`              CHAR(28)    NOT NULL,
  `restaurant_id`   CHAR(28)    NOT NULL,
  `branch_id`       CHAR(28)    NULL,
  `name`            VARCHAR(50) NOT NULL,
  `capacity`        INT         NOT NULL DEFAULT 4,
  `section`         VARCHAR(50) NULL  COMMENT 'Hall, Terrace, VIP',
  `status`          VARCHAR(20) NOT NULL DEFAULT 'free'  COMMENT 'free, occupied, reserved, cleaning',
  `current_order_id` CHAR(28)   NULL,
  `sort_order`      INT         NOT NULL DEFAULT 0,
  `is_active`       TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tables_restaurant_name` (`restaurant_id`, `name`),
  KEY `idx_tables_restaurant_status` (`restaurant_id`, `status`),
  KEY `idx_tables_branch` (`branch_id`),
  CONSTRAINT `fk_tables_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_tables_branch`     FOREIGN KEY (`branch_id`)     REFERENCES `branches`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. orders
-- ============================================================
CREATE TABLE IF NOT EXISTS `orders` (
  `id`                  CHAR(28)      NOT NULL,
  `restaurant_id`       CHAR(28)      NOT NULL,
  `branch_id`           CHAR(28)      NULL,
  `order_number`        VARCHAR(20)   NOT NULL  COMMENT 'Human-friendly e.g. 000145',
  `table_id`            CHAR(28)      NULL,
  `waiter_id`           CHAR(28)      NULL,
  `cashier_id`          CHAR(28)      NULL,
  `order_type`          VARCHAR(20)   NOT NULL DEFAULT 'dine_in'  COMMENT 'dine_in, takeaway, delivery',
  `status`              VARCHAR(20)   NOT NULL DEFAULT 'open'  COMMENT 'open, cooking, ready, paid, cancelled',
  `payment_status`      VARCHAR(20)   NOT NULL DEFAULT 'unpaid'  COMMENT 'unpaid, partial, paid, refunded',
  `subtotal`            DECIMAL(14,2) NOT NULL DEFAULT 0,
  `discount_amount`     DECIMAL(14,2) NOT NULL DEFAULT 0,
  `discount_type`       VARCHAR(20)   NULL  COMMENT 'amount, percent',
  `discount_reason`     VARCHAR(200)  NULL,
  `tax_amount`          DECIMAL(14,2) NOT NULL DEFAULT 0,
  `tip_amount`          DECIMAL(14,2) NOT NULL DEFAULT 0,
  `total`               DECIMAL(14,2) NOT NULL DEFAULT 0,
  `customer_name`       VARCHAR(150)  NULL,
  `customer_phone`      VARCHAR(30)   NULL,
  `notes`               VARCHAR(500)  NULL,
  `idempotency_key`     CHAR(36)      NOT NULL  COMMENT 'UUID for offline dedup',
  `version`             BIGINT        NOT NULL DEFAULT 1  COMMENT 'optimistic lock',
  `sync_hash`           CHAR(64)      NULL  COMMENT 'SHA-256 of items payload (offline conflict detect)',
  `opened_at`           DATETIME(3)   NULL,
  `closed_at`           DATETIME(3)   NULL,
  `created_at`          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`          DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_number` (`restaurant_id`, `order_number`),
  UNIQUE KEY `uq_orders_idempotency` (`restaurant_id`, `idempotency_key`),
  KEY `idx_orders_restaurant_status` (`restaurant_id`, `status`),
  KEY `idx_orders_table_status`      (`restaurant_id`, `table_id`, `status`),
  KEY `idx_orders_waiter_status`     (`restaurant_id`, `waiter_id`, `status`),
  KEY `idx_orders_payment`           (`restaurant_id`, `payment_status`),
  KEY `idx_orders_opened`            (`restaurant_id`, `opened_at`),
  CONSTRAINT `fk_orders_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_orders_branch`     FOREIGN KEY (`branch_id`)      REFERENCES `branches`(`id`),
  CONSTRAINT `fk_orders_table`      FOREIGN KEY (`table_id`)       REFERENCES `tables`(`id`),
  CONSTRAINT `fk_orders_waiter`     FOREIGN KEY (`waiter_id`)      REFERENCES `users`(`id`),
  CONSTRAINT `fk_orders_cashier`    FOREIGN KEY (`cashier_id`)     REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS `order_items` (
  `id`              CHAR(28)      NOT NULL,
  `order_id`        CHAR(28)      NOT NULL,
  `product_id`      CHAR(28)      NOT NULL,
  `variant_id`      CHAR(28)      NULL,
  `name`            VARCHAR(200)  NOT NULL  COMMENT 'snapshot of product name at order time',
  `unit_price`      DECIMAL(14,2) NOT NULL,
  `cost_price`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `quantity`        DECIMAL(10,3) NOT NULL DEFAULT 1,
  `line_total`      DECIMAL(14,2) NOT NULL,
  `notes`           VARCHAR(255)  NULL,
  `station`         VARCHAR(20)   NOT NULL DEFAULT 'kitchen'  COMMENT 'kitchen, kebab, bar',
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'pending'  COMMENT 'pending, cooking, ready, served, cancelled',
  `chef_id`         CHAR(28)      NULL,
  `started_at`      DATETIME(3)   NULL,
  `ready_at`        DATETIME(3)   NULL,
  `served_at`       DATETIME(3)   NULL,
  `cancelled_at`    DATETIME(3)   NULL,
  `cancel_reason`   VARCHAR(200)  NULL,
  `idempotency_key` CHAR(36)      NOT NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_items_idempotency` (`order_id`, `idempotency_key`),
  KEY `idx_oi_order` (`order_id`),
  KEY `idx_oi_station_status` (`order_id`, `station`, `status`),
  KEY `idx_oi_product` (`product_id`),
  KEY `idx_oi_chef`    (`chef_id`),
  CONSTRAINT `fk_oi_order`   FOREIGN KEY (`order_id`)   REFERENCES `orders`(`id`),
  CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_oi_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`),
  CONSTRAINT `fk_oi_chef`    FOREIGN KEY (`chef_id`)    REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. order_item_status_history  (audit trail per item)
-- ============================================================
CREATE TABLE IF NOT EXISTS `order_item_status_history` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT,
  `order_item_id`   CHAR(28)     NOT NULL,
  `order_id`        CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `from_status`     VARCHAR(20)  NULL,
  `to_status`       VARCHAR(20)  NOT NULL,
  `changed_by`      CHAR(28)    NULL,
  `note`            VARCHAR(255) NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_oish_item` (`order_item_id`),
  KEY `idx_oish_order` (`order_id`),
  KEY `idx_oish_restaurant_time` (`restaurant_id`, `created_at`),
  CONSTRAINT `fk_oish_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oish_order` FOREIGN KEY (`order_id`)      REFERENCES `orders`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. order_events  (audit trail per order)
-- ============================================================
CREATE TABLE IF NOT EXISTS `order_events` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT,
  `order_id`        CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `type`            VARCHAR(50)  NOT NULL  COMMENT 'created, sent_to_kitchen, item_added, item_cancelled, paid, ...',
  `user_id`         CHAR(28)     NULL,
  `payload`         JSON         NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_oe_order` (`order_id`),
  KEY `idx_oe_restaurant_type_time` (`restaurant_id`, `type`, `created_at`),
  CONSTRAINT `fk_oe_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. shifts
-- ============================================================
CREATE TABLE IF NOT EXISTS `shifts` (
  `id`              CHAR(28)      NOT NULL,
  `restaurant_id`   CHAR(28)      NOT NULL,
  `branch_id`       CHAR(28)      NULL,
  `cashier_id`      CHAR(28)      NOT NULL,
  `opening_cash`    DECIMAL(14,2) NOT NULL DEFAULT 0,
  `closing_cash`    DECIMAL(14,2) NULL,
  `expected_cash`   DECIMAL(14,2) NULL,
  `cash_difference` DECIMAL(14,2) NULL,
  `total_sales`     DECIMAL(14,2) NOT NULL DEFAULT 0,
  `cash_sales`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `card_sales`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `click_sales`     DECIMAL(14,2) NOT NULL DEFAULT 0,
  `payme_sales`     DECIMAL(14,2) NOT NULL DEFAULT 0,
  `refunds`         DECIMAL(14,2) NOT NULL DEFAULT 0,
  `voids`           INT           NOT NULL DEFAULT 0,
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'open'  COMMENT 'open, closed',
  `opened_at`       DATETIME(3)   NOT NULL,
  `closed_at`       DATETIME(3)   NULL,
  `note`            VARCHAR(500)  NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_shifts_restaurant_status` (`restaurant_id`, `status`),
  KEY `idx_shifts_cashier` (`cashier_id`),
  KEY `idx_shifts_opened` (`restaurant_id`, `opened_at`),
  CONSTRAINT `fk_shifts_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_shifts_cashier`    FOREIGN KEY (`cashier_id`)    REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. payments
-- ============================================================
CREATE TABLE IF NOT EXISTS `payments` (
  `id`                CHAR(28)      NOT NULL,
  `restaurant_id`     CHAR(28)      NOT NULL,
  `order_id`          CHAR(28)      NOT NULL,
  `shift_id`          CHAR(28)      NULL,
  `cashier_id`        CHAR(28)      NOT NULL,
  `subtotal`          DECIMAL(14,2) NOT NULL,
  `discount_amount`   DECIMAL(14,2) NOT NULL DEFAULT 0,
  `tax_amount`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `tip_amount`        DECIMAL(14,2) NOT NULL DEFAULT 0,
  `total_paid`        DECIMAL(14,2) NOT NULL,
  `change_amount`     DECIMAL(14,2) NOT NULL DEFAULT 0,
  `payment_method`    VARCHAR(20)   NOT NULL  COMMENT 'cash, click, payme, card, mixed',
  `cash_amount`       DECIMAL(14,2) NOT NULL DEFAULT 0,
  `card_amount`       DECIMAL(14,2) NOT NULL DEFAULT 0,
  `click_amount`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `payme_amount`      DECIMAL(14,2) NOT NULL DEFAULT 0,
  `reference`         VARCHAR(100)  NULL  COMMENT 'transaction IDs (JSON array)',
  `idempotency_key`   CHAR(36)      NOT NULL,
  `paid_at`           DATETIME(3)   NOT NULL,
  `created_at`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_idempotency` (`restaurant_id`, `idempotency_key`),
  UNIQUE KEY `uq_payments_order` (`order_id`)  COMMENT 'one payment per order',
  KEY `idx_payments_restaurant_paid` (`restaurant_id`, `paid_at`),
  KEY `idx_payments_shift` (`shift_id`),
  KEY `idx_payments_cashier` (`cashier_id`),
  KEY `idx_payments_method` (`restaurant_id`, `payment_method`, `paid_at`),
  CONSTRAINT `fk_payments_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_payments_order`      FOREIGN KEY (`order_id`)      REFERENCES `orders`(`id`),
  CONSTRAINT `fk_payments_shift`      FOREIGN KEY (`shift_id`)      REFERENCES `shifts`(`id`),
  CONSTRAINT `fk_payments_cashier`    FOREIGN KEY (`cashier_id`)    REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 19. payment_items  (breakdown for mixed payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS `payment_items` (
  `id`              CHAR(28)      NOT NULL,
  `payment_id`      CHAR(28)      NOT NULL,
  `method`          VARCHAR(20)   NOT NULL  COMMENT 'cash, click, payme, card',
  `amount`          DECIMAL(14,2) NOT NULL,
  `reference`       VARCHAR(100)  NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_items_payment_method` (`payment_id`, `method`),
  KEY `idx_pi_payment` (`payment_id`),
  CONSTRAINT `fk_pi_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 20. suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `name`            VARCHAR(200) NOT NULL,
  `phone`           VARCHAR(30)  NULL,
  `address`         VARCHAR(500) NULL,
  `balance`         DECIMAL(14,2) NOT NULL DEFAULT 0  COMMENT 'we owe them (-) or prepaid (+)',
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_restaurant_active` (`restaurant_id`, `is_active`),
  CONSTRAINT `fk_suppliers_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 21. inventory  (ingredients / stock items)
-- ============================================================
CREATE TABLE IF NOT EXISTS `inventory` (
  `id`              CHAR(28)      NOT NULL,
  `restaurant_id`   CHAR(28)      NOT NULL,
  `branch_id`       CHAR(28)      NULL,
  `name`            VARCHAR(200)  NOT NULL,
  `sku`             VARCHAR(50)   NULL,
  `unit`            VARCHAR(20)   NOT NULL DEFAULT 'piece'  COMMENT 'kg, l, piece',
  `stock`           DECIMAL(14,3) NOT NULL DEFAULT 0,
  `min_stock`       DECIMAL(14,3) NOT NULL DEFAULT 0,
  `cost`            DECIMAL(14,2) NOT NULL DEFAULT 0  COMMENT 'current unit cost',
  `supplier_id`     CHAR(28)      NULL,
  `is_active`       TINYINT(1)    NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_restaurant_sku` (`restaurant_id`, `sku`),
  KEY `idx_inventory_restaurant_active` (`restaurant_id`, `is_active`),
  KEY `idx_inventory_low_stock` (`restaurant_id`, `is_active`, `stock`, `min_stock`),
  KEY `idx_inventory_supplier` (`supplier_id`),
  CONSTRAINT `fk_inventory_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_inventory_supplier`   FOREIGN KEY (`supplier_id`)   REFERENCES `suppliers`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 22. inventory_transactions  (stock movements: in/out/adjust/waste)
-- ============================================================
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `inventory_id`    CHAR(28)      NOT NULL,
  `restaurant_id`   CHAR(28)      NOT NULL,
  `type`            VARCHAR(20)   NOT NULL  COMMENT 'in, out, adjust, waste, transfer, count',
  `quantity`        DECIMAL(14,3) NOT NULL  COMMENT 'negative for out/waste',
  `unit_cost`       DECIMAL(14,2) NOT NULL DEFAULT 0,
  `reason`          VARCHAR(200)  NULL,
  `reference_type`  VARCHAR(40)   NULL  COMMENT 'purchase, order, inventory_count, manual',
  `reference_id`    CHAR(28)      NULL,
  `user_id`         CHAR(28)      NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_it_inventory` (`inventory_id`),
  KEY `idx_it_restaurant_time` (`restaurant_id`, `created_at`),
  KEY `idx_it_type` (`restaurant_id`, `type`),
  KEY `idx_it_reference` (`reference_type`, `reference_id`),
  CONSTRAINT `fk_it_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`),
  CONSTRAINT `fk_it_user`     FOREIGN KEY (`user_id`)      REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 23. recipes  (BOM — bill of materials)
-- ============================================================
CREATE TABLE IF NOT EXISTS `recipes` (
  `id`              CHAR(28)      NOT NULL,
  `restaurant_id`   CHAR(28)      NOT NULL,
  `product_id`      CHAR(28)      NOT NULL,
  `inventory_id`    CHAR(28)      NOT NULL,
  `quantity`        DECIMAL(14,4) NOT NULL,
  `unit`            VARCHAR(20)   NOT NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recipes_product_inventory` (`product_id`, `inventory_id`),
  KEY `idx_recipes_product` (`product_id`),
  KEY `idx_recipes_inventory` (`inventory_id`),
  CONSTRAINT `fk_recipes_product`   FOREIGN KEY (`product_id`)   REFERENCES `products`(`id`),
  CONSTRAINT `fk_recipes_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 24. expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS `expenses` (
  `id`              CHAR(28)      NOT NULL,
  `restaurant_id`   CHAR(28)      NOT NULL,
  `branch_id`       CHAR(28)      NULL,
  `category`        VARCHAR(50)   NOT NULL  COMMENT 'rent, salary, utility, transport, other',
  `amount`          DECIMAL(14,2) NOT NULL,
  `description`     VARCHAR(500)  NULL,
  `paid_by`         CHAR(28)      NULL,
  `expense_date`    DATE          NOT NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expenses_restaurant_date` (`restaurant_id`, `expense_date`),
  KEY `idx_expenses_category` (`restaurant_id`, `category`),
  KEY `idx_expenses_paid_by` (`paid_by`),
  CONSTRAINT `fk_expenses_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_expenses_paid_by`    FOREIGN KEY (`paid_by`)        REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 25. printers
-- ============================================================
CREATE TABLE IF NOT EXISTS `printers` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `branch_id`       CHAR(28)     NULL,
  `name`            VARCHAR(100) NOT NULL  COMMENT 'display name e.g. "Oshxona printeri"',
  `station`         VARCHAR(30)  NOT NULL  COMMENT 'kitchen, kebab, cashier, bar, other',
  `connection_type` VARCHAR(10)  NOT NULL  COMMENT 'usb, lan',
  `ip_address`      VARCHAR(45)  NULL  COMMENT 'for LAN',
  `port`            INT          NULL  COMMENT 'default 9100 for LAN',
  `usb_name`        VARCHAR(255) NULL  COMMENT 'Windows printer name for USB',
  `paper_width`     INT          NOT NULL DEFAULT 58  COMMENT '58 or 80 mm',
  `charset`         VARCHAR(20)  NOT NULL DEFAULT 'cp866',
  `is_active`       TINYINT(1)   NOT NULL DEFAULT 1,
  `last_seen_at`    DATETIME(3)  NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  KEY `idx_printers_restaurant_station` (`restaurant_id`, `station`, `is_active`),
  KEY `idx_printers_branch` (`branch_id`),
  CONSTRAINT `fk_printers_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_printers_branch`     FOREIGN KEY (`branch_id`)     REFERENCES `branches`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 26. printer_routes  (which station/category routes to which printer)
-- ============================================================
CREATE TABLE IF NOT EXISTS `printer_routes` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `printer_id`      CHAR(28)     NOT NULL,
  `source_type`     VARCHAR(30)  NOT NULL  COMMENT 'category, station, order_type',
  `source_id`       CHAR(28)    NULL  COMMENT 'category_id if source_type=category',
  `station`         VARCHAR(30) NULL  COMMENT 'kitchen/kebab/bar if source_type=station',
  `event`           VARCHAR(30) NOT NULL DEFAULT 'order'  COMMENT 'order, receipt, cancel, zreport',
  `priority`        INT         NOT NULL DEFAULT 0,
  `is_active`       TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_printer_routes_unique` (`restaurant_id`, `printer_id`, `source_type`, `source_id`, `station`, `event`),
  KEY `idx_pr_printer` (`printer_id`),
  KEY `idx_pr_restaurant_event` (`restaurant_id`, `event`, `is_active`),
  CONSTRAINT `fk_pr_printer`     FOREIGN KEY (`printer_id`)    REFERENCES `printers`(`id`),
  CONSTRAINT `fk_pr_restaurant`  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 27. print_jobs  (queue for print server to poll)
-- ============================================================
CREATE TABLE IF NOT EXISTS `print_jobs` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `printer_id`      CHAR(28)     NOT NULL,
  `order_id`        CHAR(28)     NULL,
  `payment_id`      CHAR(28)     NULL,
  `type`            VARCHAR(20)  NOT NULL  COMMENT 'order, receipt, cancel, zreport, test',
  `payload`         LONGBLOB     NOT NULL  COMMENT 'ESC/POS bytes (raw binary)',
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'pending'  COMMENT 'pending, printing, printed, failed',
  `attempts`        INT          NOT NULL DEFAULT 0,
  `last_error`      VARCHAR(500) NULL,
  `idempotency_key` CHAR(36)     NOT NULL,
  `queued_at`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `printed_at`      DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_print_jobs_idempotency` (`restaurant_id`, `idempotency_key`),
  KEY `idx_pj_pending` (`restaurant_id`, `printer_id`, `status`, `queued_at`),
  KEY `idx_pj_order` (`order_id`),
  KEY `idx_pj_payment` (`payment_id`),
  CONSTRAINT `fk_pj_printer`  FOREIGN KEY (`printer_id`)  REFERENCES `printers`(`id`),
  CONSTRAINT `fk_pj_order`   FOREIGN KEY (`order_id`)    REFERENCES `orders`(`id`),
  CONSTRAINT `fk_pj_payment` FOREIGN KEY (`payment_id`)   REFERENCES `payments`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 28. receipts  (printed receipt log + content for reprint)
-- ============================================================
CREATE TABLE IF NOT EXISTS `receipts` (
  `id`              CHAR(28)      NOT NULL,
  `restaurant_id`   CHAR(28)      NOT NULL,
  `payment_id`      CHAR(28)      NOT NULL,
  `order_id`        CHAR(28)      NOT NULL,
  `content`         LONGTEXT      NOT NULL  COMMENT 'formatted receipt text',
  `paper_width`     INT           NOT NULL DEFAULT 58,
  `printed_count`   INT           NOT NULL DEFAULT 0,
  `last_printed_at` DATETIME(3)   NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipts_payment` (`payment_id`),
  KEY `idx_receipts_restaurant_time` (`restaurant_id`, `created_at`),
  KEY `idx_receipts_order` (`order_id`),
  CONSTRAINT `fk_receipts_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`),
  CONSTRAINT `fk_receipts_order`   FOREIGN KEY (`order_id`)   REFERENCES `orders`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 29. audit_logs  (immutable, append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `user_id`         CHAR(28)     NULL,
  `action`          VARCHAR(80)  NOT NULL  COMMENT 'create, update, delete, login, ...',
  `entity`          VARCHAR(50)  NOT NULL  COMMENT 'order, payment, product, ...',
  `entity_id`       CHAR(28)     NULL,
  `before`          JSON         NULL,
  `after`           JSON         NULL,
  `ip`              VARCHAR(45)  NULL,
  `user_agent`      VARCHAR(255) NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_audit_restaurant_time` (`restaurant_id`, `created_at`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_entity` (`restaurant_id`, `entity`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Append-only audit log';

-- ============================================================
-- 30. backups
-- ============================================================
CREATE TABLE IF NOT EXISTS `backups` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NULL  COMMENT 'NULL = global backup',
  `type`            VARCHAR(20)  NOT NULL  COMMENT 'auto, manual, migration',
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'pending'  COMMENT 'pending, running, completed, failed',
  `size_bytes`      BIGINT       NOT NULL DEFAULT 0,
  `storage_url`     VARCHAR(500) NULL,
  `tables_count`    INT          NOT NULL DEFAULT 0,
  `rows_count`      BIGINT       NOT NULL DEFAULT 0,
  `checksum`        CHAR(64)     NULL,
  `started_at`      DATETIME(3)  NULL,
  `completed_at`    DATETIME(3)  NULL,
  `triggered_by`    CHAR(28)     NULL,
  `note`            VARCHAR(500) NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_backups_restaurant_time` (`restaurant_id`, `created_at`),
  KEY `idx_backups_status` (`status`),
  CONSTRAINT `fk_backups_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_backups_user`      FOREIGN KEY (`triggered_by`)    REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 31. sync_queue  (offline operations pending sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS `sync_queue` (
  `id`                  BIGINT       NOT NULL AUTO_INCREMENT,
  `restaurant_id`       CHAR(28)     NOT NULL,
  `device_id`           CHAR(36)     NOT NULL  COMMENT 'UUID of offline device',
  `user_id`             CHAR(28)     NULL,
  `entity`              VARCHAR(50)  NOT NULL  COMMENT 'order, order_item, payment, ...',
  `entity_id`           CHAR(28)     NULL,
  `operation`           VARCHAR(20)  NOT NULL  COMMENT 'create, update, delete',
  `payload`             JSON         NOT NULL,
  `idempotency_key`     CHAR(36)     NOT NULL,
  `client_version`      BIGINT       NOT NULL DEFAULT 0  COMMENT 'entity version on client side',
  `status`              VARCHAR(20)  NOT NULL DEFAULT 'pending'  COMMENT 'pending, syncing, synced, conflict, failed',
  `attempts`            INT          NOT NULL DEFAULT 0,
  `last_error`          VARCHAR(500) NULL,
  `server_entity_id`    CHAR(28)     NULL  COMMENT 'assigned after sync',
  `created_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `synced_at`           DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sync_idempotency` (`restaurant_id`, `idempotency_key`),
  KEY `idx_sync_status` (`restaurant_id`, `status`, `created_at`),
  KEY `idx_sync_device` (`device_id`, `status`),
  KEY `idx_sync_entity` (`entity`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 32. devices  (offline devices register)
-- ============================================================
CREATE TABLE IF NOT EXISTS `devices` (
  `id`              CHAR(36)     NOT NULL  COMMENT 'UUID generated client-side',
  `restaurant_id`   CHAR(28)     NOT NULL,
  `user_id`         CHAR(28)     NULL,
  `name`            VARCHAR(150) NULL,
  `type`            VARCHAR(30)  NOT NULL  COMMENT 'pos, tablet, phone, kitchen_screen, kebab_screen',
  `last_seen_at`    DATETIME(3)  NULL,
  `last_sync_at`    DATETIME(3)  NULL,
  `last_sync_version` BIGINT    NOT NULL DEFAULT 0,
  `is_active`       TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_devices_restaurant` (`restaurant_id`),
  CONSTRAINT `fk_devices_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  CONSTRAINT `fk_devices_user`       FOREIGN KEY (`user_id`)       REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 33. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`              CHAR(28)     NOT NULL,
  `restaurant_id`   CHAR(28)     NOT NULL,
  `user_id`         CHAR(28)     NULL  COMMENT 'NULL = broadcast to restaurant',
  `type`            VARCHAR(50)  NOT NULL  COMMENT 'low_stock, order_ready, printer_offline, ...',
  `title`           VARCHAR(200) NOT NULL,
  `message`        TEXT         NOT NULL,
  `data`            JSON         NULL,
  `is_read`         TINYINT(1)   NOT NULL DEFAULT 0,
  `read_at`         DATETIME(3)  NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_unread` (`restaurant_id`, `user_id`, `is_read`),
  KEY `idx_notifications_type` (`restaurant_id`, `type`),
  CONSTRAINT `fk_notifications_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 34. __migrations  (migration tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS `__migrations` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `version`         VARCHAR(40)  NOT NULL  COMMENT 'e.g. 20260812_001_initial',
  `name`            VARCHAR(200) NOT NULL,
  `applied_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `checksum`        CHAR(64)     NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_migrations_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
