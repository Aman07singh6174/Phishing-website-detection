import "dotenv/config";
import express from "express";
import cors from "cors";
import { analyzeUrl } from "./analyzer.js";
import { checkSafeBrowsing } from "./safe-browsing.js";
import { getDashboardStats, initializeDatabase, listScans, pingDatabase, saveScan } from "./database.js";

const app = express();
const port = Number(process.env.PORT || 3001);

app.disable("x-powered-by");
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "8kb", strict: true }));

app.get("/api/health", async (_request, response) => {
  try {
    await pingDatabase();
    response.json({ status: "ok", database: "connected", safeBrowsing: Boolean(process.env.GOOGLE_SAFE_BROWSING_API_KEY) });
  } catch {
    response.status(503).json({ status: "degraded", database: "unavailable", safeBrowsing: Boolean(process.env.GOOGLE_SAFE_BROWSING_API_KEY) });
  }
});

app.post("/api/scans", async (request, response) => {
  let analysis;
  try {
    analysis = analyzeUrl(request.body?.url);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }

  try {
    analysis.reputation = await checkSafeBrowsing(analysis.normalizedUrl, process.env.GOOGLE_SAFE_BROWSING_API_KEY);
    if (analysis.reputation.status === "match") {
      analysis.riskScore = Math.max(analysis.riskScore, 85);
      analysis.riskLevel = "Critical";
      analysis.indicators.unshift({
        id: "threat-intelligence-match",
        title: "Threat-intelligence match",
        detail: `Google Safe Browsing reports this URL as ${analysis.reputation.matches.map((match) => match.threatType).join(", ")}.`,
        points: 85,
        severity: "danger"
      });
      analysis.recommendations = [
        "Do not visit this website or enter any information.",
        "If you received this link in a message, report or delete the message.",
        "If you already entered credentials, change them using the service’s official website."
      ];
    }
    const scan = await saveScan(analysis);
    return response.status(201).json(scan);
  } catch (error) {
    console.error("Scan processing failed:", error?.message || "Unknown error");
    return response.status(503).json({ error: "The scan could not be saved. Check the database connection and try again." });
  }
});

app.get("/api/scans", async (request, response) => {
  const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 150) : "";
  const risk = typeof request.query.risk === "string" ? request.query.risk : "";
  const requestedLimit = Number.parseInt(request.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 100;
  try {
    response.json(await listScans({ search, risk, limit }));
  } catch (error) {
    console.error("Scan history query failed:", error?.message || "Unknown error");
    response.status(503).json({ error: "Scan history is currently unavailable." });
  }
});

app.get("/api/dashboard", async (_request, response) => {
  try {
    response.json(await getDashboardStats());
  } catch (error) {
    console.error("Dashboard query failed:", error?.message || "Unknown error");
    response.status(503).json({ error: "Dashboard statistics are currently unavailable." });
  }
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Request body must contain valid JSON." });
  }
  if (error?.type === "entity.too.large") {
    return response.status(413).json({ error: "Request body is too large." });
  }
  console.error("Unhandled API error:", error?.message || "Unknown error");
  return response.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, async () => {
  try {
    await initializeDatabase();
    console.log(`PhishGuard API ready on http://localhost:${port}`);
  } catch (error) {
    console.error("Database initialization failed:", error?.message || "Unknown database error");
    console.error("Check MySQL is running and the DB_* settings in .env.");
  }
});
