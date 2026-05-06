import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function ActiveJourney({ journey, onEnd }) {
    const [currentPos, setCurrentPos] = useState(null);

    const [phase, setPhase] = useState(0); // 0: walk origin, 1: transit, 2: walk dest

    // Calculate distance in meters using Haversine formula
    const getDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
        const R = 6371e3;
        const p1 = lat1 * Math.PI/180;
        const p2 = lat2 * Math.PI/180;
        const dp = (lat2-lat1) * Math.PI/180;
        const dl = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    useEffect(() => {
        if (!journey) return;

        // START HIGH-ACCURACY GPS ONLY DURING JOURNEY
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setCurrentPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            },
            (err) => console.error("GPS Error:", err),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [journey]);

    // Auto-advance logic
    useEffect(() => {
        if (!currentPos || !journey) return;

        if (phase === 0) {
            const dist = getDistance(currentPos.lat, currentPos.lon, journey.route.oStop.lat, journey.route.oStop.lon);
            if (dist < 100) setPhase(1); // Auto-advance to Transit when within 100m of origin stop
        } else if (phase === 1) {
            const dist = getDistance(currentPos.lat, currentPos.lon, journey.route.dStop.lat, journey.route.dStop.lon);
            if (dist < 100) setPhase(2); // Auto-advance to Walk Dest when within 100m of dest stop
        }
    }, [currentPos, phase, journey]);

    if (!journey) return null;

    const phases = [
        { title: `Walk to ${journey.route.oStop.name}`, width: '20%' },
        { title: `Transit Ride`, width: '60%' },
        { title: `Walk to ${journey.route.dStop.name}`, width: '100%' }
    ];

    const currentPhase = phases[phase];

    const getGoogleMapsUrl = () => {
        if (phase === 0) {
            return `https://www.google.com/maps/dir/?api=1&destination=${journey.route.oStop.lat},${journey.route.oStop.lon}&travelmode=walking`;
        } else if (phase === 2) {
            return `https://www.google.com/maps/dir/?api=1&destination=${journey.route.dStop.lat},${journey.route.dStop.lon}&travelmode=walking`;
        }
        return null;
    };

    return (
        <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="active-journey-overlay"
        >
            <div className="journey-status-bar">
                <div className="status-left">
                    <span className="live-dot"></span>
                    <strong>Live Journey</strong>
                    <span className="gps-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img src="/gps_indicator.png" alt="GPS" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                        High-Accuracy GPS Active
                    </span>
                </div>
                <button className="end-trip-btn" onClick={() => {
                    if (window.confirm("End this journey?")) onEnd(null);
                }}>End Trip</button>
            </div>

            <div className="journey-summary-row">
                <div className="summary-item">
                    <span>Started</span>
                    <strong>{journey.startTime}</strong>
                </div>
                <div className="summary-item">
                    <span>Arriving</span>
                    <strong>{journey.route.arrive}</strong>
                </div>
                <div className="summary-item">
                    <span>Tickets</span>
                    <strong>{journey.tickets.length} Active</strong>
                </div>
            </div>

            <div className="active-tickets-container">
                <span className="section-label">Your Digital Tickets</span>
                <div className="ticket-scroll">
                    {journey.tickets.map((ticket, i) => (
                        <div key={i} className="mini-ticket">
                            <div className="mini-ticket-header">
                                <span>{ticket.mode === 'metro' ? '🚇 Metro' : '🚌 Bus'}</span>
                                <strong>{ticket.id}</strong>
                            </div>
                            <div className="mini-ticket-body">
                                <div className="simulated-qr">
                                    {/* Using a simple styled div to simulate a QR */}
                                    <div className="qr-box"></div>
                                </div>
                                <div className="ticket-route-info">
                                    <strong>{ticket.routeName}</strong>
                                    <span>Scan at Gate/Conductor</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="journey-progress">
                <div className="progress-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p className="progress-hint" style={{ margin: 0, fontWeight: 'bold' }}>{currentPhase.title}</p>
                    {phase < 2 && (
                        <button onClick={() => setPhase(p => p + 1)} style={{ background: 'none', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text)' }}>
                            Next Step ⏭️
                        </button>
                    )}
                </div>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: currentPhase.width }}></div>
                </div>
                
                {(phase === 0 || phase === 2) && (
                    <a 
                        href={getGoogleMapsUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{ display: 'block', textAlign: 'center', marginTop: '1rem', padding: '0.75rem', borderRadius: '12px', textDecoration: 'none' }}
                    >
                        🗺️ Start Navigation
                    </a>
                )}
            </div>
        </motion.div>
    );
}
