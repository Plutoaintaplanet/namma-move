import { useEffect, useState, useRef, useCallback } from "react";
import {
    MapContainer, TileLayer, Marker, useMapEvents, useMap, CircleMarker, Popup
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

    // Primary request with proper User-Agent
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

    // Fallback via allorigins CORS proxy
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

function MapClickHandler({ pinMode, onOriginDrop, onDestDrop }) {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            const loc = { lat, lon: lng, label: "Dropped pin" };
            if (pinMode === "origin") onOriginDrop(loc);
            else onDestDrop(loc);
        },
    });
    return null;
}

function MapCentre({ center }) {
    const map = useMap();
    useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
    return null;
}

// ── Autocomplete search input ─────────────────────────────────────────────────
function PlaceSearch({ placeholder, dotEmoji, onPlace, isActive, onActivate }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);
    const wrapRef = useRef(null);

    // Close dropdown when clicking outside
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
            <button
                className={`pin-toggle-btn ${isActive ? "active" : ""}`}
                title={`Drop ${dotEmoji} pin on map`}
                onClick={onActivate}
            >📍</button>
        </div>
    );
}

// ── Main DualMapPicker ────────────────────────────────────────────────────────
export default function DualMapPicker({ stops = [], activeIds = new Set(), onOriginSelected, onDestinationSelected, initialOrigin }) {
    const [pinMode, setPinMode] = useState("destination");
    const [originPos, setOriginPos] = useState(null);
    const [destPos, setDestPos] = useState(null);
    const [mapCenter, setMapCenter] = useState(BENGALURU_CENTER);

    useEffect(() => {
        if (initialOrigin && !originPos) {
            const pos = [initialOrigin.lat, initialOrigin.lon];
            setOriginPos(pos);
            setMapCenter(pos);
        }
    }, [initialOrigin]);

    // FIXED: handleOriginDrop / handleDestDrop used as onPlace callbacks
    // They update map markers AND call parent callbacks (which trigger computeAll).
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

    return (
        <div className="dual-map-picker">
            <PlaceSearch
                placeholder="From — search or pin on map"
                dotEmoji="🟢"
                isActive={pinMode === "origin"}
                onActivate={() => setPinMode("origin")}
                onPlace={handleOriginDrop}
            />
            <PlaceSearch
                placeholder="To — search or pin on map"
                dotEmoji="🔴"
                isActive={pinMode === "destination"}
                onActivate={() => setPinMode("destination")}
                onPlace={handleDestDrop}
            />

            <p className="pin-mode-hint">
                {pinMode === "origin"
                    ? "🟢 Tap the map to set your start point"
                    : "🔴 Tap the map to set your destination"}
            </p>

            <MapContainer
                center={BENGALURU_CENTER}
                zoom={12}
                style={{ width: "100%", height: "320px", borderRadius: "14px" }}
                zoomControl
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapCentre center={mapCenter} />
                <MapClickHandler
                    pinMode={pinMode}
                    onOriginDrop={handleOriginDrop}
                    onDestDrop={handleDestDrop}
                />

                {/* Transit Stops */}
                {stops.map((s) => {
                    const isActive = activeIds.has(s.id);
                    return (
                        <CircleMarker
                            key={s.id}
                            center={[s.latitude, s.longitude]}
                            radius={isActive ? 5 : 3}
                            pathOptions={{
                                fillColor: s.id.toString().startsWith("M-") ? "var(--purple)" : "var(--teal)",
                                color: "var(--bg-surface)",
                                weight: 1,
                                fillOpacity: isActive ? 0.9 : 0.3
                            }}
                        >
                            <Popup>
                                <strong>{s.name}</strong><br />
                                {s.id.toString().startsWith("M-") ? "🚇 Metro Station" : "🚌 Bus Stop"}
                                {!isActive && !s.id.toString().startsWith("M-") && <><br/><em>(Pin only - no route data)</em></>}
                            </Popup>
                        </CircleMarker>
                    );
                })}

                {originPos && <Marker position={originPos} icon={greenIcon} />}
                {destPos && <Marker position={destPos} icon={redIcon} />}
            </MapContainer>
        </div>
    );
}
