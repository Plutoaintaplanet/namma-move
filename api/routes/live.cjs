// routes/live.js  — GET /api/live/:stopId
const express = require("express");
const { driver } = require("../db.cjs");
const router = express.Router();

const DB = process.env.NEO4J_DATABASE || "neo4j";

function fmtTime(d) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

router.get("/:stopId", async (req, res) => {
    const { stopId } = req.params;
    const session = driver.session({ database: DB });
    try {
        const result = await session.executeRead(tx =>
            tx.run(
                `MATCH (s:Stop {id: $id})-[r:CONNECTS]->(next:Stop)
         RETURN DISTINCT r.route_id AS routeId, r.route_name AS routeName,
                         r.route_type AS routeType, next.name AS towards
         LIMIT 10`,
                { id: stopId }
            )
        );
        const now = new Date();
        const departures = result.records.map(rec => {
            const rType = rec.get("routeType");
            const h = now.getHours(), m = now.getMinutes();
            const inSvc = rType === 1 ? h >= 5 && (h < 22 || (h === 22 && m < 30)) : h >= 5 && h < 23;
            const peak = (h >= 7 && h < 10) || (h >= 17 && h < 20);
            const freq = rType === 1 ? (peak ? 6 : 10) : (peak ? 8 : 15);
            const wait = inSvc ? freq - (m % freq) : null;
            const nextArr = [];
            if (inSvc && wait !== null) {
                for (let i = 0; i < 3; i++) {
                    const d = new Date(now); d.setMinutes(d.getMinutes() + wait + i * freq); nextArr.push(fmtTime(d));
                }
            }
            return {
                routeId: rec.get("routeId"), routeName: rec.get("routeName"),
                routeType: rType, towards: rec.get("towards"),
                mode: rType === 1 ? "metro" : "bus", inService: inSvc,
                frequency: inSvc ? `Every ${freq} min` : "Not in service",
                nextDepartures: nextArr, dataType: "schedule",
            };
        });
        res.json({ stopId, departures, ts: now.toISOString() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally {
        await session.close();
    }
});

module.exports = router;
