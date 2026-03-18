import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function ActiveJourney({ journey, onEnd }) {
    const [currentPos, setCurrentPos] = useState(null);

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

    if (!journey) return null;

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
                    <span className="gps-indicator">🛰️ High-Accuracy GPS Active</span>
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
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: '35%' }}></div>
                </div>
                <p className="progress-hint">You are currently walking to {journey.route.oStop.name}</p>
            </div>
        </motion.div>
    );
}
