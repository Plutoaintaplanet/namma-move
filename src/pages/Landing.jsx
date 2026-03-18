import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Landing() {
    return (
        <div className="landing-page">
            <section className="hero-section">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hero-content"
                >
                    <span className="hero-badge">🚀 Better Transit for Bengaluru</span>
                    <h1 className="hero-title">Move Faster, <br/>Save Smarter.</h1>
                    <p className="hero-subtitle">
                        Bengaluru's first community-driven transit app. Smart routing, 
                        live crowdsourced status, and savings tracking.
                    </p>
                    <div className="hero-actions">
                        <Link to="/plan" className="btn-primary">Plan a Trip 🗺️</Link>
                        <Link to="/news" className="btn-secondary">Check News 📰</Link>
                    </div>
                </motion.div>

                <div className="hero-stats">
                    <div className="stat-card">
                        <span className="stat-val">2.5k+</span>
                        <span className="stat-label">Bus Stops</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-val">65+</span>
                        <span className="stat-label">Metro Stations</span>
                    </div>
                    <div className="stat-card highlight">
                        <span className="stat-val">₹70</span>
                        <span className="stat-label">Daily Pass Hint</span>
                    </div>
                </div>
            </section>

            <section className="features-grid">
                <div className="feature-card">
                    <span className="feature-icon">🔍</span>
                    <h3>Smart Routing</h3>
                    <p>Optimized Bus + Metro combinations tailored for your commute.</p>
                </div>
                <div className="feature-card">
                    <span className="feature-icon">💬</span>
                    <h3>Route Chat</h3>
                    <p>Chat with fellow commuters on your specific bus or metro route.</p>
                </div>
                <div className="feature-card">
                    <span className="feature-icon">🌱</span>
                    <h3>Save CO2</h3>
                    <p>Track your environmental impact every time you choose transit.</p>
                </div>
            </section>
        </div>
    );
}
