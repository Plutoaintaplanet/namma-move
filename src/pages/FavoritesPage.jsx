import SavedLocations from "../components/SavedLocations";

export default function FavoritesPage() {
    return (
        <div className="favorites-page">
            <div className="page-header">
                <h2>⭐ My Saved Places</h2>
                <p>Quick access to your home, work, and frequent spots.</p>
            </div>
            
            <div className="glass-card">
                <SavedLocations onSelect={(loc) => {
                    window.location.href = `/plan?lat=${loc.lat}&lon=${loc.lon}&label=${encodeURIComponent(loc.name)}`;
                }} />
            </div>
        </div>
    );
}
