const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../api/.env') });
const { getSession } = require('../api/db.cjs');

async function run() {
  const s = getSession();
  try {
    const cypher = `
      MATCH (a:Stop),(b:Stop)
      WHERE a.id IN ["M-STA-1","M-STA-2"] AND b.id IN ["M-STA-5","M-STA-6"] AND a.id<>b.id
      MATCH path=shortestPath((a)-[:CONNECTS*1..60]->(b))
      WHERE ALL(r IN relationships(path) WHERE r.route_type=1)
      RETURN a.id,b.id,
        [r IN relationships(path)|{route_id:r.route_id,route_name:r.route_name,route_type:r.route_type,travel_min:coalesce(r.travel_min,2.5)}] AS segments
      LIMIT 1
    `;
    const r = await s.run(cypher);
    if (!r.records.length) { console.log('NO RESULTS'); return; }
    const rec = r.records[0];
    const segs = rec.get('segments');
    console.log('segments count:', segs.length);
    const seg = segs[0];
    console.log('seg keys:', Object.keys(seg));
    console.log('route_type raw:', seg.route_type);
    console.log('route_type typeof:', typeof seg.route_type);
    console.log('route_type constructor:', seg.route_type?.constructor?.name);
    console.log('has toNumber:', typeof seg.route_type?.toNumber);
    
    const rt = seg.route_type;
    const rtNum = (rt && typeof rt === 'object' && rt.toNumber) ? rt.toNumber() : Number(rt);
    console.log('rtNum:', rtNum, '| is metro:', rtNum === 1);
    
    // Also check travel_min type
    console.log('travel_min:', seg.travel_min, typeof seg.travel_min, seg.travel_min?.constructor?.name);
    
  } finally { await s.close(); process.exit(0); }
}
run().catch(e => { console.error('Error:', e.message); process.exit(1); });
