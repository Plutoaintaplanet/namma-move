// routes/stops.js  — GET /api/stops/nearby?lat=&lon=&r=
const express = require("express");
const { driver } = require("../db");
const router = express.Router();

const DB = process.env.NEO4J_DATABASE || "neo4j";

async function runRead(cypher, params) {
    const session = driver.session({ database: DB });
    try {
        const res = await session.executeRead(tx => tx.run(cypher, params));
        return res.records;
    } finally {
        await session.close();
    }
}

router.get("/nearby", async (req, res) => {
    const { lat, lon, r = 3000 } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: "lat and lon required" });

    try {
        const recs = await runRead(
            `MATCH (s:Stop)
       WITH s, point.distance(
         point({latitude: s.lat, longitude: s.lon}),
         point({latitude: $lat, longitude: $lon})
       ) AS dist
       WHERE dist <= $r
       RETURN s.id AS id, s.name AS name, s.lat AS lat, s.lon AS lon, s.type AS type, dist
       ORDER BY dist LIMIT 20`,
            { lat: parseFloat(lat), lon: parseFloat(lon), r: parseFloat(r) }
        );
        const stops = recs.map(r => ({
            id: r.get("id"), name: r.get("name"), lat: r.get("lat"),
            lon: r.get("lon"), type: r.get("type"), distance: Math.round(r.get("dist")),
        }));
        res.json({ stops });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const recs = await runRead(`MATCH (s:Stop {id: $id}) RETURN s`, { id: req.params.id });
        if (recs.length === 0) return res.status(404).json({ error: "Stop not found" });
        res.json(recs[0].get("s").properties);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
