// api/routes/stops.cjs — Search and Discovery for Stops
const express = require("express");
const { driver } = require("../db.cjs");
const router = express.Router();
const DB = process.env.NEO4J_DATABASE || "neo4j";

async function runRead(cypher, params = {}) {
    const s = driver.session({ database: DB });
    try {
        const r = await s.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await s.close(); }
}

// ── Search by name ────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    try {
        const cypher = `
            MATCH (s:Stop)
            WHERE s.name CONTAINS $q OR s.id CONTAINS $q
            RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type
            LIMIT 20
        `;
        const recs = await runRead(cypher, { q: q.toUpperCase() });
        res.json(recs.map(r => r.toObject()));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Nearby stops ──────────────────────────────────────────────────────────────
router.get("/nearby", async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "lat, lon required" });

    try {
        const cypher = `
            MATCH (s:Stop)
            WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
            WHERE dist < 2000
            RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type, dist
            ORDER BY dist
            LIMIT 10
        `;
        const recs = await runRead(cypher, { lat: parseFloat(lat), lon: parseFloat(lon) });
        res.json(recs.map(r => r.toObject()));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
