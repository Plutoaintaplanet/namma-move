require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ping } = require("./db.cjs");

const app = express();
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
const routeRouter = require("./routes/route.cjs");
const stopsRouter = require("./routes/stops.cjs");
const liveRouter = require("./routes/live.cjs");
const newsRouter = require("./routes/news.cjs");

// Support both /api/... and /... for maximum compatibility with Vercel rewrites
app.use("/api/route", routeRouter);
app.use("/route", routeRouter);

app.use("/api/stops", stopsRouter);
app.use("/stops", stopsRouter);

app.use("/api/live", liveRouter);
app.use("/live", liveRouter);

app.use("/api/news", newsRouter);
app.use("/news", newsRouter);

// ── Health check ────────────────────────────────────────────────────────────
app.get(["/api/health", "/health"], async (_req, res) => {
    try {
        await ping();
        res.json({ 
            status: "ok", 
            db: "neo4j connected",
            env: {
                hasUri: !!process.env.NEO4J_URI,
                hasUser: !!process.env.NEO4J_USER,
                hasPass: !!process.env.NEO4J_PASSWORD,
                nodeEnv: process.env.NODE_ENV,
                isVercel: !!process.env.VERCEL
            },
            ts: new Date().toISOString() 
        });
    } catch (e) {
        console.error("Health check failed:", e.message);
        res.status(503).json({ 
            status: "error", 
            message: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined,
            env: {
                hasUri: !!process.env.NEO4J_URI,
                hasUser: !!process.env.NEO4J_USER,
                hasPass: !!process.env.NEO4J_PASSWORD
            }
        });
    }
});

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Start ─────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 4001;
    app.listen(PORT, () => {
        console.log(`\n🚀 Namma Move API running on http://localhost:${PORT}`);
        ping()
            .then(() => console.log("   ✅ Neo4j connection OK"))
            .catch(e => console.warn("   ⚠  Neo4j connection failed:", e.message));
    });
}

// Export for Vercel serverless
module.exports = app;
