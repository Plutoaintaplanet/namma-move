import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { METRO_LINES, getTrainPositions, getCurrentFreq } from "../data/metro_lines";

// Fix leaflet default icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom train marker SVG
// Subtle, muted metro colors
const SUBTLE_COLORS = {
  "M-PL": "rgba(156, 120, 180, 0.5)",
  "M-GL": "rgba(100, 170, 120, 0.5)",
  "M-YL": "rgba(200, 170, 90, 0.5)",
};
const MUTED_COLORS = {
  "M-PL": "#9B7BB4",
  "M-GL": "#64AA78",
  "M-YL": "#C8AA5A",
};

function makeTrainIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="${color}" fill-opacity="0.85" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
      <text x="15" y="20" text-anchor="middle" font-size="12" fill="white">🚇</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: "train-marker-icon",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FitBounds({ lines }) {
  const map = useMap();
  useEffect(() => {
    const allPoints = lines.flatMap(l => l.stations.map(s => [s.lat, s.lon]));
    if (allPoints.length) map.fitBounds(allPoints, { padding: [40, 40] });
  }, []);
  return null;
}

// Live countdown hook
function useCountdown(targetSec) {
  const [secs, setSecs] = useState(targetSec);
  useEffect(() => {
    setSecs(targetSec);
    if (targetSec <= 0) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [targetSec]);
  return secs;
}

function CountdownChip({ label, freqSec, color }) {
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const initialSecs = freqSec - (nowSec % freqSec);
  const secs = useCountdown(initialSecs);
  const mins = Math.floor(secs / 60);
  const s = secs % 60;

  return (
    <div className="metro-countdown-chip" style={{ borderColor: color }}>
      <div className="countdown-line-name" style={{ color }}>{label}</div>
      <div className="countdown-time">
        {secs === 0
          ? <span className="now-badge">🚇 Departing Now!</span>
          : <><span className="countdown-num">{mins}</span><span className="countdown-unit">m </span><span className="countdown-num">{s.toString().padStart(2,"0")}</span><span className="countdown-unit">s</span></>
        }
      </div>
      <div className="countdown-label">next train</div>
    </div>
  );
}

function LeaveByPanel({ selectedStation }) {
  const [walkMin, setWalkMin] = useState(10);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    if (!selectedStation) { setSuggestion(null); return; }
    compute();
  }, [selectedStation, walkMin]);

  function compute() {
    if (!selectedStation) return;
    const { line, station } = selectedStation;
    const now = new Date();
    const h = now.getHours();
    const isPeak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
    const freq = isPeak ? line.freq : line.freqOffPeak;
    const nowMin = h * 60 + now.getMinutes();
    const nowSec = now.getSeconds();
    const minsUntilNext = freq - (nowMin % freq || freq);
    const secsUntilNext = minsUntilNext * 60 - nowSec;

    const leaveAt = new Date(Date.now() + (secsUntilNext - walkMin * 60) * 1000);
    const nextTrain = new Date(Date.now() + secsUntilNext * 1000);

    const fmt = d => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    setSuggestion({
      leaveBy: fmt(leaveAt),
      nextTrain: fmt(nextTrain),
      walkMin,
      waitMin: Math.max(0, Math.round((secsUntilNext - walkMin * 60) / 60)),
      line: line.name,
      lineColor: line.color,
      station: station.name,
      tooLate: secsUntilNext < walkMin * 60,
    });
  }

  if (!selectedStation) {
    return (
      <div className="leave-by-panel empty">
        <div className="leave-by-icon">🗺️</div>
        <p>Click any station on the map to get a <strong>leave-by suggestion</strong></p>
      </div>
    );
  }

  return (
    <div className="leave-by-panel" style={{ borderColor: selectedStation.line.color }}>
      <div className="leave-by-header">
        <span className="leave-by-station" style={{ color: selectedStation.line.color }}>
          📍 {selectedStation.station.name}
        </span>
        <span className="leave-by-line">{selectedStation.line.name}</span>
      </div>

      <div className="leave-by-walk-row">
        <span>🚶 Walk time:</span>
        <div className="walk-stepper">
          <button onClick={() => setWalkMin(m => Math.max(1, m - 1))}>−</button>
          <span>{walkMin} min</span>
          <button onClick={() => setWalkMin(m => Math.min(60, m + 1))}>+</button>
        </div>
      </div>

      {suggestion && (
        suggestion.tooLate ? (
          <div className="leave-by-result late">
            <span className="late-icon">⚠️</span>
            <div>
              <strong>You'll miss this train!</strong>
              <p>Next train at {suggestion.nextTrain}. Leave now to walk {suggestion.walkMin} min.</p>
            </div>
          </div>
        ) : (
          <div className="leave-by-result">
            <div className="leave-by-time-block">
              <span className="lbt-label">Leave by</span>
              <span className="lbt-time">{suggestion.leaveBy}</span>
            </div>
            <div className="leave-by-arrow">→</div>
            <div className="leave-by-time-block">
              <span className="lbt-label">Train departs</span>
              <span className="lbt-time">{suggestion.nextTrain}</span>
            </div>
          </div>
        )
      )}
      {suggestion && !suggestion.tooLate && (
        <p className="leave-by-note">
          Walk {suggestion.walkMin} min · Wait {suggestion.waitMin} min at platform
        </p>
      )}
    </div>
  );
}

