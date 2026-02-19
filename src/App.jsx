import { useEffect, useState } from "react";
import DualMapPicker from "./DualMapPicker";
import stopsJson      from "./data/gtfs_stops.json";
import routesJson     from "./data/gtfs_routes.json";
import routeStopsJson from "./data/gtfs_route_stops.json";

// ─── Haversine distance (meters) ───────────────────────────────────────────
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Bangalore meter fare estimator ───────────────────────────────────────
// Auto: ₹30 base for 1.9 km, then ₹15/km
// Cab:  min ₹60, ~₹14/km
function estimateMeter(distanceM) {
  const distKm = distanceM / 1000;

  const autoFare =
    distKm <= 1.9
      ? 30
      : Math.round(30 + (distKm - 1.9) * 15);
  // ~24 km/h avg for auto in Bengaluru traffic
  const autoTimeMin = Math.max(5, Math.round((distKm / 24) * 60));

  const cabFare = Math.max(60, Math.round(distKm * 14));
  // ~21 km/h avg for cab
  const cabTimeMin = Math.max(5, Math.round((distKm / 21) * 60));

  return { distKm, autoFare, autoTimeMin, cabFare, cabTimeMin };
}

// ─── Find nearest stop ──────────────────────────────────────────────────────
function findNearestStop(stops, lat, lon) {
  let best = null, min = Infinity;
  stops.forEach((s) => {
    const d = distanceMeters(lat, lon, s.latitude, s.longitude);
    if (d < min) { min = d; best = { ...s, distance: d }; }
  });
  return best;
}

// ─── Walking estimate ───────────────────────────────────────────────────────
function walkEstimate(distanceM) {
  return {
    distanceM,
    minutes: Math.max(1, Math.round(distanceM / (1.3 * 60))),
  };
}

