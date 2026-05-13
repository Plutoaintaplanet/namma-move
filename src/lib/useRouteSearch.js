import { useState, useCallback } from "react";

function getBaseUrl() {
  const isProd = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
  return isProd ? "/api" : (import.meta.env.VITE_API_URL || "http://localhost:4000/api");
}

export default function useRouteSearch() {
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [allRoutes, setAllRoutes] = useState([]);
  const [cabInfo, setCabInfo] = useState(null);
  const [autoStands, setAutoStands] = useState([]);
  const [rides, setRides] = useState(null);
  const [error, setError] = useState("");

  const search = useCallback(async (origin, dest, timeMode = "now", timeInput = "") => {
    if (!origin || !dest) return;
    setLoading(true);
    setSearched(true);
    setAllRoutes([]);
    setError("");

    let url = `${getBaseUrl()}/route?fromLat=${origin.lat}&fromLon=${origin.lon}&toLat=${dest.lat}&toLon=${dest.lon}`;
    if (timeMode !== "now" && timeInput) url += `&time=${timeInput}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      setAllRoutes(data.routes || []);
      setCabInfo(data.cab || null);
      setAutoStands(data.autoStands || []);
      setRides(data.rides || null);
      if (!data.routes || data.routes.length === 0) setError("No transit routes found.");
    } catch (e) {
      setError(`Routing error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSearched(false);
    setAllRoutes([]);
    setCabInfo(null);
    setAutoStands([]);
    setRides(null);
    setError("");
  }, []);

  return { loading, searched, allRoutes, cabInfo, autoStands, rides, error, search, reset };
}
