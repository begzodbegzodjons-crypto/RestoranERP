-- ============================================================================
-- Restaurant POS V2 — Migration 004: Printer enhancements
-- ============================================================================
-- Adds retry_count, timeout, enabled columns to printers table.
-- ============================================================================

USE `oshxona_erp_v2`;

ALTER TABLE `printers`
  ADD COLUMN IF NOT EXISTS `retry_count` INT NOT NULL DEFAULT 3 COMMENT 'Max retry attempts on failure',
  ADD COLUMN IF NOT EXISTS `timeout_ms` INT NOT NULL DEFAULT 5000 COMMENT 'Connection timeout in milliseconds',
  ADD COLUMN IF NOT EXISTS `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=enabled, 0=disabled';

-- Index for enabled printers (fast lookup for print server polling)
CREATE INDEX IF NOT EXISTS `idx_printers_enabled_station` ON `printers` (`restaurant_id`, `enabled`, `station`);

-- Update existing printers to have enabled=1 (mirror is_active)
UPDATE `printers` SET `enabled` = `is_active` WHERE `enabled` IS NULL OR `enabled` = 0;
