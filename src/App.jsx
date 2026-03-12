import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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

  // ── API URL Helper ────────────────────────────────────────────────────────
  const getBaseUrl = () => {
    const isProd = window.location.hostname !== "localhost";
    return isProd ? "/api" : (import.meta.env.VITE_API_URL || "http://localhost:4001/api");
  };

  // ── Database health check ──────────────────────────────────────────────────
  useEffect(() => {
    const checkDb = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/health`);
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

    let url = `${getBaseUrl()}/route?fromLat=${origin.lat}&fromLon=${origin.lon}&toLat=${dest.lat}&toLon=${dest.lon}`;

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

  function JCard({ hit, accent, icon, label }) {
    if (!hit) return null;
    const { legs, hops, totalMins, fare, depart, arrive, nextDep, oStop, dStop, type } = hit;

    return (
      <div className="jcard" style={{ borderTopColor: accent }}>
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

        <div className="timeline">
          <div className="tl-row">
            <div className="tl-dot tl-walk" />
            <div className="tl-body">
              <span className="tl-label">Walk ~{oStop?.walkMin} min</span>
              <span className="tl-stop">to {oStop?.name}</span>
            </div>
          </div>

          {legs && legs.map((leg, i) => {
            if (!leg.route) return null;
            const isMetro = leg.mode === 'metro';
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
                {dbConnected === null && (
                  <span className="hero-pill" style={{ background: 'rgba(158, 200, 185, 0.15)', color: 'var(--text-muted)', fontWeight: '700' }}>⌛ Connecting to DB...</span>
                )}

                {gpsLoading && <span className="hero-pill gps-loading">📍 Getting location…</span>}
                {gpsError && <span className="hero-pill gps-err">⚠ {gpsError}</span>}
                {!gpsLoading && !gpsError && originLoc && (
                  <span className="hero-pill gps-ok">📍 Location set</span>
                )}
              </div>
            </div>

            <div className="search-panel">
              <DualMapPicker
                stops={stopsJson}
                activeIds={activeStopIds}
                onOriginSelected={loc => { setOriginLoc(loc); setSearched(false); }}
                onDestinationSelected={loc => { setDestLoc(loc); setSearched(false); }}
                initialOrigin={originLoc}
              />

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

            {!bothSet && !searched && (
              <p className="hint-msg">📌 Set start and destination above, then tap Search Routes.</p>
            )}

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
                      <p>{noRoute}</p>
                    </div>
                  </div>
                )}

                <div className="jcards-col">
                  <JCard hit={busHit} accent="var(--teal)" icon="🚌" label="BMTC Bus" />
                  <JCard hit={metroHit} accent="var(--purple)" icon="🚇" label="Namma Metro" />
                  <JCard hit={comboHit} accent="#f59e0b" icon="🔀" label="Bus + Metro" />
                </div>

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
                          <span className="cab-fare">₹{cabInfo.autoFare || '---'}</span>
                          <span className="cab-time">~{cabInfo.autoMin || '---'} min</span>
                          <a href={rideLink("rapido")} target="_blank" rel="noreferrer" className="ride-btn rapido-btn">Rapido</a>
                        </div>
                      </div>
                      <div className="cab-divider" />
                      <div className="cab-row">
                        <div className="cab-mode"><span>🚕</span> Cab</div>
                        <div className="cab-info">
                          <span className="cab-fare">₹{cabInfo.cabFare || '---'}</span>
                          <span className="cab-time">~{cabInfo.cabMin || '---'} min</span>
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
                          <span className="cab-fare">₹{cabInfo.bikeFare || '---'}</span>
                          <span className="cab-time">~{cabInfo.bikeMin || '---'} min</span>
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
