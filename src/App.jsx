import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import MapPicker from "./MapPicker";

// Haversine distance (meters)
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [stops, setStops] = useState([]);
  const [routesData, setRoutesData] = useState([]);
  const [routeStops, setRouteStops] = useState([]);

  const [userLoc, setUserLoc] = useState(null);
  const [nearestOrigin, setNearestOrigin] = useState(null);

  const [destLoc, setDestLoc] = useState(null);
  const [nearestDest, setNearestDest] = useState(null);

  const [originWalk, setOriginWalk] = useState(null);
  const [destWalk, setDestWalk] = useState(null);

  const [journey, setJourney] = useState(null);
  const [error, setError] = useState("");
  const [gtfsStats, setGtfsStats] = useState(null);

  // 1) Load GTFS-based stops, routes, and route_stops
  useEffect(() => {
    const loadAll = async () => {
      const [
        { data: stopsData, error: sErr },
        { data: routes, error: rErr },
        { data: rs, error: rsErr },
      ] = await Promise.all([
        supabase.from("gtfs_stops").select("*"),
        supabase.from("gtfs_routes").select("*"),
        supabase.from("gtfs_route_stops").select("*"),
      ]);

      if (sErr || rErr || rsErr) {
        console.error("Supabase load error:", sErr || rErr || rsErr);
        setError("Failed to load data from server");
        return;
      }

      setStops(stopsData || []);
      setRoutesData(routes || []);
      setRouteStops(rs || []);

      setGtfsStats({
        stops: stopsData?.length || 0,
        routes: routes?.length || 0,
        routeStops: rs?.length || 0,
      });
    };

    loadAll();
  }, []);

  // 2) Get user GPS immediately on load
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("GPS error:", err);
        setError(
          "Unable to fetch your location. Please allow location access."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // 3) Find nearest stop to user + walking estimate
  useEffect(() => {
    if (!userLoc || stops.length === 0) return;

    let best = null;
    let min = Infinity;

    stops.forEach((s) => {
      const d = distanceMeters(
        userLoc.lat,
        userLoc.lon,
        s.latitude,
        s.longitude
      );
      if (d < min) {
        min = d;
        best = { ...s, distance: d };
      }
    });

    setNearestOrigin(best);

    if (best) {
      const minutes = Math.max(
        1,
        Math.round(best.distance / (1.3 * 60)) // 1.3 m/s
      );
      setOriginWalk({
        distanceMeters: best.distance,
        minutes,
      });
    }
  }, [userLoc, stops]);

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

  // When user picks destination on map
  const handleDestinationSelected = (loc) => {
    setDestLoc(loc);
    setJourney(null);

    if (stops.length === 0) return;

    let best = null;
    let min = Infinity;
    stops.forEach((s) => {
      const d = distanceMeters(
        loc.lat,
        loc.lon,
        s.latitude,
        s.longitude
      );
      if (d < min) {
        min = d;
        best = { ...s, distance: d };
      }
    });
    setNearestDest(best);

    if (best) {
      const minutes = Math.max(
        1,
        Math.round(best.distance / (1.3 * 60))
      );
      setDestWalk({
        distanceMeters: best.distance,
        minutes,
      });
    }

    if (nearestOrigin && best) {
      computeJourney(nearestOrigin.id, best.id);
    }
  };

  // Journey logic: direct or one interchange
  const computeJourney = (originId, destId) => {
    if (!routesData.length || !routeStops.length) return;

    const routesByStop = buildRoutesByStop();

    // 1) Direct route
    let bestDirect = null;

    routesData.forEach((route) => {
      const ordered = getOrderedRouteStops(route.id);
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

      const totalHops = bestDirect.hops;
      const isMetro =
        bestDirect.route.route_type === 1 ||
        bestDirect.route.route_type === 2;
      const minutesPerHop = isMetro ? 3 : 4;
      const totalMinutes = totalHops * minutesPerHop;

      setJourney({
        legs: [
          {
            route: bestDirect.route,
            stops: legStops,
          },
        ],
        totalHops,
        totalMinutes,
      });
      return;
    }

    // 2) One interchange
    let bestMulti = null;

    const routesByStopMap = routesByStop;
    const originRoutes = Array.from(routesByStopMap[originId] || []);

    const orderedCache = {};
    routesData.forEach((r) => {
      orderedCache[r.id] = getOrderedRouteStops(r.id);
    });

    originRoutes.forEach((routeAId) => {
      const orderedA = orderedCache[routeAId] || [];
      const oIdxA = orderedA.findIndex((rs) => rs.stop_id === originId);
      if (oIdxA === -1) return;

      for (let i = oIdxA + 1; i < orderedA.length; i++) {
        const interStopId = orderedA[i].stop_id;
        const routesThroughInter = Array.from(
          routesByStopMap[interStopId] || []
        );

        routesThroughInter.forEach((routeBId) => {
          if (routeBId === routeAId) return;

          const orderedB = orderedCache[routeBId] || [];
          const interIdxB = orderedB.findIndex(
            (rs) => rs.stop_id === interStopId
          );
          const dIdxB = orderedB.findIndex(
            (rs) => rs.stop_id === destId
          );

          if (
            interIdxB === -1 ||
            dIdxB === -1 ||
            interIdxB >= dIdxB
          )
            return;

          const hopsA = i - oIdxA;
          const hopsB = dIdxB - interIdxB;
          const totalHops = hopsA + hopsB;

          const routeA = routesData.find((r) => r.id === routeAId);
          const routeB = routesData.find((r) => r.id === routeBId);

          if (!bestMulti || totalHops < bestMulti.totalHops) {
            bestMulti = {
              totalHops,
              hopsA,
              hopsB,
              routeA,
              routeB,
              orderedA,
              orderedB,
              oIdxA,
              interIdxA: i,
              interStopId,
              interIdxB,
              dIdxB,
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

      const isMetroA =
        bestMulti.routeA.route_type === 1 ||
        bestMulti.routeA.route_type === 2;
      const isMetroB =
        bestMulti.routeB.route_type === 1 ||
        bestMulti.routeB.route_type === 2;

      const minutesPerHopA = isMetroA ? 3 : 4;
      const minutesPerHopB = isMetroB ? 3 : 4;

      const totalMinutes =
        bestMulti.hopsA * minutesPerHopA +
        bestMulti.hopsB * minutesPerHopB;

      setJourney({
        legs: [
          { route: bestMulti.routeA, stops: leg1Stops },
          { route: bestMulti.routeB, stops: leg2Stops },
        ],
        totalHops: bestMulti.totalHops,
        totalMinutes,
      });
      return;
    }

    setJourney(null);
  };

  // destLat/destLon = destination, origin (optional) = { lat, lon }
  const openWalkNav = (destLat, destLon, origin) => {
    let url;
    if (origin && origin.lat != null && origin.lon != null) {
      // explicit origin (e.g. stop → destination)
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destLat},${destLon}&travelmode=walking`;
    } else {
      // default: origin = device location
      url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLon}&travelmode=walking`;
    }
    window.open(url, "_blank");
  };

  return (
    <div className="app-root">
      {/* Top nav */}
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

      {/* Main content */}
      <main className="main-layout">
        {/* Hero */}
        <section className="hero">
          <h1 className="hero-title">Namma Move</h1>

          <div className="hero-actions">
            <button className="pill-action primary">Favorites</button>
            <button className="pill-action">Nearby Stops</button>
            <button className="pill-action">Schedule Alerts</button>
          </div>

          <div className="hero-sub">
            <span className="hero-pill">
              {nearestOrigin
                ? `Nearest stop: ${nearestOrigin.name}`
                : "Fetching your nearest stop…"}
            </span>
            {gtfsStats && (
              <span className="hero-pill hero-pill-muted">
                GTFS: {gtfsStats.routes} routes · {gtfsStats.stops} stops
              </span>
            )}
          </div>
        </section>

        {/* Map card */}
        <section className="grid-section">
          <div className="map-card">
            <div className="map-card-header">
              <span className="map-card-title">
                {journey
                  ? `Best route: ~${journey.totalMinutes} mins`
                  : "Pick a destination on the map"}
              </span>
              {journey && (
                <span className="map-card-badge">
                  Next bus in ~5 mins*
                </span>
              )}
            </div>
            <MapPicker onLocationSelected={handleDestinationSelected} />
            <p className="map-card-footnote">
              *ETA estimates are rough and based on stop counts.
            </p>
          </div>
        </section>

        {/* Journey details */}
        <section className="journey-section">
          <h2 className="section-title">Your journey</h2>

          {/* Step 1 – walk to boarding stop */}
          {nearestOrigin && originWalk && (
            <div className="journey-card">
              <div className="step-number">1</div>
              <div className="step-body">
                <h3>Walk to boarding stop</h3>
                <p>
                  From your current location, walk to{" "}
                  <strong>{nearestOrigin.name}</strong>.
                </p>
                <p className="step-meta">
                  ≈ {(originWalk.distanceMeters / 1000).toFixed(2)} km ·{" "}
                  {originWalk.minutes} min walk
                </p>
                <button
                  className="small-btn"
                  onClick={() =>
                    openWalkNav(
                      nearestOrigin.latitude,
                      nearestOrigin.longitude
                    )
                  }
                >
                  Open walking directions
                </button>
              </div>
            </div>
          )}

          {/* Bus/Metro legs */}
          {journey &&
            journey.legs.length > 0 &&
            journey.legs.map((leg, index) => {
              const stepNumber = 2 + index;
              const stopsInLeg = leg.stops || [];
              const startStop = stopsInLeg[0];
              const endStop = stopsInLeg[stopsInLeg.length - 1];
              const isMetro =
                leg.route.route_type === 1 ||
                leg.route.route_type === 2;
              const modeLabel = isMetro ? "Metro" : "Bus";

              return (
                <div className="journey-card" key={index}>
                  <div className="step-number">{stepNumber}</div>
                  <div className="step-body">
                    <h3>
                      Take {modeLabel} ·{" "}
                      <span className="route-pill">
                        {leg.route.short_name}
                      </span>
                    </h3>
                    <p>{leg.route.long_name}</p>
                    {startStop && endStop && (
                      <p className="step-meta">
                        Board at <strong>{startStop.name}</strong> · exit
                        at <strong>{endStop.name}</strong> ·{" "}
                        {stopsInLeg.length > 1
                          ? `${stopsInLeg.length - 1} stops`
                          : "1 stop"}
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

          {journey && (
            <p className="journey-summary">
              Total ~{journey.totalHops} stops · {journey.totalMinutes} min
              in vehicle
            </p>
          )}

          {/* Final walking step */}
          {destLoc && nearestDest && destWalk && (
            <div className="journey-card">
              <div className="step-number">
                {journey ? 2 + journey.legs.length : 2}
              </div>
              <div className="step-body">
                <h3>Walk to final destination</h3>
                <p>
                  From <strong>{nearestDest.name}</strong>, walk to your
                  destination.
                </p>
                <p className="step-meta">
                  ≈ {(destWalk.distanceMeters / 1000).toFixed(2)} km ·{" "}
                  {destWalk.minutes} min walk
                </p>
                <button
                  className="small-btn"
                  onClick={() =>
                    openWalkNav(
                      destLoc.lat,
                      destLoc.lon,
                      {
                        lat: nearestDest.latitude,
                        lon: nearestDest.longitude,
                      }
                    )
                  }
                >
                  Open walking directions
                </button>
              </div>
            </div>
          )}

          {!destLoc && (
            <p className="journey-hint">
              Tap on the map to plan your journey.
            </p>
          )}

          {destLoc && !journey && (
            <p className="journey-hint warning">
              No suitable route found with at most one interchange. Try a
              nearby stop or check data coverage.
            </p>
          )}
        </section>
      </main>

      {/* Bottom nav */}
      <footer className="bottom-nav">
        <button className="bottom-item active">Home</button>
        <button className="bottom-item">Routes</button>
        <button className="bottom-item">Tickets</button>
        <button className="bottom-item">Profile</button>
      </footer>
    </div>
  );
}
