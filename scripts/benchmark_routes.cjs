/**
 * benchmark_routes.cjs
 * ─────────────────────────────────────────────────────────────────────────
 * Runs 100 real Bangalore route pairs through:
 *   1. Namma Move local API  (localhost:4001)
 *   2. Google Maps Directions API (Transit mode)
 *
 * Then compares total travel time, transit mode breakdown, and route
 * availability, and writes a full JSON + human-readable report.
 *
 * Usage:
 *   node scripts/benchmark_routes.cjs --gmaps-key=YOUR_API_KEY
 *   node scripts/benchmark_routes.cjs --gmaps-key=YOUR_API_KEY --output=results.json
 * ─────────────────────────────────────────────────────────────────────────
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ── Config ────────────────────────────────────────────────────────────────
const NAMMA_API = 'http://localhost:4000/api/route';
const GMAPS_API = 'https://maps.googleapis.com/maps/api/directions/json';
const CONCURRENCY = 3; // concurrent pairs to test at once
const ARRIVAL_THRESHOLD_MIN = 15; // ±15 mins is "close enough"

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v || true];
  })
);
const GMAPS_KEY = args['gmaps-key'] || process.env.GOOGLE_MAPS_API_KEY || '';
const OUTPUT_FILE = args['output'] || path.join(__dirname, '..', 'benchmark_results.json');

const GMAPS_ENABLED = !!GMAPS_KEY;
if (!GMAPS_ENABLED) {
  console.warn('\n⚠️  No Google Maps key — running Namma Move–only coverage benchmark.\n');
}

// ── 100 real Bangalore origin→destination pairs ───────────────────────────
// Format: [name, fromLat, fromLon, toLat, toLon]
const TEST_PAIRS = [
  // Central ↔ North
  ['MG Road → Hebbal',               12.9750, 77.6070, 13.0350, 77.5970],
  ['Majestic → Yelahanka',            12.9777, 77.5713, 13.1006, 77.5946],
  ['KR Market → RT Nagar',            12.9625, 77.5756, 13.0213, 77.5997],
  ['Shivajinagar → Manyata Tech Park',12.9855, 77.6003, 13.0476, 77.6209],
  ['City Railway → Sahakar Nagar',    12.9774, 77.5713, 13.0490, 77.5764],

  // Central ↔ South
  ['MG Road → Banashankari',          12.9750, 77.6070, 12.9258, 77.5461],
  ['Majestic → Electronic City',      12.9777, 77.5713, 12.8396, 77.6768],
  ['Shivajinagar → Jayanagar',        12.9855, 77.6003, 12.9252, 77.5933],
  ['KR Market → BTM Layout',         12.9625, 77.5756, 12.9166, 77.6101],
  ['Majestic → Silk Board',           12.9777, 77.5713, 12.9176, 77.6228],

  // Central ↔ East
  ['MG Road → Whitefield',            12.9750, 77.6070, 12.9698, 77.7500],
  ['Shivajinagar → Marathahalli',     12.9855, 77.6003, 12.9591, 77.7008],
  ['KR Market → Indiranagar',         12.9625, 77.5756, 12.9784, 77.6408],
  ['Majestic → Domlur',               12.9777, 77.5713, 12.9612, 77.6385],
  ['City Market → HAL Airport Road',  12.9625, 77.5756, 12.9595, 77.6489],

  // Central ↔ West
  ['MG Road → Rajajinagar',           12.9750, 77.6070, 12.9917, 77.5570],
  ['Majestic → Peenya',               12.9777, 77.5713, 13.0287, 77.5238],
  ['KR Market → Yeshwanthpur',        12.9625, 77.5756, 13.0173, 77.5455],
  ['Shivajinagar → Tumkur Road',      12.9855, 77.6003, 13.0173, 77.5374],

  // South ↔ North
  ['Electronic City → Hebbal',        12.8396, 77.6768, 13.0350, 77.5970],
  ['Jayanagar → Yelahanka',           12.9252, 77.5933, 13.1006, 77.5946],
  ['BTM → Manyata Tech Park',         12.9166, 77.6101, 13.0476, 77.6209],
  ['Banashankari → RT Nagar',         12.9258, 77.5461, 13.0213, 77.5997],
  ['Silk Board → Sahakar Nagar',      12.9176, 77.6228, 13.0490, 77.5764],

  // South ↔ East
  ['Banashankari → Whitefield',       12.9258, 77.5461, 12.9698, 77.7500],
  ['Electronic City → Marathahalli',  12.8396, 77.6768, 12.9591, 77.7008],
  ['BTM → Indiranagar',               12.9166, 77.6101, 12.9784, 77.6408],
  ['Jayanagar → Koramangala',         12.9252, 77.5933, 12.9279, 77.6271],
  ['Silk Board → Whitefield',         12.9176, 77.6228, 12.9698, 77.7500],

  // East ↔ West
  ['Whitefield → Peenya',             12.9698, 77.7500, 13.0287, 77.5238],
  ['Marathahalli → Rajajinagar',      12.9591, 77.7008, 12.9917, 77.5570],
  ['Indiranagar → Yeshwanthpur',      12.9784, 77.6408, 13.0173, 77.5455],
  ['Domlur → Peenya Industrial',      12.9612, 77.6385, 13.0287, 77.5238],
  ['HAL → Rajajinagar',               12.9595, 77.6489, 12.9917, 77.5570],

  // Metro-heavy corridors
  ['Baiyappanahalli → Mysore Road',   12.9845, 77.6657, 12.9575, 77.5284],
  ['MG Road → Nagasandra',            12.9750, 77.6070, 13.0511, 77.5128],
  ['Cubbon Park → Vajrahalli',        12.9763, 77.5929, 12.8315, 77.5458],
  ['Trinity → Peenya',                12.9695, 77.6198, 13.0287, 77.5238],
  ['Indiranagar → Dasarahalli',       12.9784, 77.6408, 13.0280, 77.5135],

  // Bus-heavy corridors
  ['Yelahanka → Electronic City',     13.1006, 77.5946, 12.8396, 77.6768],
  ['Tumkur Road → Sarjapur',          13.0173, 77.5374, 12.9102, 77.6963],
  ['Peenya → Hosur Road',             13.0287, 77.5238, 12.9011, 77.6269],
  ['Nagasandra → Koramangala',        13.0511, 77.5128, 12.9279, 77.6271],
  ['Hebbal → BTM Layout',             13.0350, 77.5970, 12.9166, 77.6101],

  // Short hops (< 5km)
  ['Cubbon Park → MG Road',           12.9763, 77.5929, 12.9750, 77.6070],
  ['Jayanagar → Lalbagh',             12.9252, 77.5933, 12.9507, 77.5848],
  ['Koramangala → Indiranagar',       12.9279, 77.6271, 12.9784, 77.6408],
  ['Marathahalli → Whitefield',       12.9591, 77.7008, 12.9698, 77.7500],
  ['Rajajinagar → Yeshwanthpur',      12.9917, 77.5570, 13.0173, 77.5455],

  // Long cross-city (> 20km)
  ['Yelahanka → Electronic City',     13.1006, 77.5946, 12.8396, 77.6768],
  ['Peenya → Whitefield',             13.0287, 77.5238, 12.9698, 77.7500],
  ['Banashankari → Hebbal',           12.9258, 77.5461, 13.0350, 77.5970],
  ['Electronic City → Nagasandra',    12.8396, 77.6768, 13.0511, 77.5128],
  ['Sarjapur → Yelahanka',            12.9102, 77.6963, 13.1006, 77.5946],

  // Airport adjacent
  ['Devanahalli → MG Road',          13.2230, 77.7080, 12.9750, 77.6070],
  ['Devanahalli → Whitefield',       13.2230, 77.7080, 12.9698, 77.7500],
  ['Yelahanka → Kempegowda Airport', 13.1006, 77.5946, 13.2230, 77.7080],
  ['Hebbal → Devanahalli',           13.0350, 77.5970, 13.2230, 77.7080],
  ['Manyata → Airport',              13.0476, 77.6209, 13.2230, 77.7080],

  // IT clusters
  ['Whitefield → Outer Ring Road',   12.9698, 77.7500, 12.9373, 77.6961],
  ['Marathahalli → Bellandur',       12.9591, 77.7008, 12.9262, 77.6796],
  ['Electronic City → Sarjapur',     12.8396, 77.6768, 12.9102, 77.6963],
  ['Manyata → Whitefield',           13.0476, 77.6209, 12.9698, 77.7500],
  ['Outer Ring Road → Indiranagar',  12.9373, 77.6961, 12.9784, 77.6408],

  // Residential ↔ Commercial
  ['Vijayanagar → MG Road',          12.9714, 77.5346, 12.9750, 77.6070],
  ['JP Nagar → Whitefield',          12.9062, 77.5849, 12.9698, 77.7500],
  ['Malleshwaram → Koramangala',     13.0037, 77.5688, 12.9279, 77.6271],
  ['Sahakara Nagar → Electronic City', 13.0490, 77.5764, 12.8396, 77.6768],
  ['Kengeri → Silk Board',           12.9084, 77.4831, 12.9176, 77.6228],

  // Hospital / education zones
  ['Victoria Hospital → Jayanagar',  12.9601, 77.5757, 12.9252, 77.5933],
  ['Nimhans → Indiranagar',          12.9396, 77.5956, 12.9784, 77.6408],
  ['IISc → MG Road',                 13.0213, 77.5706, 12.9750, 77.6070],
  ['NIMHANS → Electronic City',      12.9396, 77.5956, 12.8396, 77.6768],
  ['Kidwai → Whitefield',            12.9447, 77.5969, 12.9698, 77.7500],

  // Night / less-connected routes
  ['Kengeri → Yelahanka',            12.9084, 77.4831, 13.1006, 77.5946],
  ['Nagarbhavi → Marathahalli',      12.9590, 77.5099, 12.9591, 77.7008],
  ['Basaveshwara Nagar → Domlur',    12.9880, 77.5415, 12.9612, 77.6385],
  ['HSR Layout → Rajajinagar',       12.9116, 77.6392, 12.9917, 77.5570],
  ['Bommanahalli → Peenya',          12.9068, 77.6262, 13.0287, 77.5238],

  // Suburb ↔ suburb
  ['Whitefield → Sarjapur',          12.9698, 77.7500, 12.9102, 77.6963],
  ['Yelahanka → Manyata',            13.1006, 77.5946, 13.0476, 77.6209],
  ['Devanahalli → Hebbal',           13.2230, 77.7080, 13.0350, 77.5970],
  ['Peenya → Nagasandra',            13.0287, 77.5238, 13.0511, 77.5128],
  ['Sarjapur → Bellandur',           12.9102, 77.6963, 12.9262, 77.6796],

  // Mixed mode expected
  ['Baiyappanahalli → Electronic City', 12.9845, 77.6657, 12.8396, 77.6768],
  ['Indiranagar → Manyata Tech Park',   12.9784, 77.6408, 13.0476, 77.6209],
  ['Whitefield → Jayanagar',            12.9698, 77.7500, 12.9252, 77.5933],
  ['MG Road → Electronic City',         12.9750, 77.6070, 12.8396, 77.6768],
  ['Marathahalli → BTM',                12.9591, 77.7008, 12.9166, 77.6101],

  // Remaining diverse pairs
  ['Koramangala → Peenya',           12.9279, 77.6271, 13.0287, 77.5238],
  ['Hebbal → Whitefield',            13.0350, 77.5970, 12.9698, 77.7500],
  ['BTM → Manyata',                  12.9166, 77.6101, 13.0476, 77.6209],
  ['Jayanagar → Hebbal',             12.9252, 77.5933, 13.0350, 77.5970],
  ['Rajajinagar → Bellandur',        12.9917, 77.5570, 12.9262, 77.6796],
  ['IISc → Whitefield',              13.0213, 77.5706, 12.9698, 77.7500],
  ['Vijayanagar → Electronic City',  12.9714, 77.5346, 12.8396, 77.6768],
  ['Kengeri → Marathahalli',         12.9084, 77.4831, 12.9591, 77.7008],
  ['JP Nagar → Yelahanka',           12.9062, 77.5849, 13.1006, 77.5946],
  ['Malleshwaram → BTM',             13.0037, 77.5688, 12.9166, 77.6101],
];

// ── HTTP helpers ──────────────────────────────────────────────────────────
function fetchJson(url, isHttps = true) {
  return new Promise((resolve, reject) => {
    const lib = isHttps ? https : http;
    lib.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

// ── API callers ───────────────────────────────────────────────────────────
async function queryNammaMove(fLat, fLon, tLat, tLon) {
  const url = `${NAMMA_API}?fromLat=${fLat}&fromLon=${fLon}&toLat=${tLat}&toLon=${tLon}`;
  try {
    const t0 = Date.now();
    const data = await fetchJson(url, false);
    const latency = Date.now() - t0;
    if (!data || !data.routes) return { found: false, latency };
    const best = data.routes[0];
    return {
      found: true,
      latency,
      totalMins: best?.totalMins ?? null,
      fare: best?.fare ?? null,
      cls: best?.cls ?? null,
      legs: best?.legs?.length ?? 0,
      routeCount: data.routes.length,
    };
  } catch { return { found: false, latency: 0, error: true }; }
}

async function queryGoogleMaps(fLat, fLon, tLat, tLon) {
  // Use 8am tomorrow to get transit results in any timezone
  const tomorrow8am = new Date();
  tomorrow8am.setDate(tomorrow8am.getDate() + 1);
  tomorrow8am.setHours(8, 0, 0, 0);
  const departure = Math.floor(tomorrow8am.getTime() / 1000);

  const url = `${GMAPS_API}?origin=${fLat},${fLon}&destination=${tLat},${tLon}` +
    `&mode=transit&departure_time=${departure}&key=${GMAPS_KEY}`;
  try {
    const t0 = Date.now();
    const data = await fetchJson(url, true);
    const latency = Date.now() - t0;
    if (!data || data.status !== 'OK' || !data.routes?.length) {
      return { found: false, latency, gmapsStatus: data?.status };
    }
    const leg = data.routes[0].legs[0];
    const totalMins = Math.round(leg.duration.value / 60);
    // Extract transit steps
    const transitSteps = (leg.steps || []).filter(s => s.travel_mode === 'TRANSIT');
    const modes = [...new Set(transitSteps.map(s =>
      s.transit_details?.line?.vehicle?.type?.toLowerCase() ?? 'transit'))];
    const hasMetro  = modes.some(m => m.includes('subway') || m.includes('metro') || m.includes('heavy_rail'));
    const hasBus    = modes.some(m => m.includes('bus'));
    const cls       = hasMetro && hasBus ? 'combo' : hasMetro ? 'metro' : hasBus ? 'bus' : 'other';
    return {
      found: true,
      latency,
      totalMins,
      legs: transitSteps.length,
      cls,
      fare: null, // Google doesn't always return fares
    };
  } catch (e) { return { found: false, latency: 0, error: true, msg: e.message }; }
}

// ── Concurrency helper ────────────────────────────────────────────────────
async function pMap(items, fn, concurrency) {
  const results = [];
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

// ── Comparison logic ──────────────────────────────────────────────────────
function compareResults(namma, gmaps) {
  if (!namma.found && !gmaps.found) return { status: 'both_no_route' };
  if (!namma.found && gmaps.found)  return { status: 'namma_missing', timeDiff: null };
  if (namma.found  && !gmaps.found) return { status: 'gmaps_missing', timeDiff: null };

  const timeDiff = namma.totalMins - gmaps.totalMins;
  const withinThreshold = Math.abs(timeDiff) <= ARRIVAL_THRESHOLD_MIN;
  const modeMatch = namma.cls === gmaps.cls;

  return {
    status: withinThreshold ? 'accurate' : 'time_divergent',
    timeDiff,
    withinThreshold,
    modeMatch,
    nammaLeads: timeDiff < 0,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Namma Move Benchmark' + (GMAPS_ENABLED ? ' vs Google Maps' : ' — Coverage Mode'));
  console.log('═'.repeat(62));
  console.log(`  API: ${NAMMA_API}`);
  console.log(`  Test pairs: ${TEST_PAIRS.length}`);
  console.log(`  Google comparison: ${GMAPS_ENABLED ? 'YES' : 'NO (Directions API key required)'}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  if (GMAPS_ENABLED) console.log(`  Threshold: ±${ARRIVAL_THRESHOLD_MIN} min\n`);

  const results = await pMap(TEST_PAIRS, async ([name, fLat, fLon, tLat, tLon], idx) => {
    const namma = await queryNammaMove(fLat, fLon, tLat, tLon);
    const gmaps = GMAPS_ENABLED
      ? await queryGoogleMaps(fLat, fLon, tLat, tLon)
      : { found: null }; // null = not tested

    const comparison = GMAPS_ENABLED ? compareResults(namma, gmaps) : { status: 'not_tested' };

    const icon = !GMAPS_ENABLED
      ? (namma.found ? '✅' : '❌')
      : comparison.status === 'accurate'       ? '✅'
      : comparison.status === 'time_divergent' ? '⚠️ '
      : comparison.status === 'namma_missing'  ? '❌'
      : comparison.status === 'gmaps_missing'  ? '🔵'
      : '⬛';

    const detail = GMAPS_ENABLED
      ? `Namma: ${namma.found ? `${namma.totalMins}min` : 'no route'}, ` +
        `GMaps: ${gmaps.found ? `${gmaps.totalMins}min` : `no route (${gmaps.gmapsStatus || 'err'})`} ` +
        `| diff: ${comparison.timeDiff != null ? `${comparison.timeDiff > 0 ? '+' : ''}${comparison.timeDiff}min` : 'n/a'}`
      : namma.found
        ? `${namma.totalMins}min | ${namma.cls} | ${namma.routeCount} options | ${namma.latency}ms`
        : `no route found`;

    process.stdout.write(`[${String(idx+1).padStart(3,' ')}/100] ${icon}  ${name.padEnd(40,' ')} ${detail}\n`);

    return { idx, name, fLat, fLon, tLat, tLon, namma, gmaps, comparison };
  }, CONCURRENCY);

  // ── Statistics ────────────────────────────────────────────────────────
  const found     = results.filter(r => r.namma.found);
  const notFound  = results.filter(r => !r.namma.found);
  const coveragePct = ((found.length / results.length) * 100).toFixed(1);

  const avgLatency = found.length
    ? (found.reduce((s, r) => s + r.namma.latency, 0) / found.length).toFixed(0)
    : 'n/a';

  const avgTime = found.length
    ? (found.reduce((s, r) => s + r.namma.totalMins, 0) / found.length).toFixed(1)
    : 'n/a';

  const clsDist = found.reduce((acc, r) => {
    acc[r.namma.cls] = (acc[r.namma.cls] || 0) + 1; return acc;
  }, {});

  const avgOptions = found.length
    ? (found.reduce((s, r) => s + r.namma.routeCount, 0) / found.length).toFixed(1)
    : 'n/a';

  // ── Comparison stats (if Google ran) ─────────────────────────────────
  const withBothRoutes = results.filter(r => r.namma.found && r.gmaps?.found);
  const accurate       = results.filter(r => r.comparison.status === 'accurate');
  const divergent      = results.filter(r => r.comparison.status === 'time_divergent');
  const nammaMissing   = results.filter(r => r.comparison.status === 'namma_missing');
  const gmapsMissing   = results.filter(r => r.comparison.status === 'gmaps_missing');
  const modeMatches    = withBothRoutes.filter(r => r.comparison.modeMatch);
  const accuracyPct    = withBothRoutes.length
    ? ((accurate.length / withBothRoutes.length) * 100).toFixed(1) : 'n/a';
  const avgTimeDiff    = withBothRoutes.length
    ? (withBothRoutes.reduce((s, r) => s + Math.abs(r.comparison.timeDiff ?? 0), 0) / withBothRoutes.length).toFixed(1)
    : 'n/a';

  // ── Report ────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log('📊 NAMMA MOVE COVERAGE REPORT');
  console.log('═'.repeat(62));
  console.log(`  Routes found              : ${found.length}/100 (${coveragePct}%)`);
  console.log(`  Routes NOT found          : ${notFound.length}`);
  console.log(`  Avg response latency      : ${avgLatency}ms`);
  console.log(`  Avg best route time       : ${avgTime} min`);
  console.log(`  Avg options returned      : ${avgOptions} per query`);
  console.log(`  Mode breakdown            : metro:${clsDist.metro||0}  bus:${clsDist.bus||0}  combo:${clsDist.combo||0}`);

  if (GMAPS_ENABLED) {
    console.log('\n' + '─'.repeat(62));
    console.log('🆚 GOOGLE MAPS COMPARISON');
    console.log('─'.repeat(62));
    console.log(`  Both found route          : ${withBothRoutes.length}`);
    console.log(`  ✅ Accurate (±${ARRIVAL_THRESHOLD_MIN}min)      : ${accurate.length} (${accuracyPct}%)`);
    console.log(`  ⚠️  Time divergent          : ${divergent.length}`);
    console.log(`  ❌ Namma missing           : ${nammaMissing.length}`);
    console.log(`  🔵 Google no transit       : ${gmapsMissing.length}`);
    console.log(`  🔀 Mode agreement          : ${modeMatches.length}/${withBothRoutes.length}`);
    console.log(`  ⏱️  Avg abs time diff       : ${avgTimeDiff} min`);

    if (divergent.length) {
      console.log('\n🔎 Top divergent routes:');
      divergent
        .sort((a,b) => Math.abs(b.comparison.timeDiff) - Math.abs(a.comparison.timeDiff))
        .slice(0, 10)
        .forEach(r => {
          const d = r.comparison.timeDiff;
          console.log(`  ${r.name.padEnd(42)} ${d>0?'Namma SLOWER':'Namma FASTER'} by ${Math.abs(d)}min`);
        });
    }

    if (nammaMissing.length) {
      console.log('\n❌ Routes Namma Move missed (Google found):');
      nammaMissing.forEach(r => console.log(`  → ${r.name}`));
    }
  } else {
    console.log('\n💡 To compare against Google Maps, enable the Directions API at:');
    console.log('   https://console.cloud.google.com/apis/library/directions-backend.googleapis.com');
    console.log('   Then run: node scripts/benchmark_routes.cjs --gmaps-key=YOUR_KEY');
  }

  if (notFound.length) {
    console.log('\n❌ Routes Namma Move couldn\'t find:');
    notFound.forEach(r => console.log(`  → ${r.name}`));
  }

  // ── Write JSON ────────────────────────────────────────────────────────
  const output = {
    meta: { timestamp: new Date().toISOString(), totalPairs: results.length, threshold: ARRIVAL_THRESHOLD_MIN, nammaApiUrl: NAMMA_API, gmapsEnabled: GMAPS_ENABLED },
    stats: { coverage: coveragePct, found: found.length, notFound: notFound.length, avgLatencyMs: avgLatency, avgTimeMins: avgTime, avgOptions, clsDist,
      ...(GMAPS_ENABLED ? { withBothRoutes: withBothRoutes.length, accurate: accurate.length, accuracyPct, timeDivergent: divergent.length, nammaMissing: nammaMissing.length, gmapsMissing: gmapsMissing.length, modeAgreement: modeMatches.length, avgTimeDiffMin: avgTimeDiff } : {}) },
    results,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n💾 Full results saved to: ${OUTPUT_FILE}`);
  console.log('═'.repeat(62) + '\n');
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
