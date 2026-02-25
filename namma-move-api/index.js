require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ping } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/stops", require("./routes/stops"));
app.use("/api/route", require("./routes/route"));
app.use("/api/live", require("./routes/live"));
app.use("/api/news", require("./routes/news"));

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
    try {
        await ping();
        res.json({ status: "ok", db: "neo4j connected", ts: new Date().toISOString() });
    } catch (e) {
        res.status(503).json({ status: "error", message: e.message });
    }
});

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Start ─────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`\n🚀 Namma Move API running on http://localhost:${PORT}`);
        console.log(`   Neo4j: ${process.env.NEO4J_URI}`);
        ping()
            .then(() => console.log("   ✅ Neo4j connection OK"))
            .catch(e => console.warn("   ⚠  Neo4j connection failed:", e.message));
    });
}

// Export for Vercel serverless
module.exports = app;
