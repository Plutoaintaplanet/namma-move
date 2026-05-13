import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import { METRO_LINES, getTrainPositions, getCurrentFreq } from "../data/metro_lines";
import useRouteSearch from "../lib/useRouteSearch";
import stopsJson from "../data/gtfs_stops.json";
import routeStopsJson from "../data/gtfs_route_stops.json";

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const BENGALURU = [12.9716, 77.5946];

// Subtle metro line colors (muted, not neon)
const SUBTLE_COLORS = {
  "M-PL": "rgba(156, 120, 180, 0.55)",
  "M-GL": "rgba(100, 170, 120, 0.55)",
  "M-YL": "rgba(200, 170, 90, 0.55)",
};
const TRAIN_COLORS = {
  "M-PL": "#9B7BB4",
  "M-GL": "#64AA78",
  "M-YL": "#C8AA5A",
};

function makeTrainIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="12" fill="${color}" fill-opacity="0.9" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
    <text x="14" y="19" text-anchor="middle" font-size="12" fill="white">🚇</text>
  </svg>`;
  return L.divIcon({ html: svg, className: "train-marker-icon", iconSize: [28, 28], iconAnchor: [14, 14] });
}

// Nominatim search
async function nominatimSearch(query) {
  if (!query || query.length < 3) return [];
  const q = encodeURIComponent(query + ", Bangalore, India");
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=6&addressdetails=1`,
      { headers: { "User-Agent": "NammaMove/2.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

function MapClickHandler({ pinMode, onOriginDrop, onDestDrop }) {
  useMapEvents({
    click(e) {
      const loc = { lat: e.latlng.lat, lon: e.latlng.lng, label: "Dropped pin" };
      if (pinMode === "origin") onOriginDrop(loc);
      else onDestDrop(loc);
    },
  });
  return null;
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, Math.max(map.getZoom(), 13), { duration: 0.8 }); }, [center]);
  return null;
}

// Ride-hailing deep link builder
function buildDeepLink(scheme, origin, dest) {
  const oLat = origin?.lat, oLon = origin?.lon;
  const dLat = dest?.lat, dLon = dest?.lon;
  const oLabel = encodeURIComponent(origin?.label || "Origin");
  const dLabel = encodeURIComponent(dest?.label || "Destination");

  switch (scheme) {
    case "nammayatri":
      return `nammayatri://ride?pickup_lat=${oLat}&pickup_lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
    case "rapido":
      return `rapido://booking?pickup_lat=${oLat}&pickup_lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
    case "ola":
      return `https://book.olacabs.com/?serviceType=p2p&utm_source=namma_move&lat=${oLat}&lng=${oLon}&drop_lat=${dLat}&drop_lng=${dLon}`;
    case "uber":
      return `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${oLat}&pickup[longitude]=${oLon}&dropoff[latitude]=${dLat}&dropoff[longitude]=${dLon}&dropoff[nickname]=${dLabel}`;
    default:
      return "#";
  }
}

function RideChip({ name, icon, fare, eta, type, origin, dest, scheme }) {
  const handleClick = () => {
    const url = buildDeepLink(scheme, origin, dest);
    if (url.startsWith("http")) {
      window.open(url, "_blank", "noopener");
    } else {
      window.location.href = url;
    }
  };

  return (
    <button className="hm-ride-chip" onClick={handleClick} title={`Book via ${name}`}>
      <span className="hm-ride-icon">{icon}</span>
      <div className="hm-ride-info">
        <span className="hm-ride-name">{name}</span>
        <span className="hm-ride-type">{type}</span>
      </div>
      <div className="hm-ride-right">
        <span className="hm-ride-fare">₹{fare}</span>
        <span className="hm-ride-eta">{eta}</span>
      </div>
    </button>
  );
}

