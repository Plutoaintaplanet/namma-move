import { useState, useEffect } from "react";

// ── Schedule-based next departure for Metro ────────────────────────────────────
// Metro: every 6–10 min peak, 10–15 min off-peak
function nextMetroDepartures() {
    const now = new Date();
    const open = 5 * 60,   // 05:00
        close = 23 * 60; // 23:00
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < open || mins >= close) return null;
    const isPeak = (mins >= 8 * 60 && mins <= 10 * 60) || (mins >= 17 * 60 && mins <= 20 * 60);
    const freq = isPeak ? 6 : 10;
    const next = freq - (mins % freq);
    return [next, next + freq, next + freq * 2];
}

// ── Schedule-based next departure for BMTC ────────────────────────────────────
// Average BMTC frequency ~12 min peak, 20 min off-peak
function nextBmtcDepartures() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const open = 5 * 60, close = 23 * 60;
    if (mins < open || mins >= close) return null;
    const isPeak = (mins >= 7 * 60 && mins <= 10 * 60) || (mins >= 17 * 60 && mins <= 21 * 60);
    const freq = isPeak ? 12 : 20;
    const next = freq - (mins % freq) || freq;
    return [next, next + freq, next + freq * 2];
}

// ── Try BMTC real-time (attempt, graceful fallback) ───────────────────────────
async function tryFetchLiveBmtc(stopName) {
    // Attempt BMTC open portal – will fail due to CORS in browser, but we try
    try {
        const res = await fetch(
            `https://bmtcwebportal.passos.co.in/bmtc/api/nextbusdetails_v2?stopname=${encodeURIComponent(stopName)}`,
            { signal: AbortSignal.timeout(3000) }
        );
        if (res.ok) {
            const data = await res.json();
            return data; // actual live data
        }
    } catch {
        // CORS / network blocked – fall through to schedule
    }
    return null;
}

export default function LiveStatus({ route, boardingStop, isMetro }) {
    const [departures, setDepartures] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!route) return;
        let cancelled = false;
        setLoading(true);

        const load = async () => {
            if (isMetro) {
                const metro = nextMetroDepartures();
                if (!cancelled) {
                    setDepartures(metro);
                    setIsLive(false);
                    setLoading(false);
                }
                return;
            }

            // Try live BMTC first
            const live = await tryFetchLiveBmtc(boardingStop?.name || "");
            if (cancelled) return;

            if (live && Array.isArray(live.nextBus) && live.nextBus.length > 0) {
                setDepartures(live.nextBus.slice(0, 3).map((b) => parseInt(b.eta || "0", 10)));
                setIsLive(true);
            } else {
                setDepartures(nextBmtcDepartures());
                setIsLive(false);
            }
            setLoading(false);
        };

        load();
        const interval = setInterval(load, 60_000); // refresh every minute
        return () => { cancelled = true; clearInterval(interval); };
    }, [route?.id, boardingStop?.name, isMetro]);

    if (!route || loading) {
        return (
            <div className="live-status-row">
                <span className="live-dot loading" />
                <span className="live-text">Loading departure info…</span>
            </div>
        );
    }

    const now = new Date();
    const isServiceHours = (() => {
        const m = now.getHours() * 60 + now.getMinutes();
        return m >= 5 * 60 && m < 23 * 60;
    })();

    if (!isServiceHours) {
        return (
            <div className="live-status-row">
                <span className="live-dot closed" />
                <span className="live-text">Service ends at 11:00 PM · Opens 5:00 AM</span>
            </div>
        );
    }

    if (!departures) {
        return (
            <div className="live-status-row">
                <span className="live-dot warning" />
                <span className="live-text">Schedule unavailable</span>
            </div>
        );
    }

    return (
        <div className="live-status-wrap">
            <div className="live-status-row">
                <span className={`live-dot ${isLive ? "live" : "sched"}`} />
                <span className="live-label">{isLive ? "Live" : "Schedule"}</span>
                <span className="live-text">Next departures from <strong>{boardingStop?.name || "stop"}</strong>:</span>
            </div>
            <div className="live-chips">
                {departures.map((min, i) => (
                    <span key={i} className={`live-chip ${i === 0 ? "live-chip-first" : ""}`}>
                        {min === 0 ? "Now" : `${min} min`}
                    </span>
                ))}
            </div>
        </div>
    );
}
