// api/routes/route.cjs — Multi-modal Routing with Metro+Bus Combos
const express = require("express");
const { getSession } = require("../db.cjs");
const router = express.Router();

const WALK_SPD     = 78;   // metres per minute walking
const BUS_SPD      = 4.0;  // minutes per bus stop (default)
const TRANSFER_MIN = 5;    // penalty per bus↔metro interchange

function walkMin(m) { return Math.max(1, Math.round(m / WALK_SPD)); }

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function runRead(cypher, params = {}) {
    const session = getSession();
    try {
        const r = await session.executeRead(tx => tx.run(cypher, params));
        return r.records;
    } finally { await session.close(); }
}

async function nearbyStops(lat, lon) {
    const cypher = `
        MATCH (s:Stop)
        WHERE point.distance(s.pos, point({latitude: $lat, longitude: $lon})) < 10000
        WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist
        ORDER BY dist
        WITH collect({id: s.id, name: s.name, lat: s.lat, lon: s.lon, type: s.type, dist: dist}) as allStops
        RETURN
            [x IN allStops WHERE x.type = 'metro'][0..5] as metros,
            [x IN allStops WHERE x.type = 'bus' AND x.dist < 3500][0..15] as buses
    `;
    const recs = await runRead(cypher, { lat, lon });
    if (!recs.length) return { metros: [], buses: [] };
    return {
        metros: recs[0].get("metros") || [],
        buses:  recs[0].get("buses")  || []
    };
}

function processLegs(nodeList, segments) {
    if (!segments.length) return [];
    const legs = [];
    let currentLeg = null;
    for (let i = 0; i < segments.length; i++) {
        const seg      = segments[i];
        const fromNode = nodeList[i];
        const toNode   = nodeList[i + 1];
        // route_type 1 = metro/subway; everything else is bus
        // Neo4j may return route_type as a Long object, string, or number — normalise all cases
        const rt = seg.route_type;
        const rtNum = (rt && typeof rt === 'object' && rt.toNumber) ? rt.toNumber() : Number(rt);
        const mode = rtNum === 1 ? 'metro' : 'bus';
        const travelMin = Number(seg.travel_min) || BUS_SPD;

        if (currentLeg && currentLeg.route?.id === seg.route_id) {
            currentLeg.stops.push(toNode);
            currentLeg.duration += travelMin;
        } else {
            if (currentLeg) legs.push(currentLeg);
            currentLeg = {
                mode,
                route: { id: seg.route_id, name: seg.route_name, type: seg.route_type },
                duration: travelMin,
                stops: [fromNode, toNode]
            };
        }
    }
    if (currentLeg) legs.push(currentLeg);
    return legs;
}

function countInterchanges(legs) {
    let n = 0;
    for (let i = 1; i < legs.length; i++) {
        if (legs[i].mode !== legs[i - 1].mode) n++;
    }
    return n;
}

// ── Strategy 1: General shortest paths (bus, metro, or mixed) ────────────
async function findDirectPaths(oIds, dIds) {
    if (!oIds.length || !dIds.length) return [];
    const cypher = `
        MATCH (a:Stop), (b:Stop)
        WHERE a.id IN $oIds AND b.id IN $dIds AND a.id <> b.id
        MATCH path = shortestPath((a)-[:CONNECTS*1..80]->(b))
        RETURN a.id as oId, b.id as dId,
               [r IN relationships(path) | {
                   route_id:   r.route_id,
                   route_name: r.route_name,
                   route_type: r.route_type,
                   travel_min: coalesce(r.travel_min, 4.0)
               }] AS segments,
               [n IN nodes(path) | {id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type}] AS node_list,
               reduce(s = 0.0, r IN relationships(path) | s + coalesce(r.travel_min, 4.0)) as totalMin
        LIMIT 40
    `;
    return runRead(cypher, { oIds, dIds });
}

