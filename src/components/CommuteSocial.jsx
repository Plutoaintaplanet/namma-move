import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CommuteSocial({ routeId, routeName, cabFare, transitFare, routeDetails, onStatusUpdate }) {
    const [reports, setReports] = useState({ onTime: 0, delayed: 0, crowded: 0 });
    const [hasStarted, setHasStarted] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState("");
    const [analyzing, setAiAnalyzing] = useState(false);

    useEffect(() => {
        if (!routeId) return;
        fetchReports();
        getAiAnalysis();
    }, [routeId]);

    // Send status up to parent for top-of-card display
    useEffect(() => {
        if (onStatusUpdate) {
            onStatusUpdate({
                aiAnalysis,
                analyzing,
                hasStarted,
                savings: Math.round(cabFare - transitFare)
            });
        }
    }, [aiAnalysis, analyzing, hasStarted, cabFare, transitFare]);

    async function fetchReports() {
        const { data } = await supabase
            .from('trip_reports')
            .select('status')
            .eq('route_id', routeId)
            .gt('created_at', new Date(Date.now() - 3600000).toISOString());
        
        if (data) {
            const counts = data.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, { onTime: 0, delayed: 0, crowded: 0 });
            setReports(counts);
        }
    }

    async function getAiAnalysis() {
        setAiAnalyzing(true);
        try {
            const res = await fetch('/api/assistant/analyze-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routeName, routeDetails, reports })
            });
            const data = await res.json();
            setAiAnalysis(data.analysis);
        } catch (e) {
            setAiAnalysis("Reliable route based on historical data.");
        } finally {
            setAiAnalyzing(false);
        }
    }

    async function reportStatus(status) {
        await supabase.from('trip_reports').insert([{ route_id: routeId, status }]);
        fetchReports();
    }

    async function startTrip() {
        const saved = (cabFare || 0) - (transitFare || 0);
        if (saved > 0) {
            await supabase.from('user_savings').insert([{ amount_saved: saved, co2_saved: 1.2 }]);
            setHasStarted(true);
        }
    }

    return (
        <div className="commute-social">
            <div className="social-actions-row">
                {!hasStarted && (
                    <div className="trip-action-section">
                        <button className="start-trip-btn" onClick={startTrip}>
                            🚀 Start Trip & Save ₹{Math.round(cabFare - transitFare)}
                        </button>
                    </div>
                )}

                <div className="crowd-reports">
                    <span className="section-label">Commuter Reports (Last hour)</span>
                    <div className="report-btns">
                        <button onClick={() => reportStatus('onTime')}><span>✅</span> {reports.onTime}</button>
                        <button onClick={() => reportStatus('delayed')}><span>🕒</span> {reports.delayed}</button>
                        <button onClick={() => reportStatus('crowded')}><span>👨‍👨‍👦</span> {reports.crowded}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
