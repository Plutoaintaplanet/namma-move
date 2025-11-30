import { useRef, useState } from "react";
import {
  GoogleMap,
  Marker,
  Autocomplete,
  useLoadScript,
} from "@react-google-maps/api";

const MAP_LIBRARIES = ["places"]; // keep static to avoid warnings

const mapContainerStyle = {
  width: "100%",
  height: "320px",
  borderRadius: "12px",
  overflow: "hidden",
};

const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bengaluru

export default function MapPicker({ onLocationSelected }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const autocompleteRef = useRef(null);
  const [markerPos, setMarkerPos] = useState(defaultCenter);

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setMarkerPos({ lat, lng });
    onLocationSelected?.({
      lat,
      lon: lng,
      label: "Dropped pin",
    });
  };

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place || !place.geometry) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();

    setMarkerPos({ lat, lng });
    onLocationSelected?.({
      lat,
      lon: lng,
      label: place.formatted_address || place.name,
    });
  };

  if (loadError) return <p>Failed to load Google Maps</p>;
  if (!isLoaded) return <p>Loading map…</p>;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 8 }}>
        <Autocomplete
          onLoad={(ac) => (autocompleteRef.current = ac)}
          onPlaceChanged={onPlaceChanged}
        >
          <input
            type="text"
            placeholder="Search destination"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />
        </Autocomplete>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={12}
        center={markerPos}
        onClick={handleMapClick}
      >
        <Marker position={markerPos} />
      </GoogleMap>
    </div>
  );
}
