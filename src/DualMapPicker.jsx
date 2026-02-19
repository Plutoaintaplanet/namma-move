import { useState, useEffect, useRef, useCallback } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    useMapEvents,
    useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Fix Leaflet's broken default icon paths in Vite ──────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Custom coloured icons ────────────────────────────────────────────────────
const greenIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const redIcon = new L.Icon({
    iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const BENGALURU_CENTER = [12.9716, 77.5946];

// ── Nominatim geocode search (free OpenStreetMap) ────────────────────────────
async function nominatimSearch(query) {
    if (!query || query.length < 3) return [];
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query + ", Bangalore, India"
    )}&format=json&limit=5&addressdetails=1`;
    const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
    });
    return res.ok ? await res.json() : [];
}

// ── Sub-component: listens to map clicks ─────────────────────────────────────
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

// ── Sub-component: re-centers map when center changes ────────────────────────
function MapCentre({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

// ── Autocomplete input ────────────────────────────────────────────────────────
function PlaceSearch({ placeholder, dotEmoji, onPlace, isActive, onActivate }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);

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
        }, 400);
    };

    const handleSelect = (item) => {
        setQuery(item.display_name.split(",")[0]);
        setResults([]);
        onPlace({
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            label: item.display_name,
        });
    };

    return (
        <div className="dual-input-row" style={{ position: "relative" }}>
            <span className="pin-dot">{dotEmoji}</span>
            <div style={{ flex: 1, position: "relative" }}>
                <input
                    type="text"
                    value={query}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="map-search-input"
                />
                {loading && (
                    <span className="nominatim-loading">Searching…</span>
                )}
                {results.length > 0 && (
                    <ul className="nominatim-results">
                        {results.map((r) => (
                            <li key={r.place_id} onClick={() => handleSelect(r)}>
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
            >
                📍
            </button>
        </div>
    );
}

// ── Main DualMapPicker ────────────────────────────────────────────────────────
export default function DualMapPicker({
    onOriginSelected,
    onDestinationSelected,
    initialOrigin,
}) {
    const [pinMode, setPinMode] = useState("destination");
    const [originPos, setOriginPos] = useState(null);   // [lat, lng]
    const [destPos, setDestPos] = useState(null);       // [lat, lng]
    const [mapCenter, setMapCenter] = useState(BENGALURU_CENTER);

    // Pre-fill origin from GPS
    useEffect(() => {
        if (initialOrigin && !originPos) {
            const pos = [initialOrigin.lat, initialOrigin.lon];
            setOriginPos(pos);
            setMapCenter(pos);
        }
    }, [initialOrigin]);

    const handleOriginDrop = useCallback((loc) => {
        setOriginPos([loc.lat, loc.lon]);
        setMapCenter([loc.lat, loc.lon]);
        onOriginSelected?.(loc);
        setPinMode("destination"); // auto-switch after placing origin
    }, [onOriginSelected]);

    const handleDestDrop = useCallback((loc) => {
        setDestPos([loc.lat, loc.lon]);
        setMapCenter([loc.lat, loc.lon]);
        onDestinationSelected?.(loc);
    }, [onDestinationSelected]);

    return (
        <div className="dual-map-picker">
            {/* From */}
            <PlaceSearch
                placeholder="From — search or pin on map"
                dotEmoji="🟢"
                isActive={pinMode === "origin"}
                onActivate={() => setPinMode("origin")}
                onPlace={handleOriginDrop}
            />

            {/* To */}
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

            {/* Leaflet map */}
            <MapContainer
                center={BENGALURU_CENTER}
                zoom={12}
                style={{ width: "100%", height: "320px", borderRadius: "14px" }}
                zoomControl={true}
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
                {originPos && <Marker position={originPos} icon={greenIcon} />}
                {destPos && <Marker position={destPos} icon={redIcon} />}
            </MapContainer>
        </div>
    );
}