export default function App() {
  // ── GTFS data (bundled locally – no network required) ──────────────────
  const [stops]      = useState(stopsJson);
  const [routesData] = useState(routesJson);
  const [routeStops] = useState(routeStopsJson);
  const gtfsStats    = { stops: stopsJson.length, routes: routesJson.length };

  // ── Location pins ──────────────────────────────────────────────────────
  const [userGps, setUserGps] = useState(null);        // raw GPS
  const [originLoc, setOriginLoc] = useState(null);    // { lat, lon, label }
  const [destLoc, setDestLoc] = useState(null);        // { lat, lon, label }

  // ── Nearest stops + walks ──────────────────────────────────────────────
  const [nearestOriginStop, setNearestOriginStop] = useState(null);
  const [nearestDestStop, setNearestDestStop] = useState(null);
  const [originWalk, setOriginWalk] = useState(null);
  const [destWalk, setDestWalk] = useState(null);

  // ── Results ────────────────────────────────────────────────────────────
  const [busJourney, setBusJourney] = useState(null);
  const [meterInfo, setMeterInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Data is bundled locally – no async load needed.

  // ── Get user GPS → pre-fill origin ─────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Your location",
        };
        setUserGps(loc);
        setOriginLoc(loc); // auto pre-fill as origin
      },
      (err) => console.warn("GPS unavailable:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Re-compute when both pins + data are ready ──────────────────────────
  useEffect(() => {
    if (!originLoc || !destLoc || stops.length === 0) return;
    computeAll(originLoc, destLoc);
  }, [originLoc, destLoc, stops, routesData, routeStops]);

  // ── Master compute function ─────────────────────────────────────────────
  const computeAll = (origin, dest) => {
    setLoading(true);
    setBusJourney(null);
    setMeterInfo(null);

    // 1) Straight-line distance for meter estimate
    const straightDist = distanceMeters(
      origin.lat, origin.lon, dest.lat, dest.lon
    );
    setMeterInfo(estimateMeter(straightDist));

    // 2) Nearest stops
    const oStop = findNearestStop(stops, origin.lat, origin.lon);
    const dStop = findNearestStop(stops, dest.lat, dest.lon);
    setNearestOriginStop(oStop);
    setNearestDestStop(dStop);
    if (oStop) setOriginWalk(walkEstimate(oStop.distance));
    if (dStop) setDestWalk(walkEstimate(dStop.distance));

    // 3) Bus route
    if (oStop && dStop) {
      const result = computeBusJourney(oStop.id, dStop.id);
      setBusJourney(result);
    }
    setLoading(false);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const getStopById = (id) => stops.find((s) => s.id === id);

  const getOrderedRouteStops = (routeId) =>
    routeStops
      .filter((rs) => rs.route_id === routeId)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);

  const buildRoutesByStop = () => {
    const map = {};
    routeStops.forEach((rs) => {
      if (!map[rs.stop_id]) map[rs.stop_id] = new Set();
      map[rs.stop_id].add(rs.route_id);
    });
    return map;
  };

  // ── Bus journey: direct → one interchange ──────────────────────────────
  const computeBusJourney = (originId, destId) => {
    if (!routesData.length || !routeStops.length) return null;

    const orderedCache = {};
    routesData.forEach((r) => {
      orderedCache[r.id] = getOrderedRouteStops(r.id);
    });

    // Direct
    let bestDirect = null;
    routesData.forEach((route) => {
      const ordered = orderedCache[route.id];
      if (!ordered.length) return;
      const oIdx = ordered.findIndex((rs) => rs.stop_id === originId);
      const dIdx = ordered.findIndex((rs) => rs.stop_id === destId);
      if (oIdx !== -1 && dIdx !== -1 && oIdx < dIdx) {
        const hops = dIdx - oIdx;
        if (!bestDirect || hops < bestDirect.hops) {
          bestDirect = { route, ordered, oIdx, dIdx, hops };
        }
      }
    });

    if (bestDirect) {
      const legStops = bestDirect.ordered
        .slice(bestDirect.oIdx, bestDirect.dIdx + 1)
        .map((rs) => getStopById(rs.stop_id))
        .filter(Boolean);
      const isMetro = [1, 2].includes(bestDirect.route.route_type);
      const totalMinutes = bestDirect.hops * (isMetro ? 3 : 4);
      return {
        type: "direct",
        legs: [{ route: bestDirect.route, stops: legStops }],
        totalHops: bestDirect.hops,
        totalMinutes,
      };
    }

    // One interchange
    const routesByStop = buildRoutesByStop();
    const originRoutes = Array.from(routesByStop[originId] || []);
    let bestMulti = null;

    originRoutes.forEach((routeAId) => {
      const orderedA = orderedCache[routeAId] || [];
      const oIdxA = orderedA.findIndex((rs) => rs.stop_id === originId);
      if (oIdxA === -1) return;

      for (let i = oIdxA + 1; i < orderedA.length; i++) {
        const interStopId = orderedA[i].stop_id;
        const routesThroughInter = Array.from(routesByStop[interStopId] || []);

        routesThroughInter.forEach((routeBId) => {
          if (routeBId === routeAId) return;
          const orderedB = orderedCache[routeBId] || [];
          const interIdxB = orderedB.findIndex((rs) => rs.stop_id === interStopId);
          const dIdxB = orderedB.findIndex((rs) => rs.stop_id === destId);
          if (interIdxB === -1 || dIdxB === -1 || interIdxB >= dIdxB) return;

          const hopsA = i - oIdxA;
          const hopsB = dIdxB - interIdxB;
          const totalHops = hopsA + hopsB;

          const routeA = routesData.find((r) => r.id === routeAId);
          const routeB = routesData.find((r) => r.id === routeBId);
          const isMetroA = [1, 2].includes(routeA?.route_type);
          const isMetroB = [1, 2].includes(routeB?.route_type);
          const totalMinutes =
            hopsA * (isMetroA ? 3 : 4) + hopsB * (isMetroB ? 3 : 4);

          if (!bestMulti || totalHops < bestMulti.totalHops) {
            bestMulti = {
              totalHops, hopsA, hopsB,
              routeA, routeB, orderedA, orderedB,
              oIdxA, interIdxA: i, interStopId, interIdxB, dIdxB,
              totalMinutes,
            };
          }
        });
      }
    });

    if (bestMulti) {
      const leg1Stops = bestMulti.orderedA
        .slice(bestMulti.oIdxA, bestMulti.interIdxA + 1)
        .map((rs) => getStopById(rs.stop_id))
        .filter(Boolean);
      const leg2Stops = bestMulti.orderedB
        .slice(bestMulti.interIdxB, bestMulti.dIdxB + 1)
        .map((rs) => getStopById(rs.stop_id))
        .filter(Boolean);
      return {
        type: "interchange",
        legs: [
          { route: bestMulti.routeA, stops: leg1Stops },
          { route: bestMulti.routeB, stops: leg2Stops },
        ],
        totalHops: bestMulti.totalHops,
        totalMinutes: bestMulti.totalMinutes,
      };
    }

    return null; // no route found
  };

  // ── Google Maps walk link ─────────────────────────────────────────────
  const openWalkNav = (destLat, destLon, origin) => {
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destLat},${destLon}&travelmode=walking`
      : `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLon}&travelmode=walking`;
    window.open(url, "_blank");
  };

  const openRideApp = (app) => {
    if (!destLoc) return;
    if (app === "ola")
      window.open(
        `https://book.olacabs.com/?serviceType=p2p&drop_lat=${destLoc.lat}&drop_lng=${destLoc.lon}`,
        "_blank"
      );
    if (app === "uber")
      window.open(
        `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${destLoc.lat}&dropoff[longitude]=${destLoc.lon}`,
        "_blank"
      );
    if (app === "rapido")
      window.open("https://www.rapido.bike/", "_blank");
  };

  const bothPinsSet = originLoc && destLoc;

  return (
    <div className="app-root">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="top-nav">
        <div className="nav-left">
          <div className="logo-circle" />
          <span className="logo-text">Namma</span>
        </div>
        <nav className="nav-links">
          <button className="nav-link active">Home</button>
          <button className="nav-link">Routes</button>
          <button className="nav-link">Tickets</button>
          <button className="nav-link">Profile</button>
        </nav>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="main-layout">
        {/* Hero */}
        <section className="hero">
          <h1 className="hero-title">Namma Move</h1>
          <div className="hero-sub">
            {gtfsStats && (
              <span className="hero-pill hero-pill-muted">
                GTFS: {gtfsStats.routes} routes · {gtfsStats.stops} stops
              </span>
            )}
            {originLoc && (
              <span className="hero-pill">
                📍 From: {originLoc.label}
              </span>
            )}
          </div>
        </section>

        {/* ── Map card ─────────────────────────────────────────────────── */}
        <section className="grid-section">
          <div className="map-card">
            <div className="map-card-header">
              <span className="map-card-title">
                {bothPinsSet
                  ? "Calculating routes…"
                  : "Set your start & destination"}
              </span>
              {busJourney && (
                <span className="map-card-badge">
                  🚌 ~{busJourney.totalMinutes} min by bus
                </span>
              )}
            </div>
            <DualMapPicker
              onOriginSelected={(loc) => setOriginLoc(loc)}
              onDestinationSelected={(loc) => setDestLoc(loc)}
              initialOrigin={userGps}
            />
            <p className="map-card-footnote">
              🟢 Pin start · 🔴 Pin destination · or use search boxes above
            </p>
          </div>
        </section>

        {/* ── Results ──────────────────────────────────────────────────── */}
        {error && <p className="journey-hint warning">{error}</p>}

        {!bothPinsSet && (
          <p className="journey-hint">
            Pin both a start point and a destination to see your travel options.
          </p>
        )}

        {loading && (
          <p className="journey-hint">Searching routes…</p>
        )}

        {bothPinsSet && !loading && (
          <section className="journey-section">
            <h2 className="section-title">How to get there</h2>

            {/* ─────────────── Option cards row ─────────────────────── */}
            <div className="options-row">

              {/* ── BMTC Bus card ───────────────────────────────────── */}
              <div className="option-card bus-card">
                <div className="option-card-header">
                  <span className="option-icon">🚌</span>
                  <div>
                    <h3 className="option-title">BMTC Bus</h3>
                    {busJourney && (
                      <p className="option-subtitle">
                        ~{busJourney.totalMinutes} min · {busJourney.totalHops} stops
                        {busJourney.type === "interchange" ? " · 1 change" : " · Direct"}
                      </p>
                    )}
                  </div>
                </div>

                {busJourney ? (
                  <div className="steps-list">
                    {/* Step 1 – walk to boarding stop */}
                    {nearestOriginStop && originWalk && (
                      <div className="journey-card">
                        <div className="step-number">1</div>
                        <div className="step-body">
                          <h4>Walk to boarding stop</h4>
                          <p>Head to <strong>{nearestOriginStop.name}</strong></p>
                          <p className="step-meta">
                            ≈ {(originWalk.distanceM / 1000).toFixed(2)} km ·{" "}
                            {originWalk.minutes} min walk
                          </p>
                          <button
                            className="small-btn"
                            onClick={() =>
                              openWalkNav(
                                nearestOriginStop.latitude,
                                nearestOriginStop.longitude
                              )
                            }
                          >
                            Walking directions
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bus legs */}
                    {busJourney.legs.map((leg, idx) => {
                      const stepNum = 2 + idx;
                      const stopsInLeg = leg.stops || [];
                      const start = stopsInLeg[0];
                      const end = stopsInLeg[stopsInLeg.length - 1];
                      const isMetro = [1, 2].includes(leg.route.route_type);
                      return (
                        <div className="journey-card" key={idx}>
                          <div className="step-number">{stepNum}</div>
                          <div className="step-body">
                            <h4>
                              {isMetro ? "🚇 Metro" : "🚌 Bus"} ·{" "}
                              <span className="route-pill">{leg.route.short_name}</span>
                            </h4>
                            <p>{leg.route.long_name}</p>
                            {start && end && (
                              <p className="step-meta">
                                Board <strong>{start.name}</strong> → Exit{" "}
                                <strong>{end.name}</strong> ·{" "}
                                {stopsInLeg.length - 1} stop{stopsInLeg.length !== 2 ? "s" : ""}
                              </p>
                            )}
                            <details className="step-details">
                              <summary>Show all stops</summary>
                              <ol>
                                {stopsInLeg.map((s, i) => (
                                  <li key={i}>{s.name}</li>
                                ))}
                              </ol>
                            </details>
                          </div>
                        </div>
                      );
                    })}

                    {/* Walk to destination */}
                    {nearestDestStop && destWalk && (
                      <div className="journey-card">
                        <div className="step-number">
                          {2 + busJourney.legs.length}
                        </div>
                        <div className="step-body">
                          <h4>Walk to destination</h4>
                          <p>
                            From <strong>{nearestDestStop.name}</strong> walk to your
                            destination.
                          </p>
                          <p className="step-meta">
                            ≈ {(destWalk.distanceM / 1000).toFixed(2)} km ·{" "}
                            {destWalk.minutes} min walk
                          </p>
                          <button
                            className="small-btn"
                            onClick={() =>
                              openWalkNav(destLoc.lat, destLoc.lon, {
                                lat: nearestDestStop.latitude,
                                lon: nearestDestStop.longitude,
                              })
                            }
                          >
                            Walking directions
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="no-route-msg">
                    No BMTC route found with ≤ 1 interchange for this trip. Try
                    the auto or cab instead.
                  </p>
                )}
              </div>

              {/* ── Meter Auto / Cab card ────────────────────────────── */}
              {meterInfo && (
                <div className="option-card meter-card">
                  <div className="option-card-header">
                    <span className="option-icon">🛺</span>
                    <div>
                      <h3 className="option-title">Auto / Cab</h3>
                      <p className="option-subtitle">
                        {meterInfo.distKm.toFixed(1)} km straight-line
                      </p>
                    </div>
                  </div>

                  {/* Auto row */}
                  <div className="meter-row">
                    <div className="meter-mode-label">
                      <span className="meter-icon">🛺</span>
                      <span>Auto (Meter)</span>
                    </div>
                    <div className="meter-details">
                      <span className="meter-fare">₹{meterInfo.autoFare}</span>
                      <span className="meter-time">~{meterInfo.autoTimeMin} min</span>
                    </div>
                    <button
                      className="small-btn meter-btn"
                      onClick={() => openRideApp("rapido")}
                    >
                      Book Rapido
                    </button>
                  </div>

                  <div className="meter-divider" />

                  {/* Ola row */}
                  <div className="meter-row">
                    <div className="meter-mode-label">
                      <span className="meter-icon">🚕</span>
                      <span>Cab (Ola/Uber)</span>
                    </div>
                    <div className="meter-details">
                      <span className="meter-fare">₹{meterInfo.cabFare}</span>
                      <span className="meter-time">~{meterInfo.cabTimeMin} min</span>
                    </div>
                    <div className="meter-btn-group">
                      <button
                        className="small-btn meter-btn"
                        onClick={() => openRideApp("ola")}
                      >
                        Ola
                      </button>
                      <button
                        className="small-btn meter-btn"
                        onClick={() => openRideApp("uber")}
                      >
                        Uber
                      </button>
                    </div>
                  </div>

                  <p className="fare-disclaimer">
                    * Fares use Bengaluru official meter rates (auto: ₹30 base + ₹15/km).
                    Surge pricing may vary.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ── Bottom nav ──────────────────────────────────────────────────── */}
      <footer className="bottom-nav">
        <button className="bottom-item active">Home</button>
        <button className="bottom-item">Routes</button>
        <button className="bottom-item">Tickets</button>
        <button className="bottom-item">Profile</button>
      </footer>
    </div>
  );
}
