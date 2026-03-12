const neo4j = require('neo4j-driver');
require('dotenv').config({path: 'api/.env'});

async function run() {
    const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
    const session = driver.session({database: process.env.NEO4J_DATABASE || 'neo4j'});
    const lat=12.9734, lon=77.6205;
    const cypher = 'MATCH (s:Stop) WITH s, point.distance(s.pos, point({latitude: $lat, longitude: $lon})) AS dist WHERE dist < 3000 RETURN s.id AS id, s.name AS name, s.type AS type, dist ORDER BY dist LIMIT 15';
    try {
        const r = await session.run(cypher, {lat: lat, lon: lon});
        console.log(JSON.stringify(r.records.map(rec => rec.toObject()), null, 2));
    } finally {
        await session.close();
        await driver.close();
    }
}
run();
