import { useState, useMemo } from "react";
import stopsJson from "./data/gtfs_stops.json";
import routesJson from "./data/gtfs_routes.json";
import routeStopsJson from "./data/gtfs_route_stops.json";

// ── Time Helpers ──────────────────────────────────────────────────────────────
function fmtTime(date) {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getNextDepartures(baseTime, freqMin, count = 3) {
    const departures = [];
    let current = new Date(baseTime);
    const m = current.getMinutes();
    const wait = freqMin - (m % freqMin);
    current.setMinutes(m + wait);
    current.setSeconds(0);

    for (let i = 0; i < count; i++) {
        departures.push(new Date(current));
        current.setMinutes(current.getMinutes() + freqMin);
    }
    return departures;
}

const METRO_LINES = [
    { id: "M-P", name: "Purple Line", color: "var(--purple)", from: "Whitefield", to: "Challaghatta", freq: 6 },
    { id: "M-G", name: "Green Line", color: "var(--teal)", from: "Madavara", to: "Silk Institute", freq: 8 },
    { id: "M-Y", name: "Yellow Line", color: "var(--accent)", from: "RV Road", to: "Bommasandra", freq: 10 }
];

export default function SchedulesPage() {
    const [tab, setTab] = useState("metro"); // "metro" | "bus"
    const [busSearch, setBusSearch] = useState("");
    const [selectedStop, setSelectedStop] = useState(null);

    const now = new Date();

    // ── Bus Logic ─────────────────────────────────────────────────────────────
    const filteredStops = useMemo(() => {
        if (busSearch.length < 3) return [];
        return stopsJson
            .filter(s => !s.id.toString().startsWith("M-") && s.name.toLowerCase().includes(busSearch.toLowerCase()))
            .slice(0, 6);
    }, [busSearch]);

    const stopSchedules = useMemo(() => {
        if (!selectedStop) return [];
        
        // Find all routes passing through this stop
        const stopRouteIds = routeStopsJson
            .filter(rs => rs.stop_id === selectedStop.id)
            .map(rs => rs.route_id);
        
        const uniqueRouteIds = [...new Set(stopRouteIds)];
        
        return uniqueRouteIds.map(rid => {
            const route = routesJson.find(r => r.id === rid);
            if (!route) return null;
            
            // BMTC frequency estimation: 15-20 min normally, 8-12 min peak
            const h = now.getHours();
            const isPeak = (h >= 8 && h < 11) || (h >= 17 && h < 20);
            const freq = isPeak ? 12 : 20;
            
            return {
                ...route,
                next: getNextDepartures(now, freq, 3)
            };
        }).filter(Boolean);
    }, [selectedStop]);

    return (
        <div className="news-page">
            <div className="news-header">
                <h1 className="news-title">Transit Schedules</h1>
                <div className="news-filters">
                    <button 
                        className={`news-filter-btn ${tab === "metro" ? "active" : ""}`}
                        onClick={() => setTab("metro")}
                    >🚇 Metro</button>
                    <button 
                        className={`news-filter-btn ${tab === "bus" ? "active" : ""}`}
                        onClick={() => setTab("bus")}
                    >🚌 BMTC Bus</button>
                </div>
            </div>

            {tab === "metro" && (
                <div className="jcards-col">
                    {METRO_LINES.map(line => (
                        <div key={line.id} className="jcard" style={{ borderTopColor: line.color }}>
                            <div className="jcard-summary">
                                <div className="jcard-summary-left">
                                    <span className="jcard-mode-icon">🚇</span>
                                    <div>
                                        <div className="jcard-label" style={{ color: line.color }}>{line.name}</div>
                                        <div className="jcard-sub">{line.from} ↔ {line.to}</div>
                                    </div>
                                </div>
                                <div className="jcard-summary-right">
                                    <div className="jcard-time" style={{ fontSize: '1.1rem' }}>Every {line.freq} <span>min</span></div>
                                    <div className="news-source-badge live" style={{marginTop: '4px'}}>Operational</div>
                                </div>
                            </div>
                            <div className="timeline" style={{padding: '12px 16px'}}>
                                <div className="tl-label" style={{marginBottom: '8px'}}>Upcoming Departures (from termini)</div>
                                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                                    {getNextDepartures(now, line.freq, 4).map((d, i) => (
                                        <div key={i} className="results-time-badge" style={{ color: line.color, borderColor: line.color }}>
                                            {fmtTime(d)}
                                        </div>
                                    ))}
                                </div>
                                <p style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px'}}>
                                    * Trains run from 5:00 AM to 11:00 PM. Frequencies may vary based on terminal station.
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "bus" && (
                <div className="jcards-col">
                    <div className="search-panel" style={{background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'none'}}>
                        <div className="dual-input-row">
                            <span className="pin-dot">🔍</span>
                            <div style={{ flex: 1, position: "relative" }}>
                                <input
                                    type="text"
                                    value={busSearch}
                                    onChange={(e) => { setBusSearch(e.target.value); setSelectedStop(null); }}
                                    placeholder="Search for a bus stop (e.g. Majestic)"
                                    className="map-search-input"
                                    style={{ background: 'var(--bg)', color: 'var(--text)' }}
                                />
                                {filteredStops.length > 0 && !selectedStop && (
                                    <ul className="nominatim-results">
                                        {filteredStops.map(s => (
                                            <li key={s.id} onClick={() => { setSelectedStop(s); setBusSearch(s.name); }}>
                                                {s.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {selectedStop && (
                        <div className="results">
                            <h2 className="results-title">Routes at {selectedStop.name}</h2>
                            {stopSchedules.length === 0 ? (
                                <p className="hint-msg">No active routes found for this stop in our database.</p>
                            ) : (
                                <div className="jcards-col">
                                    {stopSchedules.map(route => (
                                        <div key={route.id} className="jcard" style={{ borderTopColor: 'var(--teal)' }}>
                                            <div className="jcard-summary">
                                                <div className="jcard-summary-left">
                                                    <div className="tl-badge tl-badge-bus" style={{fontSize: '1rem', padding: '4px 12px'}}>
                                                        {route.short_name}
                                                    </div>
                                                    <div>
                                                        <div className="jcard-label">{route.long_name || 'Regular Service'}</div>
                                                        <div className="jcard-sub">Next in {Math.round((route.next[0] - now) / 60000)} mins</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="timeline" style={{padding: '12px 16px'}}>
                                                <div className="tl-label" style={{marginBottom: '8px', fontSize: '0.75rem'}}>Today's Schedule (Estimated)</div>
                                                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                                    {route.next.map((d, i) => (
                                                        <div key={i} className="results-time-badge">
                                                            {fmtTime(d)}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {!selectedStop && !busSearch && (
                        <div className="no-route" style={{marginTop: '20px'}}>
                            <span>💡</span>
                            <div>
                                <strong>Find Bus Timings</strong>
                                <p>Enter a stop name above to see all buses passing through and their estimated arrival times.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
