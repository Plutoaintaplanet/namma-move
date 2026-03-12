require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ping } = require("./db.cjs");

const app = express();
app.use(cors());
app.use(express.json());

const routeRouter = require("./routes/route.cjs");
const stopsRouter = require("./routes/stops.cjs");
const liveRouter = require("./routes/live.cjs");
const newsRouter = require("./routes/news.cjs");

app.use("/api/route", routeRouter);
app.use("/route", routeRouter);
app.use("/api/stops", stopsRouter);
app.use("/stops", stopsRouter);
app.use("/api/live", liveRouter);
app.use("/live", liveRouter);
app.use("/api/news", newsRouter);
app.use("/news", newsRouter);

app.get(["/api/health", "/health"], async (_req, res) => {
    try {
        await ping();
        res.json({ 
            status: "ok", 
            db: "connected",
            debug: {
                uri_start: (process.env.NEO4J_URI || "").substring(0, 12),
                user_start: (process.env.NEO4J_USER || "").substring(0, 4),
                vercel: !!process.env.VERCEL
            }
        });
    } catch (e) {
        res.status(503).json({ 
            status: "error", 
            message: e.message,
            debug: {
                has_uri: !!process.env.NEO4J_URI,
                has_user: !!process.env.NEO4J_USER,
                has_pass: !!process.env.NEO4J_PASSWORD
            }
        });
    }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 4001;
    app.listen(PORT, () => console.log(`🚀 Local API: http://localhost:${PORT}`));
}

module.exports = app;
