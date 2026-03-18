import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
    MapContainer, TileLayer, Marker, useMapEvents, useMap, CircleMarker, Popup, Polyline
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import routeStopsJson from "./data/gtfs_route_stops.json";
import routesJson from "./data/gtfs_routes.json";

// Fix Leaflet icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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

const BENGALURU_CENTER = [12.9716, 77.5946];

async function nominatimSearch(query) {
    if (!query || query.length < 3) return [];
    const q = encodeURIComponent(query + ", Bangalore, India");
    const primaryUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=8&addressdetails=1`;

    try {
        const res = await fetch(primaryUrl, {
            headers: {
                "Accept-Language": "en",
                "User-Agent": "NammaMove/1.0 (Bangalore transit; contact: namma-move@example.com)",
            },
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) return data;
        }
    } catch { /* fall through */ }

    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(primaryUrl)}`;
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(7000) });
        if (res.ok) {
            const wrapper = await res.json();
            const data = JSON.parse(wrapper.contents || "[]");
            return Array.isArray(data) ? data : [];
        }
    } catch { /* give up */ }

    return [];
}

// ── Road-snapping helper using OSRM ──
async function fetchRoadPath(coords) {
    if (!coords || coords.length < 2) return coords;
    // OSRM expects {lon},{lat} pairs. Max coords for OSRM public is usually ~100.
    const limitedCoords = coords.slice(0, 100);
    const query = limitedCoords.map(c => `${c[1]},${c[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${query}?overview=full&geometries=geojson`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok') {
            return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        }
    } catch (e) {
        console.error("OSRM Error:", e);
    }
    return coords; 
}

function MapClickHandler({ pinMode, onOriginDrop, onDestDrop, setZoom }) {
    const map = useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            const loc = { lat, lon: lng, label: "Dropped pin" };
            if (pinMode === "origin") onOriginDrop(loc);
            else onDestDrop(loc);
        },
        zoomend() {
            setZoom(map.getZoom());
        }
    });
    return null;
}

function MapCentre({ center }) {
    const map = useMap();
    useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
    return null;
}