// ── Strategy 2: Pure metro paths between the nearest metro stops ─────────
async function findMetroPaths(oMetroIds, dMetroIds) {
    if (!oMetroIds.length || !dMetroIds.length) return [];
    const cypher = `
        MATCH (a:Stop), (b:Stop)
        WHERE a.id IN $oMetroIds AND b.id IN $dMetroIds AND a.id <> b.id
        MATCH path = shortestPath((a)-[:CONNECTS*1..60]->(b))
        WHERE ALL(r IN relationships(path) WHERE r.route_type = 1 OR r.route_type = '1')
        RETURN a.id as oId, b.id as dId,
               [r IN relationships(path) | {
                   route_id:   r.route_id,
                   route_name: r.route_name,
                   route_type: r.route_type,
                   travel_min: coalesce(r.travel_min, 2.5)
               }] AS segments,
               [n IN nodes(path) | {id: n.id, name: n.name, lat: n.lat, lon: n.lon, type: n.type}] AS node_list,
               reduce(s = 0.0, r IN relationships(path) | s + coalesce(r.travel_min, 2.5)) as totalMin
        LIMIT 10
    `;
    return runRead(cypher, { oMetroIds, dMetroIds });
}

// ── Strategy 3: Bus-to-metro combo via Majestic interchange ─────────────
// Find bus path from origin to nearest metro entry, then metro to nearest exit, then bus to dest.
// This surfaces combinations `shortestPath` misses because it minimises hops, not time.
async function findComboViaPivot(oIds, dIds, oBusIds, dBusIds, oMetroIds, dMetroIds) {
    if (!oBusIds.length || !dMetroIds.length) return [];

    // Phase A: Bus from origin to any metro station
    const phaseA = `
        MATCH (a:Stop), (m:Stop)
        WHERE a.id IN $oBusIds AND m.id IN $oMetroIds AND a.id <> m.id
        MATCH path = shortestPath((a)-[:CONNECTS*1..60]->(m))
        WHERE ALL(r IN relationships(path) WHERE r.route_type <> 1 AND r.route_type <> '1')
        RETURN a.id AS oId, m.id AS pivotId,
               [r IN relationships(path) | {route_id:r.route_id,route_name:r.route_name,route_type:r.route_type,travel_min:coalesce(r.travel_min,4.0)}] AS segsA,
               [n IN nodes(path) | {id:n.id,name:n.name,lat:n.lat,lon:n.lon,type:n.type}] AS nodesA,
               reduce(s=0.0, r IN relationships(path)|s+coalesce(r.travel_min,4.0)) AS tA
        LIMIT 5
    `;

    // Phase B: Metro from pivot to dest metro
    const phaseB = `
        MATCH (m:Stop), (b:Stop)
        WHERE m.id IN $oMetroIds AND b.id IN $dMetroIds AND m.id <> b.id
        MATCH path = shortestPath((m)-[:CONNECTS*1..60]->(b))
        WHERE ALL(r IN relationships(path) WHERE r.route_type = 1 OR r.route_type = '1')
        RETURN m.id AS pivotId, b.id AS exitId,
               [r IN relationships(path) | {route_id:r.route_id,route_name:r.route_name,route_type:r.route_type,travel_min:coalesce(r.travel_min,2.5)}] AS segsB,
               [n IN nodes(path) | {id:n.id,name:n.name,lat:n.lat,lon:n.lon,type:n.type}] AS nodesB,
               reduce(s=0.0, r IN relationships(path)|s+coalesce(r.travel_min,2.5)) AS tB
        LIMIT 5
    `;

    // Phase C: Bus from dest metro to destination
    const phaseC = `
        MATCH (m:Stop), (b:Stop)
        WHERE m.id IN $dMetroIds AND b.id IN $dBusIds AND m.id <> b.id
        MATCH path = shortestPath((m)-[:CONNECTS*1..60]->(b))
        WHERE ALL(r IN relationships(path) WHERE r.route_type <> 1 AND r.route_type <> '1')
        RETURN m.id AS exitId, b.id AS dId,
               [r IN relationships(path) | {route_id:r.route_id,route_name:r.route_name,route_type:r.route_type,travel_min:coalesce(r.travel_min,4.0)}] AS segsC,
               [n IN nodes(path) | {id:n.id,name:n.name,lat:n.lat,lon:n.lon,type:n.type}] AS nodesC,
               reduce(s=0.0, r IN relationships(path)|s+coalesce(r.travel_min,4.0)) AS tC
        LIMIT 5
    `;

    const [recsA, recsB, recsC] = await Promise.all([
        runRead(phaseA, { oBusIds, oMetroIds }),
        runRead(phaseB, { oMetroIds, dMetroIds }),
        runRead(phaseC, { dMetroIds, dBusIds }),
    ]);

    if (!recsA.length || !recsB.length || !recsC.length) return [];

    // Stitch best combo: take first of each phase
    const a = recsA[0];
    const b = recsB[0];
    const c = recsC[0];

    // Build a synthetic row
    const combinedSegs = [...a.get('segsA'), ...b.get('segsB'), ...c.get('segsC')];
    const combinedNodes = [
        ...a.get('nodesA'),
        ...b.get('nodesB').slice(1),
        ...c.get('nodesC').slice(1)
    ];
    const totalMin = (Number(a.get('tA')) || 0) + (Number(b.get('tB')) || 0) + (Number(c.get('tC')) || 0);

    // Return as fake record-like object
    return [{
        get: (k) => ({
            oId: a.get('oId'),
            dId: c.get('dId'),
            segments: combinedSegs,
            node_list: combinedNodes,
            totalMin
        }[k])
    }];
}

