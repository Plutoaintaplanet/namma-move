import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import MapPicker from "./MapPicker";

// Haversine distance (meters)
function haversine(lat1, lon1, lat2, lon2) {
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
  const [routeStops, setRouteStops] = useState([]);
  const [routesData, setRoutesData] = useState([]);

  const [userLoc, setUserLoc] = useState(null);
  const [nearestOrigin, setNearestOrigin] = useState(null);

  const [destLoc, setDestLoc] = useState(null);
  const [nearestDest, setNearestDest] = useState(null);

  // Walking legs
  const [originWalk, setOriginWalk] = useState(null);
  const [destWalk, setDestWalk] = useState(null);

  // Bus journey: one or more legs
  // journey = { legs: [ { route, stops: [stop objects] } ], totalHops, totalMinutes }
  const [journey, setJourney] = useState(null);

  const [error, setError] = useState("");

  // Load stops, routes, route_stops
  useEffect(() => {
    const loadAll = async () => {
      const [{ data: stopsData, error: sErr },
             { data: routes, error: rErr },
             { data: rs, error: rsErr }] = await Promise.all([
        supabase.from("stops").select("*"),
        supabase.from("routes").select("*"),
        supabase.from("route_stops").select("*"),
      ]);

      if (sErr || rErr || rsErr) {
        console.error(sErr || rErr || rsErr);
        setError("Failed to load data from Supabase");
        return;
      }

      setStops(stopsData || []);
      setRoutesData(routes || []);
      setRouteStops(rs || []);
    };

    loadAll();
  }, []);

  // Get user GPS
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported");
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
        console.error(err);
        setError("Could not get your location");
      }
    );
  }, []);

  // Find nearest stop to user & walking leg
  useEffect(() => {
    if (!userLoc || stops.length === 0) return;

    let best = null;
    let min = Infinity;

    stops.forEach((s) => {
      const d = haversine(userLoc.lat, userLoc.lon, s.latitude, s.longitude);
      if (d < min) {
        min = d;
        best = { ...s, distance: d };
      }
    });

    setNearestOrigin(best);

    if (best) {
      const minutes = Math.max(1, Math.round(best.distance / (1.3 * 60)));
      setOriginWalk({
        distanceMeters: best.distance,
        minutes,
      });
    }
  }, [userLoc, stops]);

  // When destination is picked on map
  const handleDestinationSelected = (loc) => {
    setDestLoc(loc);
    setJourney(null); // reset journey

    if (stops.length === 0) return;

    // nearest stop to destination
    let best = null;
    let min = Infinity;
    stops.forEach((s) => {
      const d = haversine(loc.lat, loc.lon, s.latitude, s.longitude);
      if (d < min) {
        min = d;
        best = { ...s, distance: d };
      }
    });
    setNearestDest(best);

    if (best) {
      const minutes = Math.max(1, Math.round(best.distance / (1.3 * 60)));
      setDestWalk({
        distanceMeters: best.distance,
        minutes,
      });
    }

    if (nearestOrigin && best) {
      computeJourney(nearestOrigin.id, best.id);
    }
  };

  // Helper: get ordered routeStops for a route
  const getOrderedRouteStops = (routeId) => {
    return routeStops
      .filter((rs) => rs.route_id === routeId)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);
  };

  // Helper: map stopId -> stop object
  const getStopById = (id) => stops.find((s) => s.id === id);

  // Build map: stopId -> Set(routeId)
  const buildRoutesByStop = () => {
    const map = {};
    routeStops.forEach((rs) => {
      if (!map[rs.stop_id]) map[rs.stop_id] = new Set();
      map[rs.stop_id].add(rs.route_id);
    });
    return map;
  };

  // Main journey computation: 0 or 1 interchange
  const computeJourney = (originId, destId) => {
    if (routesData.length === 0 || routeStops.length === 0) return;

    const routesByStop = buildRoutesByStop();

    // 1) Try direct route
    let bestDirect = null;

    routesData.forEach((route) => {
      const ordered = getOrderedRouteStops(route.id);
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
      const totalMinutes = totalHops * 4;

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

    // 2) Try ONE interchange: origin -> X (route A), X -> dest (route B)
    let bestMulti = null;

    const originRoutes = Array.from(routesByStop[originId] || []);
    const destRoutes = Array.from(routesByStop[destId] || []);

    // For speed: pre-cache ordered route stops
    const orderedCache = {};
    routesData.forEach((r) => {
      orderedCache[r.id] = getOrderedRouteStops(r.id);
    });

    originRoutes.forEach((routeAId) => {
      const orderedA = orderedCache[routeAId];
      const oIdxA = orderedA.findIndex((rs) => rs.stop_id === originId);
      if (oIdxA === -1) return;

      // All possible interchange stops after origin on route A
      for (let i = oIdxA + 1; i < orderedA.length; i++) {
        const interStopId = orderedA[i].stop_id;
        const routesThroughInter = Array.from(routesByStop[interStopId] || []);

        routesThroughInter.forEach((routeBId) => {
          if (routeBId === routeAId) return; // same route already checked above

          const orderedB = orderedCache[routeBId];
          const interIdxB = orderedB.findIndex(
            (rs) => rs.stop_id === interStopId
          );
          const dIdxB = orderedB.findIndex((rs) => rs.stop_id === destId);

          if (interIdxB === -1 || dIdxB === -1 || interIdxB >= dIdxB) return;

          const hopsA = i - oIdxA;
          const hopsB = dIdxB - interIdxB;
          const totalHops = hopsA + hopsB;

          const routeA = routesData.find((r) => r.id === routeAId);
          const routeB = routesData.find((r) => r.id === routeBId);

          if (!bestMulti || totalHops < bestMulti.totalHops) {
            bestMulti = {
              totalHops,
              routeA,
              routeB,
              orderedA,
              orderedB,
              oIdxA,
              i, // inter idx on A
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
        .slice(bestMulti.oIdxA, bestMulti.i + 1)
        .map((rs) => getStopById(rs.stop_id))
        .filter(Boolean);

      const leg2Stops = bestMulti.orderedB
        .slice(bestMulti.interIdxB, bestMulti.dIdxB + 1)
        .map((rs) => getStopById(rs.stop_id))
        .filter(Boolean);

      const totalMinutes = bestMulti.totalHops * 4;

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

    // No journey found at all
    setJourney(null);
  };

  const openWalkNav = (lat, lon) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
    window.open(url, "_blank");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 16,
        background: "#020617",
        color: "#e5e7eb",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", marginBottom: 4 }}>Namma Move</h1>
      <p style={{ color: "#9ca3af", marginBottom: 12 }}>
        Choose your destination on the map. We’ll find BMTC routes with up to
        one interchange.
      </p>

      {error && (
        <div
          style={{
            background: "#b91c1c",
            padding: "8px 12px",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <MapPicker onLocationSelected={handleDestinationSelected} />

      {/* Step-by-step journey card */}
      <div
        style={{
          marginTop: 20,
          background: "#0f172a",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>
          Step-by-step instructions
        </h2>

        {/* Step 1 – Walk to first bus stop */}
        {nearestOrigin && originWalk && (
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 4 }}>Step 1 – Walk to bus stop</h3>
            <p style={{ margin: 0 }}>
              From your current location, walk to{" "}
              <strong>{nearestOrigin.name}</strong>
              {nearestOrigin.area && ` (${nearestOrigin.area})`}.
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.85rem",
                color: "#9ca3af",
              }}
            >
              ≈ {(originWalk.distanceMeters / 1000).toFixed(2)} km •{" "}
              {originWalk.minutes} min walk
            </p>
            <button
              onClick={() =>
                openWalkNav(nearestOrigin.latitude, nearestOrigin.longitude)
              }
              style={{
                marginTop: 6,
                padding: "6px 12px",
                borderRadius: 999,
                border: "none",
                background:
                  "linear-gradient(135deg,#f97316 0%,#ea580c 40%,#facc15 100%)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Open walking directions
            </button>
          </div>
        )}

        {/* Bus legs: Step 2 & 3 if needed */}
        {journey && journey.legs.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {journey.legs.map((leg, index) => {
              const stepNumber = 2 + index;
              const stops = leg.stops || [];
              const startStop = stops[0];
              const endStop = stops[stops.length - 1];

              return (
                <div
                  key={index}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: "#020617",
                  }}
                >
                  <h3 style={{ marginBottom: 4 }}>
                    Step {stepNumber} – Take bus {journey.legs.length > 1 ? `(${index + 1})` : ""}
                  </h3>
                  <p style={{ margin: 0 }}>
                    Route <strong>{leg.route.short_name}</strong> –{" "}
                    {leg.route.long_name}
                  </p>
                  {startStop && endStop && (
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: "0.85rem",
                        color: "#9ca3af",
                      }}
                    >
                      Board at <strong>{startStop.name}</strong> and get down at{" "}
                      <strong>{endStop.name}</strong>. <br />
                      (
                      {stops.length > 1
                        ? `${stops.length - 1} stops on this leg`
                        : "1 stop"}
                      )
                    </p>
                  )}

                  <details
                    style={{
                      marginTop: 6,
                      padding: 6,
                      borderRadius: 8,
                      background: "#020617",
                      fontSize: "0.85rem",
                    }}
                  >
                    <summary style={{ cursor: "pointer" }}>
                      Show all stops on this leg
                    </summary>
                    <ol style={{ marginTop: 6, paddingLeft: 18 }}>
                      {stops.map((s, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>
                          {s.name}
                          {s.area && (
                            <span style={{ color: "#6b7280" }}>
                              {" "}
                              – {s.area}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
              );
            })}

            <p
              style={{
                marginTop: 4,
                fontSize: "0.85rem",
                color: "#9ca3af",
              }}
            >
              Total ≈ {journey.totalHops} stops • {journey.totalMinutes} min
              (rough bus time)
            </p>
          </div>
        )}

        {/* Final walking step */}
        {destLoc && nearestDest && destWalk && (
          <div>
            <h3 style={{ marginBottom: 4 }}>
              Step {journey && journey.legs.length > 0 ? 2 + journey.legs.length : 2} – Walk to destination
            </h3>
            <p style={{ margin: 0 }}>
              From <strong>{nearestDest.name}</strong>, walk to your final
              destination.
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.85rem",
                color: "#9ca3af",
              }}
            >
              ≈ {(destWalk.distanceMeters / 1000).toFixed(2)} km •{" "}
              {destWalk.minutes} min walk
            </p>
            <button
              onClick={() => openWalkNav(destLoc.lat, destLoc.lon)}
              style={{
                marginTop: 6,
                padding: "6px 12px",
                borderRadius: 999,
                border: "none",
                background: "#f97316",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Open final walking leg
            </button>
          </div>
        )}

        {!destLoc && (
          <p
            style={{
              marginTop: 8,
              fontSize: "0.85rem",
              color: "#9ca3af",
            }}
          >
            Pick a destination on the map to see full journey with possible
            interchanges.
          </p>
        )}

        {destLoc && !journey && (
          <p
            style={{
              marginTop: 8,
              fontSize: "0.85rem",
              color: "#f97316",
            }}
          >
            No suitable BMTC route (with at most one interchange) found in the
            demo dataset between these stops.
          </p>
        )}
      </div>
    </div>
  );
}