function PlaceSearch({ placeholder, dotEmoji, onPlace, isActive, onActivate, showGps }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const debounceRef = useRef(null);
    const wrapRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setResults([]);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        if (val.length < 3) { setResults([]); return; }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            const data = await nominatimSearch(val);
            setResults(data);
            setLoading(false);
        }, 350);
    };

    const handleSelect = (item) => {
        const label = item.display_name.split(",")[0];
        setQuery(label);
        setResults([]);
        onPlace({
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            label: item.display_name,
        });
    };

    const handleGps = () => {
        if (!("geolocation" in navigator)) return;
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            pos => {
                const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "📍 Current location" };
                setQuery("📍 Current location");
                onPlace(loc);
                setGpsLoading(false);
            },
            () => setGpsLoading(false),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    };

    return (
        <div className="dual-input-row" ref={wrapRef}>
            <span className="pin-dot">{dotEmoji}</span>
            <div style={{ flex: 1, position: "relative" }}>
                <input
                    type="text"
                    value={query}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="map-search-input"
                    onFocus={onActivate}
                />
                {loading && <span className="nominatim-loading">Searching…</span>}
                {results.length > 0 && (
                    <ul className="nominatim-results">
                        {results.map((r) => (
                            <li key={r.place_id} onMouseDown={() => handleSelect(r)}>
                                {r.display_name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {showGps && (
                <button 
                    className="pin-toggle-btn" 
                    title="Use Current Location" 
                    onClick={handleGps}
                    style={{ fontSize: '0.9rem', color: gpsLoading ? 'var(--accent)' : 'inherit' }}
                >
                    {gpsLoading ? '⌛' : '🎯'}
                </button>
            )}
            <button
                className={`pin-toggle-btn ${isActive ? "active" : ""}`}
                title={`Drop ${dotEmoji} pin on map`}
                onClick={onActivate}
            >📍</button>
        </div>
    );
}

// ── New RouteLine Component with Snapping ──
function RouteLine({ rid, coords, isDebug = false }) {
    const [snappedCoords, setSnappedCoords] = useState(coords);

    useEffect(() => {
        // If it's a bus route and we have enough coords, try snapping
        if (!rid.toString().startsWith("M-") && coords.length >= 2) {
            // Only snap debug lines if they are short enough to avoid OSRM rate limits
            if (!isDebug || coords.length < 25) {
                fetchRoadPath(coords).then(setSnappedCoords);
            }
        }
    }, [coords, rid, isDebug]);

    return (
        <Polyline 
            positions={snappedCoords} 
            pathOptions={{ 
                color: rid.toString().startsWith("M-") ? "#7c3aed" : "#00A86B", 
                weight: isDebug ? 2 : 4, 
                opacity: isDebug ? 0.3 : 0.8 
            }} 
        />
    );
}

export default function DualMapPicker({ stops = [], activeIds = new Set(), onOriginSelected, onDestinationSelected, initialOrigin }) {
    const [pinMode, setPinMode] = useState("destination");
    const [originPos, setOriginPos] = useState(null);
    const [destPos, setDestPos] = useState(null);
    const [mapCenter, setMapCenter] = useState(BENGALURU_CENTER);
    const [zoom, setZoom] = useState(12);
    const [showAllRoutes, setShowAllRoutes] = useState(false);
    const [routeLines, setRouteLines] = useState([]);
    const [loadingRoutes, setLoadingRoutes] = useState(false);

    useEffect(() => {
        if (!showAllRoutes) {
            setRouteLines([]);
            return;
        }
        setLoadingRoutes(true);
        const timer = setTimeout(() => {
            const grouped = {};
            routeStopsJson.forEach(rs => {
                if (!grouped[rs.route_id]) grouped[rs.route_id] = [];
                grouped[rs.route_id].push(rs.stop_id);
            });
            const stopMap = {};
            stops.forEach(s => { stopMap[s.id] = [s.latitude, s.longitude]; });
            const lines = Object.keys(grouped).slice(0, 50).map(rid => { // Limit to 50 for safety
                const coords = grouped[rid].map(sid => stopMap[sid]).filter(Boolean);
                return { id: rid, coords };
            }).filter(r => r.coords.length > 1);
            setRouteLines(lines);
            setLoadingRoutes(false);
        }, 100);
        return () => clearTimeout(timer);
    }, [showAllRoutes, stops]);

    useEffect(() => {
        if (initialOrigin && !originPos) {
            const pos = [initialOrigin.lat, initialOrigin.lon];
            setOriginPos(pos);
            setMapCenter(pos);
        }
    }, [initialOrigin]);

    const handleOriginDrop = useCallback((loc) => {
        const pos = [loc.lat, loc.lon];
        setOriginPos(pos);
        setMapCenter(pos);
        onOriginSelected?.(loc);
        setPinMode("destination");
    }, [onOriginSelected]);

    const handleDestDrop = useCallback((loc) => {
        const pos = [loc.lat, loc.lon];
        setDestPos(pos);
        setMapCenter(pos);
        onDestinationSelected?.(loc);
    }, [onDestinationSelected]);

    const visibleStops = stops.filter(s => {
        const isMetro = s.id.toString().startsWith("M-");
        if (isMetro) return true;
        return zoom > 14; 
    });

    return (
        <div className="dual-map-picker">
            <PlaceSearch placeholder="Where from?" dotEmoji="🟢" isActive={pinMode === "origin"} onActivate={() => setPinMode("origin")} onPlace={handleOriginDrop} showGps />
            <PlaceSearch placeholder="Where to?" dotEmoji="🔴" isActive={pinMode === "destination"} onActivate={() => setPinMode("destination")} onPlace={handleDestDrop} />

            <p className="pin-mode-hint">
                {pinMode === "origin" ? "🟢 Select start: Search above or tap map" : "🔴 Select end: Search above or tap map"}
            </p>

            <MapContainer center={BENGALURU_CENTER} zoom={12} style={{ width: "100%", height: "350px", borderRadius: "24px" }} zoomControl>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                <MapCentre center={mapCenter} />
                <MapClickHandler pinMode={pinMode} onOriginDrop={handleOriginDrop} onDestDrop={handleDestDrop} setZoom={setZoom} />

                {showAllRoutes && routeLines.map(rl => (
                    <RouteLine key={rl.id} rid={rl.id} coords={rl.coords} isDebug={true} />
                ))}

                {visibleStops.map((s) => {
                    const isMetro = s.id.toString().startsWith("M-");
                    const isActive = activeIds.has(s.id);
                    return (
                        <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={isMetro ? 6 : 4} pathOptions={{ fillColor: isMetro ? "#7c3aed" : "#2D5F5D", color: "#ffffff", weight: 2, fillOpacity: isActive ? 1 : 0.6 }}>
                            <Popup>
                                <div style={{ fontFamily: 'Satoshi, sans-serif' }}>
                                    <strong style={{ display: 'block', marginBottom: '4px' }}>{s.name}</strong>
                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>{isMetro ? "🚇 Metro Station" : "🚌 Bus Stop"}</span>
                                </div>
                            </Popup>
                        </CircleMarker>
                    );
                })}

                {originPos && <Marker position={originPos} icon={greenIcon} />}
                {destPos && <Marker position={destPos} icon={redIcon} />}
            </MapContainer>

            <div className="map-legend">
                <div className="legend-item"><span className="dot metro"></span> Metro</div>
                <div className="legend-item"><span className="dot bus"></span> Bus (Zoom in)</div>
                <button onClick={() => setShowAllRoutes(!showAllRoutes)} className="debug-toggle-btn" style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', background: showAllRoutes ? 'var(--primary)' : 'var(--bg)', color: showAllRoutes ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    {loadingRoutes ? 'Loading...' : showAllRoutes ? 'Hide Routes' : 'Debug: Road-Follow Routes'}
                </button>
            </div>
        </div>
    );
}