// Compact search input
function SearchInput({ placeholder, dot, value, onChange, results, onSelect, onGps, onFocus }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="hm-search-row" ref={wrapRef}>
      <span className="hm-dot" style={{ background: dot }} />
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); onFocus?.(); }}
        placeholder={placeholder}
        className="hm-search-input"
      />
      {onGps && (
        <button className="hm-gps-btn" onClick={onGps} title="Use current location">📍</button>
      )}
      {open && results.length > 0 && (
        <ul className="hm-results">
          {results.map((r) => (
            <li key={r.place_id} onMouseDown={() => { onSelect(r); setOpen(false); }}>
              {r.display_name.split(",").slice(0, 2).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Countdown chip
function MiniCountdown({ line }) {
  const [secs, setSecs] = useState(() => {
    const now = new Date();
    const s = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const freq = getCurrentFreq(line) * 60;
    return freq - (s % freq);
  });

  useEffect(() => {
    const id = setInterval(() => setSecs(s => {
      if (s <= 1) {
        const now = new Date();
        const ns = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const freq = getCurrentFreq(line) * 60;
        return freq - (ns % freq);
      }
      return s - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [line]);

  const m = Math.floor(secs / 60);
  const s = secs % 60;

  return (
    <div className="hm-mini-cd" style={{ "--cd-color": TRAIN_COLORS[line.id] }}>
      <span className="hm-cd-dot" style={{ background: TRAIN_COLORS[line.id] }} />
      <span className="hm-cd-name">{line.shortName}</span>
      <span className="hm-cd-time">{m}:{s.toString().padStart(2, "0")}</span>
    </div>
  );
}

// Route result card with leave-by
function RouteCard({ hit, setActiveJourney, walletBalance, setWalletBalance }) {
  if (!hit?.legs || !hit?.oStop || !hit?.dStop) return null;
  const { legs, oStop, dStop, totalMins, fare, arrive, labels = [], cls } = hit;
  const hasMetro = legs.some(l => l.mode === "metro");

  // Compute leave-by for metro legs
  let leaveByInfo = null;
  if (hasMetro) {
    const walkMin = oStop.walkMin || 0;
    const metroLeg = legs.find(l => l.mode === "metro");
    const lineName = metroLeg?.route?.name || "";
    const matchedLine = METRO_LINES.find(l => lineName.toLowerCase().includes(l.name.toLowerCase().split(" ")[0]));
    if (matchedLine) {
      const now = new Date();
      const h = now.getHours();
      const isPeak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
      const freq = isPeak ? matchedLine.freq : matchedLine.freqOffPeak;
      const nowMin = h * 60 + now.getMinutes();
      const minsUntilNext = freq - (nowMin % freq) || freq;
      const leaveInMin = minsUntilNext - walkMin;
      if (leaveInMin > 0) {
        const leaveAt = new Date(Date.now() + leaveInMin * 60000);
        leaveByInfo = {
          leaveBy: leaveAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
          leaveInMin,
          lineName: matchedLine.name,
          color: TRAIN_COLORS[matchedLine.id],
        };
      }
    }
  }

  const startJourney = () => {
    if (walletBalance < fare) { alert("Insufficient wallet balance!"); return; }
    setWalletBalance(prev => prev - (fare || 0));
    setActiveJourney({
      route: hit,
      startTime: new Date().toLocaleTimeString(),
      tickets: legs.map(l => ({
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        mode: l.mode,
        routeName: l.route?.name || "Unknown",
        qr: `TKT-${(l.mode || "BUS").toUpperCase()}-${Date.now()}`
      }))
    });
  };

  return (
    <div className={`hm-route-card ${cls}`}>
      {/* Labels */}
      {labels.length > 0 && (
        <div className="hm-rc-labels">
          {labels.map((l, i) => <span key={i} className="hm-rc-label">{l}</span>)}
        </div>
      )}

      {/* Header row */}
      <div className="hm-rc-header">
        <div className="hm-rc-mode-strip">
          <span className="hm-rc-walk">🚶 {oStop.walkMin || 0}′</span>
          {legs.map((leg, i) => (
            <span key={i} className={`hm-rc-mode ${leg.mode}`}>
              {leg.mode === "metro" ? "🚇" : "🚌"} {leg.duration || 0}′
            </span>
          ))}
          <span className="hm-rc-walk">🚶 {dStop.walkMin || 0}′</span>
        </div>
        <div className="hm-rc-summary">
          <span className="hm-rc-total">{Math.round(totalMins || 0)} min</span>
          <span className="hm-rc-fare">₹{fare || 0}</span>
        </div>
      </div>

      {/* Leave-by info for metro routes */}
      {leaveByInfo && (
        <div className="hm-rc-leaveby" style={{ "--lb-color": leaveByInfo.color }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>Leave in <strong>{leaveByInfo.leaveInMin} min</strong> for {leaveByInfo.lineName}</span>
        </div>
      )}

      {/* Expandable detail */}
      <details className="hm-rc-details">
        <summary>Route details</summary>
        <div className="hm-rc-timeline">
          <div className="hm-tl-item">
            <span className="hm-tl-dot walk" />
            <span>Walk to {oStop.name} · {oStop.walkMin || 0} min</span>
          </div>
          {legs.map((leg, i) => (
            <div key={i} className="hm-tl-item">
              <span className={`hm-tl-dot ${leg.mode}`} />
              <div>
                <strong>{leg.route?.name || "Route"}</strong> · {leg.duration || 0} min · {(leg.stops || []).length} stops
              </div>
            </div>
          ))}
          <div className="hm-tl-item">
            <span className="hm-tl-dot walk" />
            <span>Walk to destination · {dStop.walkMin || 0} min</span>
          </div>
        </div>
      </details>

      <button className="hm-rc-go" onClick={startJourney}>
        Go · ₹{fare || 0}
      </button>
    </div>
  );
}

export default function Landing({ activeJourney, setActiveJourney, walletBalance, setWalletBalance, darkMode }) {
  const [originLoc, setOriginLoc] = useState(null);
  const [destLoc, setDestLoc] = useState(null);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  const [originResults, setOriginResults] = useState([]);
  const [destResults, setDestResults] = useState([]);
  const [pinMode, setPinMode] = useState("destination");
  const [originPos, setOriginPos] = useState(null);
  const [destPos, setDestPos] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [trainPositions, setTrainPositions] = useState({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showBusRoutes, setShowBusRoutes] = useState(false);
  const [busRouteLines, setBusRouteLines] = useState([]);
  const [loadingBusRoutes, setLoadingBusRoutes] = useState(false);

  // Use theme-aware tile layer URL
  const mapUrl = darkMode 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const { loading, searched, allRoutes, cabInfo, rides, error, search, reset } = useRouteSearch();
  const debounceRef = useRef({});

  // Bus route loader
  useEffect(() => {
    if (!showBusRoutes) {
      setBusRouteLines([]);
      return;
    }
    setLoadingBusRoutes(true);
    const timer = setTimeout(() => {
      const grouped = {};
      routeStopsJson.forEach(rs => {
        if (!grouped[rs.route_id]) grouped[rs.route_id] = [];
        grouped[rs.route_id].push(rs.stop_id);
      });
      const stopMap = {};
      stopsJson.forEach(s => { stopMap[s.id] = [s.latitude, s.longitude]; });
      
      const lines = Object.keys(grouped)
        .filter(rid => !rid.toString().startsWith("M-"))
        .slice(0, 100) // Limit for performance
        .map(rid => {
          const coords = grouped[rid].map(sid => stopMap[sid]).filter(Boolean);
          return { id: rid, coords };
        }).filter(r => r.coords.length > 1);
      
      setBusRouteLines(lines);
      setLoadingBusRoutes(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [showBusRoutes]);

  // Train animation
  useEffect(() => {
    const tick = () => {
      const pos = {};
      METRO_LINES.forEach(line => { pos[line.id] = getTrainPositions(line, new Date()); });
      setTrainPositions(pos);
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);

  // Debounced nominatim
  const doSearch = (which, val) => {
    clearTimeout(debounceRef.current[which]);
    if (val.length < 3) { which === "o" ? setOriginResults([]) : setDestResults([]); return; }
    debounceRef.current[which] = setTimeout(async () => {
      const data = await nominatimSearch(val);
      which === "o" ? setOriginResults(data) : setDestResults(data);
    }, 400);
  };

  // Auto-search when both points set
  useEffect(() => {
    if (originLoc && destLoc) {
      search(originLoc, destLoc);
      setSheetOpen(true);
    }
  }, [originLoc, destLoc]);

  const handleOriginSelect = (item) => {
    const loc = { lat: parseFloat(item.lat), lon: parseFloat(item.lon), label: item.display_name };
    setOriginLoc(loc);
    setOriginPos([loc.lat, loc.lon]);
    setOriginQuery(item.display_name.split(",")[0]);
    setOriginResults([]);
    setFlyTarget([loc.lat, loc.lon]);
    setPinMode("destination");
  };

  const handleDestSelect = (item) => {
    const loc = { lat: parseFloat(item.lat), lon: parseFloat(item.lon), label: item.display_name };
    setDestLoc(loc);
    setDestPos([loc.lat, loc.lon]);
    setDestQuery(item.display_name.split(",")[0]);
    setDestResults([]);
    setFlyTarget([loc.lat, loc.lon]);
  };

  const handleOriginDrop = (loc) => {
    setOriginLoc(loc);
    setOriginPos([loc.lat, loc.lon]);
    setOriginQuery(loc.label || "Dropped pin");
    setPinMode("destination");
  };

  const handleDestDrop = (loc) => {
    setDestLoc(loc);
    setDestPos([loc.lat, loc.lon]);
    setDestQuery(loc.label || "Dropped pin");
  };

  const handleGps = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Current location" };
        setOriginLoc(loc);
        setOriginPos([loc.lat, loc.lon]);
        setOriginQuery("📍 Current location");
        setFlyTarget([loc.lat, loc.lon]);
        setPinMode("destination");
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const isServiceHours = (() => { const h = new Date().getHours(); return h >= 5 && h < 23; })();

  return (
    <div className="hm-page">
      {/* Floating search card */}
      {!activeJourney && (
        <div className="hm-search-card">
          <SearchInput
            placeholder="Where from?"
            dot="#4ade80"
            value={originQuery}
            onChange={(v) => { setOriginQuery(v); doSearch("o", v); reset(); }}
            results={originResults}
            onSelect={handleOriginSelect}
            onGps={handleGps}
            onFocus={() => setPinMode("origin")}
          />
          <div className="hm-search-divider" />
          <SearchInput
            placeholder="Where to?"
            dot="#f87171"
            value={destQuery}
            onChange={(v) => { setDestQuery(v); doSearch("d", v); reset(); }}
            results={destResults}
            onSelect={handleDestSelect}
            onFocus={() => setPinMode("destination")}
          />

          {/* Metro countdown strip */}
          {isServiceHours && (
            <div className="hm-cd-strip">
              {METRO_LINES.map(line => <MiniCountdown key={line.id} line={line} />)}
            </div>
          )}
        </div>
      )}

      {/* Full map */}
      <div className="hm-map-wrap">
        <MapContainer center={BENGALURU} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
            url={mapUrl}
          />
          <FlyTo center={flyTarget} />
          <MapClickHandler pinMode={pinMode} onOriginDrop={handleOriginDrop} onDestDrop={handleDestDrop} />

          {/* Bus routes toggleable layer */}
          {showBusRoutes && busRouteLines.map(rl => (
            <Polyline
              key={`bus-line-${rl.id}`}
              positions={rl.coords}
              pathOptions={{ color: "#00A86B", weight: 2, opacity: 0.4 }}
            />
          ))}

          {/* If there's an active journey, show its route instead of all metro lines */}
          {activeJourney ? (
            activeJourney.route.legs.map((leg, idx) => (
              <Polyline
                key={`aj-leg-${idx}`}
                positions={leg.stops.map(s => [s.lat, s.lon])}
                pathOptions={{ 
                  color: leg.mode === 'metro' ? '#8b5cf6' : leg.mode === 'bus' ? '#f59e0b' : '#3b82f6', 
                  weight: 5, 
                  opacity: 0.9,
                  dashArray: leg.mode === 'walk' ? '5, 10' : null 
                }}
              />
            ))
          ) : (
            <>
              {/* Subtle metro lines */}
              {METRO_LINES.map(line => (
                <Polyline
                  key={`line-${line.id}`}
                  positions={line.stations.map(s => [s.lat, s.lon])}
                  pathOptions={{ color: SUBTLE_COLORS[line.id], weight: 3, opacity: 1 }}
                />
              ))}

              {/* Station dots */}
              {METRO_LINES.map(line =>
                line.stations.map(s => (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lon]}
                    radius={3}
                    pathOptions={{ color: TRAIN_COLORS[line.id], fillColor: "#fff", fillOpacity: 0.8, weight: 1.5 }}
                  >
                    <Popup><strong>{s.name}</strong><br/><span style={{fontSize:"0.75rem",color:"#999"}}>{line.name}</span></Popup>
                  </CircleMarker>
                ))
              )}
            </>
          )}

          {/* Animated trains */}
          {isServiceHours && METRO_LINES.map(line =>
            (trainPositions[line.id] || []).map((t, i) => (
              <Marker key={`t-${line.id}-${i}`} position={[t.lat, t.lon]} icon={makeTrainIcon(TRAIN_COLORS[line.id])}>
                <Popup>
                  <strong>{line.name}</strong><br/>
                  Next: {t.nextStop?.name} · ~{t.etaMin}m
                </Popup>
              </Marker>
            ))
          )}

          {/* User pins */}
          {originPos && <Marker position={originPos} icon={greenIcon} />}
          {destPos && <Marker position={destPos} icon={redIcon} />}
        </MapContainer>

        {/* Floating Map Controls */}
        <div className="hm-map-controls">
          <button 
            className={`hm-map-btn ${showBusRoutes ? 'active' : ''}`}
            onClick={() => setShowBusRoutes(!showBusRoutes)}
            title={showBusRoutes ? "Hide Bus Routes" : "Show Bus Routes"}
          >
            {loadingBusRoutes ? '⌛' : '🚌'}
            <span className="hm-map-btn-label">{showBusRoutes ? "Hide Bus" : "Show Bus"}</span>
          </button>
        </div>
      </div>

      {/* Ride-hailing floating bar */}
      <AnimatePresence>
        {!activeJourney && rides && searched && !loading && originLoc && destLoc && (
          <motion.div
            className="hm-rides-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <span className="hm-rides-label">Ride Options</span>
            <RideChip
              name="Uber"
              icon="⚫"
              fare={rides.uber?.fare || rides.ola?.fare}
              eta={rides.uber?.eta || "3-6 min"}
              type="Cab"
              origin={originLoc}
              dest={destLoc}
              scheme="uber"
            />
            <RideChip
              name="Ola"
              icon="🟢"
              fare={rides.ola?.fare}
              eta={rides.ola?.eta}
              type="Cab"
              origin={originLoc}
              dest={destLoc}
              scheme="ola"
            />
            <RideChip
              name="Rapido"
              icon="🟡"
              fare={rides.rapido?.fare}
              eta={rides.rapido?.eta}
              type="Bike"
              origin={originLoc}
              dest={destLoc}
              scheme="rapido"
            />
            <RideChip
              name="Namma Yatri"
              icon="🟠"
              fare={rides.nammayatri?.fare}
              eta={rides.nammayatri?.eta}
              type="Auto"
              origin={originLoc}
              dest={destLoc}
              scheme="nammayatri"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom sheet for results */}
      <AnimatePresence>
        {!activeJourney && (searched || loading) && (
          <motion.div
            className={`hm-bottom-sheet ${sheetOpen ? "open" : ""}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="hm-sheet-handle" onClick={() => setSheetOpen(!sheetOpen)}>
              <div className="hm-handle-bar" />
            </div>

            {loading ? (
              <div className="hm-sheet-loading">
                <div className="hm-loader" />
                <span>Finding best routes…</span>
              </div>
            ) : error ? (
              <div className="hm-sheet-error">{error}</div>
            ) : (
              <div className="hm-sheet-content">
                <div className="hm-sheet-header">
                  <span>{allRoutes.length} route{allRoutes.length !== 1 ? "s" : ""} found</span>
                  {cabInfo && <span className="hm-cab-hint">{cabInfo.km} km</span>}
                </div>
                <div className="hm-route-list">
                  {allRoutes.map((route, idx) => (
                    <RouteCard
                      key={idx}
                      hit={route}
                      setActiveJourney={setActiveJourney}
                      walletBalance={walletBalance}
                      setWalletBalance={setWalletBalance}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
