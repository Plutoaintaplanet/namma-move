import { useState, useCallback, useMemo, useEffect } from "react";
import DualMapPicker from "../DualMapPicker";
import SavedLocations from "../components/SavedLocations";
import CommuteSocial from "../components/CommuteSocial";
import stopsJson from "../data/gtfs_stops.json";
import routeStopsJson from "../data/gtfs_route_stops.json";

export default function Planner({ setActiveJourney, walletBalance, setWalletBalance }) {
    const [originLoc, setOriginLoc] = useState(null);
    const [destLoc, setDestLoc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [allRoutes, setAllRoutes] = useState([]);
    const [cabInfo, setCabInfo] = useState(null);
    const [autoStands, setAutoStands] = useState([]);
    const [noRoute, setNoRoute] = useState("");
    const [timeMode, setTimeMode] = useState("now");
    const [timeInput, setTimeInput] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    });

    const activeStopIds = useMemo(() => new Set(routeStopsJson.map(rs => rs.stop_id)), []);

    const getBaseUrl = () => {
        const isProd = window.location.hostname !== "localhost";
        return isProd ? "/api" : (import.meta.env.VITE_API_URL || "http://localhost:4000/api");
    };

    const compute = useCallback(async (origin, dest) => {
        if (!origin || !dest) return;
        setLoading(true); setSearched(true);
        setAllRoutes([]); setNoRoute("");

        let url = `${getBaseUrl()}/route?fromLat=${origin.lat}&fromLon=${origin.lon}&toLat=${dest.lat}&toLon=${dest.lon}`;
        if (timeMode !== "now") url += `&time=${timeInput}`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            setAllRoutes(data.routes || []);
            setCabInfo(data.cab);
            setAutoStands(data.autoStands || []);
            if (!data.routes || data.routes.length === 0) setNoRoute("No transit routes found.");
        } catch (e) {
            setNoRoute(`Routing Error: ${e.message}.`);
        } finally {
            setLoading(false);
        }
    }, [timeMode, timeInput]);

    const handleSearch = () => {
        if (originLoc && destLoc) compute(originLoc, destLoc);
    };

    const handleSavedSelect = (loc) => {
        if (originLoc && !destLoc) setDestLoc(loc);
        else setOriginLoc(loc);
    };

    return (
        <div className="planner-page">
            <div className="planner-header">
                <h2>Plan your Journey</h2>
                <p>Find the best bus and metro routes across Bengaluru.</p>
            </div>

            <div className="search-card">
                <DualMapPicker
                    stops={stopsJson}
                    activeIds={activeStopIds}
                    onOriginSelected={loc => { setOriginLoc(loc); setSearched(false); }}
                    onDestinationSelected={loc => { setDestLoc(loc); setSearched(false); }}
                    initialOrigin={originLoc}
                    initialDest={destLoc}
                />

                <div className="planner-time-row">
                    <div className="time-selector">
                        {["now", "leave", "arrive"].map(m => (
                            <button 
                                key={m}
                                className={timeMode === m ? 'active' : ''}
                                onClick={() => setTimeMode(m)}
                            >
                                {m === 'now' ? 'Now' : m === 'leave' ? 'Leave At' : 'Arrive By'}
                            </button>
                        ))}
                    </div>
                    {timeMode !== 'now' && (
                        <input type="time" value={timeInput} onChange={e => setTimeInput(e.target.value)} />
                    )}
                </div>

                <button 
                    className="btn-search" 
                    onClick={handleSearch}
                    disabled={!originLoc || !destLoc || loading}
                >
                    {loading ? "Calculating..." : "Find Best Routes"}
                </button>
            </div>

            {searched && !loading && (
                <div className="results-container">
                    {allRoutes.some(r => (r.labels || []).length > 0) && (
                        <div className="results-section">
                            <h4 className="section-label">🌟 Best Options</h4>
                            <div className="results-grid">
                                {allRoutes.filter(r => (r.labels || []).length > 0).map((route, idx) => (
                                    <RouteResult 
                                        key={`best-${idx}`}
                                        hit={route} 
                                        title={(route.labels || []).join(" · ")} 
                                        icon={route.cls === 'metro' ? "🚇" : route.cls === 'bus' ? "🚌" : "🔀"} 
                                        cabInfo={cabInfo} 
                                        setActiveJourney={setActiveJourney}
                                        walletBalance={walletBalance}
                                        setWalletBalance={setWalletBalance}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="results-section" style={{marginTop: '2rem'}}>
                        <h4 className="section-label">📋 All Alternatives</h4>
                        <div className="results-grid">
                            {allRoutes.map((route, idx) => (
                                <RouteResult 
                                    key={idx}
                                    hit={route} 
                                    title={`Option ${idx + 1}`} 
                                    icon={route.cls === 'metro' ? "🚇" : route.cls === 'bus' ? "🚌" : "🔀"} 
                                    cabInfo={cabInfo} 
                                    setActiveJourney={setActiveJourney}
                                    walletBalance={walletBalance}
                                    setWalletBalance={setWalletBalance}
                                />
                            ))}
                        </div>
                    </div>

                    {autoStands.length > 0 && (
                        <div className="auto-stands-section">
                            <h4>🛺 Nearby Auto Stands</h4>
                            <div className="auto-stands-pills">
                                {autoStands.map(s => (
                                    <div key={s.id} className="auto-pill">{s.name} · {Math.round(s.dist)}m</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {cabInfo && (
                        <div className="fare-comparison-card">
                            <div className="comparison-header">
                                <h3>Private Transport Estimates</h3>
                                <span>{cabInfo.km} km distance</span>
                            </div>
                            <div className="fare-grid">
                                <div className="fare-item">
                                    <span className="fare-icon">🛺</span>
                                    <div className="fare-info">
                                        <strong>Auto (Meter)</strong>
                                        <span>₹{cabInfo.autoFare}</span>
                                    </div>
                                    <a href="https://www.rapido.bike/" target="_blank" className="book-btn">Rapido</a>
                                </div>
                                <div className="fare-item highlight">
                                    <span className="fare-icon">🚕</span>
                                    <div className="fare-info">
                                        <strong>Cab / Taxi</strong>
                                        <span>₹{cabInfo.cabFare}</span>
                                    </div>
                                    <div className="book-group">
                                        <a href="https://book.olacabs.com/" target="_blank">Ola</a>
                                        <a href="https://m.uber.com/" target="_blank">Uber</a>
                                    </div>
                                </div>
                                <div className="fare-item">
                                    <span className="fare-icon">🏍️</span>
                                    <div className="fare-info">
                                        <strong>Bike Taxi</strong>
                                        <span>₹{cabInfo.bikeFare}</span>
                                    </div>
                                    <a href="https://www.rapido.bike/" target="_blank" className="book-btn">Rapido</a>
                                </div>
                            </div>
                            <p className="fare-disclaimer">* Fares are estimated based on Bengaluru standard rates. Surge may apply.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function RouteSummary({ hit }) {
    if (!hit || !hit.legs || !hit.oStop || !hit.dStop) return null;
    const { legs, oStop, dStop } = hit;
    return (
        <div className="route-summary-bar">
            <div className="summary-segment walk" style={{ flex: oStop.walkMin || 1 }}>
                <span className="segment-icon">🚶</span>
                <span className="segment-label">{oStop.walkMin || 0}</span>
            </div>
            {legs.map((leg, i) => (
                <div key={i} className={`summary-segment ${leg.mode || 'bus'}`} style={{ flex: leg.duration || 1 }}>
                    <span className="segment-icon">{leg.mode === 'metro' ? '🚇' : '🚌'}</span>
                    <span className="segment-label">{leg.duration || 0}</span>
                </div>
            ))}
            <div className="summary-segment walk" style={{ flex: dStop.walkMin || 1 }}>
                <span className="segment-icon">🚶</span>
                <span className="segment-label">{dStop.walkMin || 0}</span>
            </div>
        </div>
    );
}

function RouteResult({ hit, title, icon, cabInfo, setActiveJourney, walletBalance, setWalletBalance }) {
    if (!hit || !hit.legs || !hit.oStop || !hit.dStop) return null;
    const { legs, oStop, dStop, totalMins, fare, arrive, labels = [] } = hit;
    const [cardStatus, setCardStatus] = useState({ aiAnalysis: "", analyzing: false, hasStarted: false, savings: 0 });

    const startJourney = () => {
        if (walletBalance < fare) {
            alert("Insufficient wallet balance! Please top up in the Wallet tab.");
            return;
        }
        setWalletBalance(prev => prev - (fare || 0));
        setActiveJourney({
            route: hit,
            startTime: new Date().toLocaleTimeString(),
            tickets: legs.map(l => ({
                id: Math.random().toString(36).substr(2, 9).toUpperCase(),
                mode: l.mode,
                routeName: l.route?.name || "Unknown Route",
                qr: `TKT-${(l.mode || 'BUS').toUpperCase()}-${Date.now()}`
            }))
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="result-card">
            {/* Top Status Bar */}
            <div className="result-card-top-status">
                <div className="label-badges">
                    {(labels || []).map((l, li) => (
                        <span key={li} className={`status-badge ${(l || "").toLowerCase().replace(/\s+/g, "-")}`}>{l}</span>
                    ))}
                </div>
                {cardStatus.analyzing ? (
                    <span className="status-badge ai">🤖 AI Analyzing...</span>
                ) : cardStatus.aiAnalysis && (
                    <span className="status-badge ai">🤖 {cardStatus.aiAnalysis}</span>
                )}
                {cardStatus.hasStarted && (
                    <span className="status-badge savings">✅ Saved ₹{cardStatus.savings} & 1.2kg CO2</span>
                )}
            </div>

            <div className="result-header">
                <span className="result-icon">{icon}</span>
                <div className="result-meta">
                    <span className="result-title">{title}</span>
                    <span className="result-fare">₹{fare || 0}</span>
                </div>
                <div className="result-time">
                    <span className="duration">{Math.round(totalMins || 0)} min</span>
                    <span className="arrival">{arrive || "--:--"}</span>
                </div>
            </div>

            <RouteSummary hit={hit} />
            
            <div className="result-detailed-timeline">
                <div className="timeline-item">
                    <span className="timeline-emoji">📍</span>
                    <div className="timeline-content">
                        <strong>Walk to {oStop.name || "Station"}</strong>
                        <span>~{oStop.walkMin || 0} min walk</span>
                    </div>
                </div>

                {legs.map((leg, i) => (
                    <div key={i} className="timeline-item">
                        <span className="timeline-emoji">{leg.mode === 'metro' ? '🚇' : '🚌'}</span>
                        <div className="timeline-content">
                            <div className="leg-main">
                                <strong>{leg.route?.name || "Unknown Route"}</strong>
                                <span className="leg-duration">{leg.duration || 0} min</span>
                            </div>
                            <details className="leg-stops-details">
                                <summary>{(leg.stops || []).length} stops</summary>
                                <ul className="stops-list">
                                    {(leg.stops || []).map((s, si) => (
                                        <li key={si}>{s.name || "Unnamed Stop"}</li>
                                    ))}
                                </ul>
                            </details>
                        </div>
                    </div>
                ))}

                <div className="timeline-item">
                    <span className="timeline-emoji">🏁</span>
                    <div className="timeline-content">
                        <strong>Walk to Destination</strong>
                        <span>~{dStop.walkMin || 0} min from {dStop.name || "Station"}</span>
                    </div>
                </div>
            </div>

            <div className="result-actions" style={{padding: '0 1.5rem 1.5rem'}}>
                <button className="btn-primary" style={{width: '100%'}} onClick={startJourney}>
                    🚀 Let's Travel (Auto-pay ₹{fare || 0})
                </button>
            </div>

            <CommuteSocial 
                routeId={legs[0]?.route?.id} 
                routeName={legs[0]?.route?.name} 
                cabFare={cabInfo?.cabFare} 
                transitFare={fare} 
                onStatusUpdate={setCardStatus}
            />
        </div>
    );
}
