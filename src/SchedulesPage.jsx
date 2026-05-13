import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import stopsJson from "./data/gtfs_stops.json";
import routesJson from "./data/gtfs_routes.json";
import routeStopsJson from "./data/gtfs_route_stops.json";

// ── Time Helpers ──────────────────────────────────────────────────────────────
function fmtTime(date) {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getNextDepartures(baseTime, freqMin, count = 4) {
    const departures = [];
    let current = new Date(baseTime);
    const m = current.getMinutes();
    const wait = freqMin - (m % freqMin) || freqMin;
    current.setMinutes(m + wait);
    current.setSeconds(0);
    for (let i = 0; i < count; i++) {
        departures.push(new Date(current));
        current.setMinutes(current.getMinutes() + freqMin);
    }
    return departures;
}

const METRO_LINES = [
    { id: "M-PL", name: "Purple Line", color: "#9B59B6", from: "Baiyappanahalli", to: "Challaghatta", freq: 6, freqOff: 10 },
    { id: "M-GL", name: "Green Line",  color: "#27AE60", from: "Nagasandra", to: "Silk Institute", freq: 8, freqOff: 12 },
    { id: "M-YL", name: "Yellow Line", color: "#F39C12", from: "RV Road", to: "Bommasandra", freq: 10, freqOff: 15 }
];

function getCurrentFreq(line) {
    const h = new Date().getHours();
    const isPeak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
    return isPeak ? line.freq : line.freqOff;
}

// Live countdown component (ticks every second)
function LiveCountdown({ freqSec, color }) {
    const [secs, setSecs] = useState(() => {
        const now = new Date();
        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        return freqSec - (nowSec % freqSec);
    });

    useEffect(() => {
        const id = setInterval(() => {
            setSecs(s => {
                if (s <= 1) {
                    const now = new Date();
                    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                    return freqSec - (nowSec % freqSec);
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [freqSec]);

    const mins = Math.floor(secs / 60);
    const s = secs % 60;

    return (
        <div className="sched-countdown-wrap">
            <div className="sched-countdown-inner" style={{ borderColor: color }}>
                {secs <= 10
                    ? <span className="sched-departing" style={{ color }}>🚇 Departing!</span>
                    : <>
                        <span className="sched-cd-num" style={{ color }}>{mins}</span>
                        <span className="sched-cd-sep">m </span>
                        <span className="sched-cd-num" style={{ color }}>{s.toString().padStart(2, "0")}</span>
                        <span className="sched-cd-sep">s</span>
                    </>
                }
            </div>
            <span className="sched-cd-label">until next train</span>
        </div>
    );
}

export default function SchedulesPage() {
    const [tab, setTab] = useState("metro");
    const [busSearch, setBusSearch] = useState("");
    const [selectedStop, setSelectedStop] = useState(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(id);
    }, []);

    const filteredStops = useMemo(() => {
        if (busSearch.length < 3) return [];
        return stopsJson
            .filter(s => s.name.toLowerCase().includes(busSearch.toLowerCase()))
            .slice(0, 8);
    }, [busSearch]);

    const stopSchedules = useMemo(() => {
        if (!selectedStop) return [];
        const stopRouteIds = routeStopsJson
            .filter(rs => rs.stop_id === selectedStop.id)
            .map(rs => rs.route_id);
        const uniqueRouteIds = [...new Set(stopRouteIds)];
        return uniqueRouteIds.map(rid => {
            const route = routesJson.find(r => r.id === rid);
            if (!route) return null;
            let freq = 20;
            const isMetro = rid.toString().startsWith("M-");
            if (isMetro) {
                const ml = METRO_LINES.find(l => l.id === rid);
                freq = ml ? getCurrentFreq(ml) : 8;
            } else {
                const h = now.getHours();
                const isPeak = (h >= 8 && h < 11) || (h >= 17 && h < 20);
                freq = isPeak ? 12 : 20;
            }
            return { ...route, isMetro, next: getNextDepartures(now, freq, 3) };
        }).filter(Boolean);
    }, [selectedStop, now]);

    return (
        <div className="schedules-page-container">
            <div className="page-header">
                <h2>🕒 Transit Schedules</h2>
                <p>Live countdowns and departure times for Namma Metro &amp; BMTC buses.</p>
            </div>

            <div className="news-filters" style={{ marginBottom: '2rem' }}>
                <button className={`news-filter-btn ${tab === "metro" ? "active" : ""}`} onClick={() => setTab("metro")}>🚇 Metro Lines</button>
                <button className={`news-filter-btn ${tab === "bus" ? "active" : ""}`} onClick={() => setTab("bus")}>🚌 Search Stops</button>
            </div>

            {tab === "metro" && (
                <div className="results-grid">
                    {METRO_LINES.map(line => {
                        const freq = getCurrentFreq(line);
                        return (
                            <div key={line.id} className="result-card" style={{ borderTop: `4px solid ${line.color}` }}>
                                <div className="result-header">
                                    <span className="result-icon">🚇</span>
                                    <div className="result-meta">
                                        <span className="result-title" style={{ color: line.color }}>{line.name}</span>
                                        <span className="result-fare">{line.from} ↔ {line.to}</span>
                                    </div>
                                    <div className="result-time">
                                        <span className="duration" style={{ fontSize: '1rem' }}>Every {freq}m</span>
                                    </div>
                                </div>

                                <div style={{ padding: '0 1.5rem 0.5rem' }}>
                                    <LiveCountdown freqSec={freq * 60} color={line.color} />
                                </div>

                                <div className="result-detailed-timeline" style={{ background: 'transparent', paddingTop: 0 }}>
                                    <div className="timeline-item">
                                        <span className="timeline-emoji">🕒</span>
                                        <div className="timeline-content">
                                            <strong>Upcoming Departures</strong>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                {getNextDepartures(now, freq, 4).map((d, i) => (
                                                    <span key={i} className="auto-pill" style={{ borderColor: line.color }}>
                                                        {fmtTime(d)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: '0 1.5rem 1.5rem' }}>
                                    <Link
                                        to="/metro-live"
                                        className="btn-secondary"
                                        style={{ display: 'inline-flex', gap: '6px', fontSize: '0.85rem', padding: '8px 16px', borderColor: line.color, color: line.color }}
                                    >
                                        🗺️ View Live Map
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === "bus" && (
                <div className="bus-schedules-section">
                    <div className="search-card" style={{ marginBottom: '2rem' }}>
                        <div className="dual-input-row">
                            <span className="pin-dot">🔍</span>
                            <div style={{ flex: 1, position: "relative" }}>
                                <input
                                    type="text"
                                    value={busSearch}
                                    onChange={(e) => { setBusSearch(e.target.value); setSelectedStop(null); }}
                                    placeholder="Search for a stop (e.g. Majestic or Indiranagar)"
                                    className="map-search-input"
                                />
                                {filteredStops.length > 0 && !selectedStop && (
                                    <ul className="nominatim-results">
                                        {filteredStops.map(s => (
                                            <li key={s.id} onClick={() => { setSelectedStop(s); setBusSearch(s.name); }}>
                                                {s.id.startsWith("M-") ? "🚇 " : "🚌 "} {s.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {selectedStop && (
                        <div className="stop-results">
                            <h3 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>Routes at {selectedStop.name}</h3>
                            {stopSchedules.length === 0 ? (
                                <p className="hint-msg">No active routes found for this stop.</p>
                            ) : (
                                <div className="results-grid">
                                    {stopSchedules.map(route => (
                                        <div key={route.id} className="result-card">
                                            <div className="result-header">
                                                <span className="result-icon">{route.isMetro ? '🚇' : '🚌'}</span>
                                                <div className="result-meta">
                                                    <span className="result-title">{route.short_name}</span>
                                                    <span className="result-fare">{route.long_name || 'Regular Service'}</span>
                                                </div>
                                                <div className="result-time">
                                                    <span className="arrival">Next: {Math.round((route.next[0] - now) / 60000)} mins</span>
                                                </div>
                                            </div>
                                            <div className="result-detailed-timeline" style={{ background: 'transparent' }}>
                                                <div className="timeline-item">
                                                    <span className="timeline-emoji">🕒</span>
                                                    <div className="timeline-content">
                                                        <strong>Estimates</strong>
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                            {route.next.map((d, i) => (
                                                                <span key={i} className="auto-pill">{fmtTime(d)}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
