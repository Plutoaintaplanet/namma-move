import { useEffect, useState, useCallback, useRef } from "react";
import DualMapPicker from "./DualMapPicker";
import NewsPage from "./NewsPage";
import SchedulesPage from "./SchedulesPage";
import { FloatingPaths } from "./components/ui/background-paths";
import { Preloader } from "./components/ui/preloader";
import stopsJson from "./data/gtfs_stops.json";
import routesJson from "./data/gtfs_routes.json";
import routeStopsJson from "./data/gtfs_route_stops.json";

// ─── Haversine ───────────────────────────────────────────────────────────────
function distM(lat1, lon1, lat2, lon2) {
  const R = 6371e3, r = d => d * Math.PI / 180;
  const φ1 = r(lat1), φ2 = r(lat2), Δφ = r(lat2 - lat1), Δλ = r(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Find nearby stops — always returns at least minCount ────────────────────
function findNearbyStops(stops, lat, lon, radiusM = 3000, minCount = 8) {
  const sorted = stops
    .map(s => ({ ...s, distance: distM(lat, lon, s.latitude, s.longitude) }))
    .sort((a, b) => a.distance - b.distance);
  const inR = sorted.filter(s => s.distance <= radiusM);
  return inR.length >= minCount ? inR : sorted.slice(0, minCount);
}

// ─── Fare helpers ─────────────────────────────────────────────────────────────
function estimateCab(distM_) {
  const km = distM_ / 1000;
  return {
    km: km.toFixed(1),
    autoFare: km <= 1.9 ? 30 : Math.round(30 + (km - 1.9) * 15),
    autoMin: Math.max(5, Math.round((km / 24) * 60)),
    cabFare: Math.max(60, Math.round(km * 14)),
    cabMin: Math.max(5, Math.round((km / 21) * 60)),
    bikeMin: Math.max(4, Math.round((km / 30) * 60)),
    bikeFare: Math.max(30, Math.round(km * 8)),
  };
}

function walkMin(m) { return Math.max(1, Math.round(m / 78)); }
function walkKm(m) { return (m / 1000).toFixed(2); }

// ─── Pre-build stop/route indexes ────────────────────────────────────────────
const stopsById = Object.fromEntries(stopsJson.map(s => [s.id, s]));

const orderedCache = {};
routesJson.forEach(r => {
  orderedCache[r.id] = routeStopsJson
    .filter(rs => rs.route_id === r.id)
    .sort((a, b) => a.stop_sequence - b.stop_sequence);
});

const routesByStop = {};
routeStopsJson.forEach(rs => {
  if (!routesByStop[rs.stop_id]) routesByStop[rs.stop_id] = new Set();
  routesByStop[rs.stop_id].add(rs.route_id);
});

// ─── The router ──────────────────────────────────────────────────────────────
function findRoute(originId, destId) {
  // Direct
  let best = null;
  routesJson.forEach(route => {
    const ord = orderedCache[route.id];
    const oI = ord.findIndex(rs => rs.stop_id === originId);
    const dI = ord.findIndex(rs => rs.stop_id === destId);
    if (oI !== -1 && dI !== -1 && oI < dI) {
      const hops = dI - oI, isM = [1, 2].includes(route.route_type);
      const mins = hops * (isM ? 2.5 : 4);
      if (!best || mins < best.mins)
        best = { type: "direct", legs: [{ route, stops: ord.slice(oI, dI + 1).map(rs => stopsById[rs.stop_id]).filter(Boolean) }], hops, mins };
    }
  });
  if (best) return best;

  // 1-interchange
  let bestM = null;
  for (const rAId of Array.from(routesByStop[originId] || [])) {
    const ordA = orderedCache[rAId] || [];
    const oIA = ordA.findIndex(rs => rs.stop_id === originId);
    if (oIA === -1) continue;
    for (let i = oIA + 1; i < ordA.length; i++) {
      const mid = ordA[i].stop_id;
      for (const rBId of Array.from(routesByStop[mid] || [])) {
        if (rBId === rAId) continue;
        const ordB = orderedCache[rBId] || [];
        const mIB = ordB.findIndex(rs => rs.stop_id === mid);
        const dIB = ordB.findIndex(rs => rs.stop_id === destId);
        if (mIB === -1 || dIB === -1 || mIB >= dIB) continue;
        const rA = routesJson.find(r => r.id === rAId), rB = routesJson.find(r => r.id === rBId);
        const hA = i - oIA, hB = dIB - mIB;
        const mins = hA * ([1, 2].includes(rA?.route_type) ? 2.5 : 4) + hB * ([1, 2].includes(rB?.route_type) ? 2.5 : 4) + 5;
        if (!bestM || mins < bestM.mins)
          bestM = {
            type: "interchange", legs: [
              { route: rA, stops: ordA.slice(oIA, i + 1).map(rs => stopsById[rs.stop_id]).filter(Boolean) },
              { route: rB, stops: ordB.slice(mIB, dIB + 1).map(rs => stopsById[rs.stop_id]).filter(Boolean) }
            ], hops: hA + hB, mins
          };
      }
    }
  }
  return bestM;
}

// ─── Classify: bus / metro / combo ───────────────────────────────────────────
function classify(r) {
  if (!r) return null;
  const types = r.legs.map(l => [1, 2].includes(l.route.route_type) ? "metro" : "bus");
  if (types.includes("metro") && types.includes("bus")) return "combo";
  if (types.includes("metro")) return "metro";
  return "bus";
}

// ─── BMTC fare table ─────────────────────────────────────────────────────────
function bmtcFare(hops) {
  if (hops <= 3) return 7;
  if (hops <= 8) return 10;
  if (hops <= 14) return 15;
  return 20;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
function fmtTime(date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function addMin(date, min) { return new Date(date.getTime() + min * 60000); }
function parseTimeInput(str) {
  // "HH:MM" input → today's Date
  const [h, m] = str.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ─── Next metro departure (schedule-based) ────────────────────────────────────
function nextMetroDeparture(baseTime) {
  const h = baseTime.getHours(), m = baseTime.getMinutes();
  const inService = h >= 5 && (h < 22 || (h === 22 && m < 30));
  if (!inService) return null;
  const peak = (h >= 7 && h < 10) || (h >= 17 && h < 20);
  const freq = peak ? 6 : 10;
  const waitMin = freq - (m % freq);
  return addMin(baseTime, waitMin > freq ? 0 : waitMin);
}

function nextBmtcDeparture(baseTime) {
  const h = baseTime.getHours();
  const inService = h >= 5 && h < 23;
  if (!inService) return null;
  const peak = (h >= 7 && h < 10) || (h >= 17 && h < 20);
  const freq = peak ? 8 : 15;
  const waitMin = freq - (baseTime.getMinutes() % freq);
  return addMin(baseTime, waitMin > freq ? 0 : waitMin);
}

const NAV = ["Home", "Schedules", "News"];

export default function App() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("nm-dark") === "1"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    try { localStorage.setItem("nm-dark", darkMode ? "1" : "0"); } catch { }
  }, [darkMode]);

  const [activePage, setActivePage] = useState("Home");
  const [originLoc, setOriginLoc] = useState(null);
  const [destLoc, setDestLoc] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState("");

  // ── Departure time controls ──────────────────────────────────────────────
  const [timeMode, setTimeMode] = useState("now");      // "now" | "leave" | "arrive"
  const [timeInput, setTimeInput] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  // ── Results ──────────────────────────────────────────────────────────────
  const [busHit, setBusHit] = useState(null);
  const [metroHit, setMetroHit] = useState(null);
  const [comboHit, setComboHit] = useState(null);
  const [cabInfo, setCabInfo] = useState(null);
  const [noRoute, setNoRoute] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [dbConnected, setDbConnected] = useState(null); // null | true | false

  // ── Database health check ──────────────────────────────────────────────────
  useEffect(() => {
    const checkDb = async () => {
      const isProd = window.location.hostname !== "localhost";
      const baseUrl = isProd ? "/api" : (import.meta.env.VITE_API_URL || "http://localhost:4001/api");
      try {
        const res = await fetch(`${baseUrl}/health`);
        const data = await res.json();
        setDbConnected(data.status === "ok");
      } catch (e) {
        setDbConnected(false);
      }
    };
    checkDb();
  }, []);

  // ── GPS auto-fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) { setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "📍 Your location" };
        setOriginLoc(loc);
        setGpsLoading(false);
      },
      err => {
        setGpsError("Location unavailable — set start manually");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Compute ───────────────────────────────────────────────────────────────
  const compute = useCallback(async (origin, dest) => {
    if (!origin || !dest) return;
    setLoading(true); setSearched(true);
    setBusHit(null); setMetroHit(null); setComboHit(null); setNoRoute("");

    const isProd = window.location.hostname !== "localhost";
    const baseUrl = isProd ? "/api" : (import.meta.env.VITE_API_URL || "http://localhost:4001/api");
    let url = `${baseUrl}/route?fromLat=${origin.lat}&fromLon=${origin.lon}&toLat=${dest.lat}&toLon=${dest.lon}`;

    if (timeMode !== "now") {
      url += `&time=${timeInput}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Routing failed");
      }
      const data = await res.json();

      setBusHit(data.bus);
      setMetroHit(data.metro);
      setComboHit(data.combo);
      setCabInfo(data.cab);

      if (!data.bus && !data.metro && !data.combo) {
        setNoRoute("No transit route found within 1 interchange.");
      }
    } catch (e) {
      console.error(e);
      setNoRoute(`Routing Error: ${e.message}.`);
    } finally {
      setLoading(false);
    }
  }, [timeMode, timeInput]);

  const handleSearch = () => {
    if (originLoc && destLoc) compute(originLoc, destLoc);
  };

  // open Google Maps walk
  const walkLink = (toStop, from) => {
    if (!from) return "#";
    return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lon}&destination=${toStop.latitude},${toStop.longitude}&travelmode=walking`;
  };
  const rideLink = app => {
    if (!destLoc) return "#";
    const m = {
      ola: `https://book.olacabs.com/?serviceType=p2p&drop_lat=${destLoc.lat}&drop_lng=${destLoc.lon}`,
      uber: `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${destLoc.lat}&dropoff[longitude]=${destLoc.lon}`,
      rapido: "https://www.rapido.bike/",
    };
    return m[app];
  };

  const bothSet = originLoc && destLoc;
  const stats = { stops: stopsJson.length, routes: routesJson.length };
  const activeStopIds = useMemo(() => new Set(routeStopsJson.map(rs => rs.stop_id)), []);

  // ─── Journey card ─────────────────────────────────────────────────────────
  function JCard({ hit, accent, icon, label }) {
    if (!hit) return null;
    // API shape: { cls, type, legs, hops, totalMins, fare, depart, arrive, nextDep, oStop, dStop }
    const { legs, hops, totalMins, fare, depart, arrive, nextDep, oStop, dStop, type } = hit;

    return (
      <div className="jcard" style={{ borderTopColor: accent }}>
        {/* Summary bar */}
        <div className="jcard-summary">
          <div className="jcard-summary-left">
            <span className="jcard-mode-icon">{icon}</span>
            <div>
              <div className="jcard-label">{label}</div>
              <div className="jcard-sub">{type === "interchange" ? "1 change" : "Direct"} · {hops} stops</div>
            </div>
          </div>
          <div className="jcard-summary-right">
            <div className="jcard-time">{Math.round(totalMins)} <span>min</span></div>
            <div className="jcard-window">{depart} → {arrive}</div>
            <div className="jcard-fare">₹{fare}</div>
          </div>
        </div>

        {/* Timeline */}
        <div className="timeline">
          {/* Walk to first stop */}
          <div className="tl-row">
            <div className="tl-dot tl-walk" />
            <div className="tl-body">
              <span className="tl-label">Walk ~{oStop?.walkMin} min</span>
              <span className="tl-stop">to {oStop?.name}</span>
            </div>
          </div>

          {legs && legs.map((leg, i) => {
            if (!leg.route) return null;
            const isMetro = leg.route.type === 1 || leg.mode === 'metro';
            const board = leg.stops && leg.stops[0], alight = leg.stops && leg.stops[leg.stops.length - 1];
            const dot = isMetro ? "tl-dot-metro" : "tl-dot-bus";
            return (
              <div className="tl-row" key={i}>
                <div className={`tl-dot ${dot}`} />
                <div className="tl-body">
                  <div className="tl-route-row">
                    <span className={`tl-badge ${isMetro ? "tl-badge-metro" : "tl-badge-bus"}`}>
                      {leg.route.name || "Transit"}
                    </span>
                  </div>
                  <span className="tl-stop">
                    Board <strong>{board?.name || "Stop"}</strong> → Alight <strong>{alight?.name || "Stop"}</strong>
                    &nbsp;·&nbsp;{leg.stops ? leg.stops.length - 1 : 0} stop{(leg.stops && leg.stops.length !== 2) ? "s" : ""}
                  </span>
                  {i === 0 && nextDep && (
                    <span className="tl-dep">
                      <span className="tl-dep-dot" />
                      Next: {nextDep}
                    </span>
                  )}
                  <details className="tl-stops-detail">
                    <summary>All stops ({leg.stops.length})</summary>
                    <ol className="tl-stop-list">{leg.stops.map((s, j) => <li key={j}>{s.name}</li>)}</ol>
                  </details>
                </div>
              </div>
            );
          })}

          {/* Walk to dest */}
          <div className="tl-row">
            <div className="tl-dot tl-dest" />
            <div className="tl-body">
              <span className="tl-label">Walk ~{dStop?.walkMin} min</span>
              <span className="tl-stop">from {dStop?.name} to destination</span>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <>
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      <div className={`app-root relative min-h-screen z-0 ${!preloaderDone ? "h-screen overflow-hidden" : ""}`}>
        <div className="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
        {/* ── Top nav ────────────────────────────────────────────────────────── */}
        <header className="top-nav relative z-50">
          <div className="nav-left">
            <img src="/logo.png" alt="Namma Move" className="nav-logo" />
            <span className="logo-text">Namma Move</span>
          </div>
          <nav className="nav-links">
            {NAV.map(n => (
              <button key={n} className={`nav-link ${activePage === n ? "active" : ""}`} onClick={() => setActivePage(n)}>
                {n === "Home" ? "🏠" : n === "Schedules" ? "🕒" : "📰"} {n}
              </button>
            ))}
          </nav>
          <button className="dark-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? "☀️" : "🌙"}</button>
        </header>

        {activePage === "News" && (
          <main className="main-layout relative z-10"><NewsPage darkMode={darkMode} /></main>
        )}

        {activePage === "Schedules" && (
          <main className="main-layout relative z-10"><SchedulesPage /></main>
        )}

        {activePage === "Home" && (
          <main className="main-layout relative z-10">
            <div className="hero">
              <h1 className="hero-title">Namma Move</h1>
              <div className="hero-pills">
                <span className="hero-pill">{stats.routes} routes · {stats.stops} stops</span>
                <span className="hero-pill" style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--purple)', fontWeight: '700' }}>⚡ Metro + Core Bus Active</span>
                {dbConnected === true && (
                  <span className="hero-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', fontWeight: '700' }}>✅ Database Connected</span>
                )}
                {dbConnected === false && (
                  <span className="hero-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', fontWeight: '700' }}>⚠️ Database Offline</span>
                )}
                {gpsLoading && <span className="hero-pill gps-loading">📍 Getting location…</span>}
                {gpsError && <span className="hero-pill gps-err">⚠ {gpsError}</span>}
                {!gpsLoading && !gpsError && originLoc && (
                  <span className="hero-pill gps-ok">📍 Location set</span>
                )}
              </div>
            </div>

            {/* ── Search panel ────────────────────────────────────────────── */}
            <div className="search-panel">
              <DualMapPicker
                stops={stopsJson}
                activeIds={activeStopIds}
                onOriginSelected={loc => { setOriginLoc(loc); setSearched(false); }}
                onDestinationSelected={loc => { setDestLoc(loc); setSearched(false); }}
                initialOrigin={originLoc}
              />

              {/* Departure time picker */}
              <div className="time-picker">
                <div className="time-mode-tabs">
                  {[["now", "Leave now"], ["leave", "Leave at"], ["arrive", "Arrive by"]].map(([m, l]) => (
                    <button key={m} className={`time-tab ${timeMode === m ? "active" : ""}`} onClick={() => setTimeMode(m)}>{l}</button>
                  ))}
                </div>
                {timeMode !== "now" && (
                  <input
                    type="time"
                    className="time-input"
                    value={timeInput}
                    onChange={e => setTimeInput(e.target.value)}
                  />
                )}
              </div>

              <button
                className={`search-btn ${!bothSet ? "disabled" : ""}`}
                onClick={handleSearch}
                disabled={!bothSet || loading}
              >
                {loading ? "⏳ Searching…" : "🔍 Search Routes"}
              </button>
            </div>

            {/* ── No route hint ────────────────────────────────────────────── */}
            {!bothSet && !searched && (
              <p className="hint-msg">📌 Set start and destination above, then tap Search Routes.</p>
            )}

            {/* ── Results ─────────────────────────────────────────────────── */}
            {searched && !loading && (
              <section className="results">
                <h2 className="results-title">
                  Travel options
                  {timeMode !== "now" && (
                    <span className="results-time-badge">
                      {timeMode === "leave" ? `Leaving ${timeInput}` : `Arriving by ${timeInput}`}
                    </span>
                  )}
                </h2>

                {noRoute && !busHit && !metroHit && !comboHit && (
                  <div className="no-route">
                    <span>🚫</span>
                    <div>
                      <strong>No transit route found</strong>
                      <p>Try adjusting your locations or use a cab below.</p>
                    </div>
                  </div>
                )}

                <div className="jcards-col">
                  <JCard hit={busHit} accent="var(--teal)" icon="🚌" label="BMTC Bus" />
                  <JCard hit={metroHit} accent="var(--purple)" icon="🚇" label="Namma Metro" />
                  <JCard hit={comboHit} accent="#f59e0b" icon="🔀" label="Bus + Metro" />
                </div>

                {/* Cab / Auto card */}
                {cabInfo && (
                  <div className="jcard cab-jcard">
                    <div className="jcard-summary">
                      <div className="jcard-summary-left">
                        <span className="jcard-mode-icon">🛺</span>
                        <div>
                          <div className="jcard-label">Auto / Cab</div>
                          <div className="jcard-sub">{cabInfo.km} km straight-line</div>
                        </div>
                      </div>
                    </div>
                    <div className="cab-rows">
                      <div className="cab-row">
                        <div className="cab-mode"><span>🛺</span> Auto (Meter)</div>
                        <div className="cab-info">
                          <span className="cab-fare">₹{cabInfo.autoFare}</span>
                          <span className="cab-time">~{cabInfo.autoMin} min</span>
                          <a href={rideLink("rapido")} target="_blank" rel="noreferrer" className="ride-btn rapido-btn">Rapido</a>
                        </div>
                      </div>
                      <div className="cab-divider" />
                      <div className="cab-row">
                        <div className="cab-mode"><span>🚕</span> Cab</div>
                        <div className="cab-info">
                          <span className="cab-fare">₹{cabInfo.cabFare}</span>
                          <span className="cab-time">~{cabInfo.cabMin} min</span>
                          <div className="ride-btn-group">
                            <a href={rideLink("ola")} target="_blank" rel="noreferrer" className="ride-btn ola-btn">Ola</a>
                            <a href={rideLink("uber")} target="_blank" rel="noreferrer" className="ride-btn uber-btn">Uber</a>
                          </div>
                        </div>
                      </div>
                      <div className="cab-divider" />
                      <div className="cab-row">
                        <div className="cab-mode"><span>🏍</span> Bike</div>
                        <div className="cab-info">
                          <span className="cab-fare">₹{cabInfo.bikeFare}</span>
                          <span className="cab-time">~{cabInfo.bikeMin} min</span>
                          <a href={rideLink("rapido")} target="_blank" rel="noreferrer" className="ride-btn rapido-btn">Rapido</a>
                        </div>
                      </div>
                      <p className="cab-disclaimer">* Auto: ₹30 base + ₹15/km · Cab surge may vary</p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </main>
        )}

        <footer className="bottom-nav">
          {NAV.map(n => (
            <button key={n} className={`bottom-item ${activePage === n ? "active" : ""}`} onClick={() => setActivePage(n)}>
              {n === "Home" ? "🏠 Home" : n === "Schedules" ? "🕒 Schedules" : "📰 News"}
            </button>
          ))}
        </footer>
      </div>
    </>
  );
}