export default function MetroLiveMap() {
  const [trainPositions, setTrainPositions] = useState({});
  const [tick, setTick] = useState(0);
  const [selectedLine, setSelectedLine] = useState(null); // null = all
  const [selectedStation, setSelectedStation] = useState(null);
  const [now, setNow] = useState(new Date());

  // Animate trains every second
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setTick(t => t + 1);
      const pos = {};
      METRO_LINES.forEach(line => {
        pos[line.id] = getTrainPositions(line, new Date());
      });
      setTrainPositions(pos);
    }, 1000);

    // Initial load
    const pos = {};
    METRO_LINES.forEach(line => {
      pos[line.id] = getTrainPositions(line, new Date());
    });
    setTrainPositions(pos);

    return () => clearInterval(id);
  }, []);

  const visibleLines = selectedLine
    ? METRO_LINES.filter(l => l.id === selectedLine)
    : METRO_LINES;

  const isServiceHours = now.getHours() >= 5 && now.getHours() < 23;

  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });

  return (
    <div className="metro-live-page">
      {/* Header */}
      <div className="metro-live-header">
        <div className="metro-live-title-row">
          <div>
            <h2 className="metro-live-title">
              <span className="live-pulse-dot" />
              Metro Live Tracker
            </h2>
            <p className="metro-live-sub">Real-time animated positions · Bengaluru Namma Metro</p>
          </div>
          <div className="metro-clock">{timeStr}</div>
        </div>

        {/* Line selector pills */}
        <div className="metro-line-pills">
          <button
            className={`metro-pill ${!selectedLine ? "active" : ""}`}
            onClick={() => setSelectedLine(null)}
          >All Lines</button>
          {METRO_LINES.map(line => (
            <button
              key={line.id}
              className={`metro-pill ${selectedLine === line.id ? "active" : ""}`}
              style={{ "--pill-color": line.color }}
              onClick={() => setSelectedLine(line.id)}
            >
              <span className="pill-dot" style={{ background: line.color }} />
              {line.name}
            </button>
          ))}
        </div>
      </div>

      <div className="metro-live-body">
        {/* Sidebar */}
        <div className="metro-live-sidebar">
          {/* Countdown cards */}
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">⏱ Next Train Departures</h4>
            {visibleLines.map(line => (
              <CountdownChip
                key={line.id}
                label={line.name}
                freqSec={getCurrentFreq(line) * 60}
                color={line.color}
              />
            ))}
          </div>

          {/* Leave-by suggestion */}
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">🏃 Leave-By Planner</h4>
            <LeaveByPanel selectedStation={selectedStation} />
          </div>

          {/* Active trains count */}
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">🚇 Active Trains</h4>
            {visibleLines.map(line => {
              const count = (trainPositions[line.id] || []).length;
              return (
                <div key={line.id} className="active-trains-row">
                  <span className="atrain-dot" style={{ background: line.color }} />
                  <span>{line.name}</span>
                  <span className="atrain-count" style={{ color: line.color }}>
                    {isServiceHours ? count : 0} trains
                  </span>
                </div>
              );
            })}
          </div>

          <div className="simulation-badge">
            <span>ℹ️</span>
            <span>Positions are schedule-simulated based on official BMRCL timetables.</span>
          </div>
        </div>

        {/* Map */}
        <div className="metro-live-map-wrap">
          {!isServiceHours && (
            <div className="service-closed-overlay">
              <span>🌙</span>
              <strong>Metro service is closed</strong>
              <p>Service runs 05:00 AM – 11:00 PM daily.</p>
            </div>
          )}
          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={12}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <FitBounds lines={visibleLines} />

            {visibleLines.map(line => (
              <Polyline
                key={`line-${line.id}`}
                positions={line.stations.map(s => [s.lat, s.lon])}
                pathOptions={{ color: SUBTLE_COLORS[line.id] || line.color, weight: 3, opacity: 1 }}
              />
            ))}

            {/* Station markers */}
            {visibleLines.map(line =>
              line.stations.map(station => (
                <CircleMarker
                  key={`st-${station.id}`}
                  center={[station.lat, station.lon]}
                  radius={5}
                  pathOptions={{ color: MUTED_COLORS[line.id] || line.color, fillColor: "white", fillOpacity: 0.85, weight: 1.5 }}
                  eventHandlers={{
                    click: () => setSelectedStation({ station, line })
                  }}
                >
                  <Popup className="metro-popup">
                    <div className="metro-popup-inner">
                      <strong style={{ color: line.color }}>{station.name}</strong>
                      <span className="popup-line">{line.name}</span>
                      <button
                        className="popup-leave-btn"
                        onClick={() => setSelectedStation({ station, line })}
                      >
                        🏃 Plan leave time
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))
            )}

            {/* Animated train markers */}
            {isServiceHours && visibleLines.map(line =>
              (trainPositions[line.id] || []).map((train, i) => (
                <Marker
                  key={`train-${line.id}-${i}`}
                  position={[train.lat, train.lon]}
                  icon={makeTrainIcon(MUTED_COLORS[line.id] || line.color)}
                >
                  <Popup className="metro-popup">
                    <div className="metro-popup-inner">
                      <strong style={{ color: line.color }}>🚇 {line.name} Train</strong>
                      <span className="popup-line">
                        {train.direction === "forward" ? "→" : "←"} Next stop: <b>{train.nextStop?.name}</b>
                      </span>
                      <span className="popup-eta">ETA: ~{train.etaMin} min</span>
                    </div>
                  </Popup>
                </Marker>
              ))
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
