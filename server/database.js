import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "phishguard",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4"
});

export async function initializeDatabase() {
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query("SELECT 1");
}

export async function saveScan(result) {
  const [insert] = await pool.execute(
    `INSERT INTO scans (url, hostname, risk_score, risk_level, https, indicators, recommendations, reputation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.normalizedUrl,
      result.hostname,
      result.riskScore,
      result.riskLevel,
      result.https ? 1 : 0,
      JSON.stringify(result.indicators),
      JSON.stringify(result.recommendations),
      JSON.stringify(result.reputation)
    ]
  );
  const [rows] = await pool.execute("SELECT * FROM scans WHERE id = ?", [insert.insertId]);
  return mapScan(rows[0]);
}

function mapScan(row) {
  if (!row) return null;
  const json = (value) => typeof value === "string" ? JSON.parse(value) : value;
  return {
    id: String(row.id),
    url: row.url,
    hostname: row.hostname,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    https: Boolean(row.https),
    indicators: json(row.indicators),
    recommendations: json(row.recommendations),
    reputation: json(row.reputation),
    createdAt: new Date(row.created_at).toISOString()
  };
}

export async function listScans({ search = "", risk = "", limit = 100 }) {
  const conditions = [];
  const values = [];
  if (search) {
    conditions.push("(url LIKE ? OR hostname LIKE ?)");
    values.push(`%${search}%`, `%${search}%`);
  }
  if (["Low", "Medium", "High", "Critical"].includes(risk)) {
    conditions.push("risk_level = ?");
    values.push(risk);
  }
  values.push(limit);
  const [rows] = await pool.execute(
    `SELECT * FROM scans ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY created_at DESC LIMIT ?`,
    values
  );
  return rows.map(mapScan);
}

export async function getDashboardStats() {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS total,
      SUM(risk_level = 'Low') AS low,
      SUM(risk_level = 'Medium') AS medium,
      SUM(risk_level = 'High') AS high,
      SUM(risk_level = 'Critical') AS critical
    FROM scans
  `);
  const [recent] = await pool.query(`
    SELECT DATE(created_at) AS day, COUNT(*) AS total,
      SUM(risk_level IN ('High', 'Critical')) AS flagged
    FROM scans
    WHERE created_at >= CURRENT_DATE - INTERVAL 6 DAY
    GROUP BY DATE(created_at)
    ORDER BY day
  `);
  return {
    total: Number(rows[0].total),
    low: Number(rows[0].low || 0),
    medium: Number(rows[0].medium || 0),
    high: Number(rows[0].high || 0),
    critical: Number(rows[0].critical || 0),
    trend: recent.map((row) => ({ day: row.day, total: Number(row.total), flagged: Number(row.flagged || 0) }))
  };
}

export async function pingDatabase() {
  await pool.query("SELECT 1");
}
