CREATE DATABASE IF NOT EXISTS phishguard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE phishguard;

CREATE TABLE IF NOT EXISTS scans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(2048) NOT NULL,
  hostname VARCHAR(253) NOT NULL,
  risk_score TINYINT UNSIGNED NOT NULL,
  risk_level ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
  https TINYINT(1) NOT NULL,
  indicators JSON NOT NULL,
  recommendations JSON NOT NULL,
  reputation JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scans_created_at (created_at),
  INDEX idx_scans_risk_level (risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