router.get("/", async (req, res) => {
    const { fromLat, fromLon, toLat, toLon, time } = req.query;
    if (!fromLat || !fromLon || !toLat || !toLon)
        return res.status(400).json({ error: "Coords missing" });

    const fLat = parseFloat(fromLat), fLon = parseFloat(fromLon);
    const tLat = parseFloat(toLat),   tLon = parseFloat(toLon);
    const baseTime = time
        ? (() => { const [h, m] = time.split(":"); const d = new Date(); d.setHours(+h, +m, 0, 0); return d; })()
        : new Date();

    try {
        const [oData, dData] = await Promise.all([
            nearbyStops(fLat, fLon),
            nearbyStops(tLat, tLon)
        ]);

        const oMetroIds = oData.metros.map(s => s.id);
        const oBusIds   = oData.buses.map(s => s.id);
        const dMetroIds = dData.metros.map(s => s.id);
        const dBusIds   = dData.buses.map(s => s.id);
        const oAllIds   = [...oMetroIds, ...oBusIds];
        const dAllIds   = [...dMetroIds, ...dBusIds];

        const distKm   = haversine(fLat, fLon, tLat, tLon) / 1000;
        const cabFare  = Math.round(100 + distKm * 18);
        const autoFare = Math.round(30  + distKm * 15);

        if (!oAllIds.length || !dAllIds.length) {
            return res.json({ routes: [], cab: { km: distKm.toFixed(1), cabFare, autoFare } });
        }

        const stopLookup = [...oData.metros, ...oData.buses, ...dData.metros, ...dData.buses]
            .reduce((m, s) => { m[s.id] = s; return m; }, {});

        // Run all three strategies in parallel
        const [generalRecs, metroRecs, comboRecs] = await Promise.all([
            findDirectPaths(oAllIds, dAllIds),
            (oMetroIds.length && dMetroIds.length) ? findMetroPaths(oMetroIds, dMetroIds) : [],
            (oBusIds.length && dBusIds.length && oMetroIds.length && dMetroIds.length)
                ? findComboViaPivot(oAllIds, dAllIds, oBusIds, dBusIds, oMetroIds, dMetroIds)
                : []
        ]);

        const allRecs = [...generalRecs, ...metroRecs, ...comboRecs];
        const results = [];

        for (const row of allRecs) {
            const oId      = row.get("oId");
            const dId      = row.get("dId");
            const segments = row.get("segments");
            const nodeList = row.get("node_list");
            const rawTotal = row.get("totalMin");
            const routeMin = (rawTotal && typeof rawTotal === 'object' && rawTotal.toNumber)
                ? rawTotal.toNumber() : Number(rawTotal) || 0;

            const oS = stopLookup[oId];
            const dS = stopLookup[dId];
            if (!oS || !dS) continue;

            const legs = processLegs(nodeList, segments);
            if (!legs.length) continue;

            const hasMetro = legs.some(l => l.mode === 'metro');
            const hasBus   = legs.some(l => l.mode === 'bus');
            const cls      = (hasMetro && hasBus) ? "combo" : hasMetro ? "metro" : "bus";

            const interchanges = countInterchanges(legs);
            const transferPen  = interchanges * TRANSFER_MIN;
            const walkTime     = walkMin(oS.dist) + walkMin(dS.dist);
            const totalMins    = walkTime + routeMin + transferPen;

            const arrive = new Date(baseTime.getTime() + totalMins * 60000)
                .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

            let fare = 0;
            legs.forEach(l => fare += (l.mode === 'metro' ? 25 : 15));

            results.push({
                legs, cls,
                totalMins:   Math.round(totalMins),
                walkingMins: Math.round(walkTime),
                transitMins: Math.round(routeMin),
                fare:        Math.min(fare, 80),
                depart:      baseTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                arrive,
                oStop:       { ...oS, walkMin: walkMin(oS.dist) },
                dStop:       { ...dS, walkMin: walkMin(dS.dist) },
                interchanges,
                labels:      []
            });
        }

        // Deduplicate: same class + same route chain + same o/d stop pair = duplicate
        const seen = new Set();
        const deduped = results
            .filter(r => {
                const key = r.cls + ':' + r.oStop.id + '->' + r.dStop.id + ':' + r.legs.map(l => l.route.id).join('+');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            // Boost metro & combo routes: subtract 8min from their sort score
            // People prefer metro over BMTC, so give it priority
            .sort((a, b) => {
                const aScore = a.totalMins - (a.cls === 'metro' ? 8 : a.cls === 'combo' ? 5 : 0);
                const bScore = b.totalMins - (b.cls === 'metro' ? 8 : b.cls === 'combo' ? 5 : 0);
                return aScore - bScore;
            });

        // Label routes
        if (deduped.length > 0) {
            deduped[0].labels.push("Recommended");

            const bestMetro = deduped.find(r => r.cls === 'metro');
            if (bestMetro && !bestMetro.labels.includes("Recommended")) bestMetro.labels.push("Metro");

            const bestCombo = deduped.find(r => r.cls === 'combo');
            if (bestCombo && !bestCombo.labels.includes("Recommended")) bestCombo.labels.push("Bus + Metro");

            const bestBus = deduped.find(r => r.cls === 'bus');
            if (bestBus && !bestBus.labels.includes("Recommended")) bestBus.labels.push("BMTC");
        }

        // Ride-hailing deep link info
        const rides = {
            uber:       { name: "Uber",         fare: Math.round(110 + distKm * 20), eta: "3-6 min" },
            ola:        { name: "Ola",         fare: cabFare, eta: "4-7 min" },
            rapido:     { name: "Rapido",      fare: Math.round(20 + distKm * 10), eta: "2-4 min" },
            nammayatri: { name: "Namma Yatri", fare: autoFare, eta: "3-5 min" },
        };

        res.json({
            routes: deduped.slice(0, 4),
            cab:    { km: distKm.toFixed(1), cabFare, autoFare, bikeFare: Math.round(20 + distKm * 10) },
            rides
        });

    } catch (e) {
        console.error("Routing Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
