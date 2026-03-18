import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SavedLocations({ onSelect, currentOrigin, currentDest }) {
    const [saved, setSaved] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(null); // 'origin' or 'dest'

    useEffect(() => {
        fetchSaved();
    }, []);

    async function fetchSaved() {
        setLoading(true);
        const { data, error } = await supabase
            .from('saved_locations')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error && data) setSaved(data);
        setLoading(false);
    }

    async function saveLocation(loc, type) {
        if (!loc) return;
        setSaving(type);
        const { error } = await supabase
            .from('saved_locations')
            .insert([{
                name: loc.label || 'Saved Location',
                lat: loc.lat,
                lon: loc.lon,
                address: loc.label
            }]);
        
        if (!error) await fetchSaved();
        setSaving(null);
    }

    async function deleteLocation(id) {
        const { error } = await supabase
            .from('saved_locations')
            .delete()
            .eq('id', id);
        
        if (!error) setSaved(saved.filter(s => s.id !== id));
    }

    // Hide entire component if empty and nothing to save
    if (!loading && saved.length === 0 && !currentOrigin && !currentDest) {
        return null;
    }

    return (
        <div className="saved-locations-container">
            <div className="saved-header">
                <span className="saved-title">⭐ Favorite Places</span>
                <div className="save-actions">
                    {currentOrigin && (
                        <button 
                            className={`save-current-btn origin ${saving === 'origin' ? 'loading' : ''}`}
                            onClick={() => saveLocation(currentOrigin, 'origin')}
                            disabled={saving}
                        >
                            {saving === 'origin' ? '...' : '+ Origin'}
                        </button>
                    )}
                    {currentDest && (
                        <button 
                            className={`save-current-btn dest ${saving === 'dest' ? 'loading' : ''}`}
                            onClick={() => saveLocation(currentDest, 'dest')}
                            disabled={saving}
                        >
                            {saving === 'dest' ? '...' : '+ Destination'}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="saved-loading">Loading favorites...</div>
            ) : saved.length === 0 ? (
                <div className="saved-empty">No saved places yet. Pin a location to save it!</div>
            ) : (
                <div className="saved-list">
                    {saved.map(loc => (
                        <div key={loc.id} className="saved-item">
                            <div className="saved-item-info" onClick={() => onSelect(loc)}>
                                <span className="saved-item-icon">📍</span>
                                <div className="saved-item-text">
                                    <div className="saved-item-name">{loc.name.split(',')[0]}</div>
                                    <div className="saved-item-addr">{loc.address?.split(',').slice(1,3).join(',')}</div>
                                </div>
                            </div>
                            <button className="saved-item-del" onClick={() => deleteLocation(loc.id)}>×</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
