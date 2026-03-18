import { useState } from 'react';
import { motion } from 'framer-motion';

export default function WalletPage({ balance, setBalance }) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const refreshBalance = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setBalance(prev => prev); // Simulate fetch
            setIsRefreshing(false);
        }, 1500);
    };

    return (
        <div className="wallet-page">
            <div className="page-header">
                <h2>🎫 Unified Transit Pass</h2>
                <p>Manage your physical NCMC card and digital tickets.</p>
            </div>

            {/* Virtual NCMC Card */}
            <motion.div 
                initial={{ rotateY: -10, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                className="ncmc-card-container"
            >
                <div className="ncmc-card">
                    <div className="card-top">
                        <div className="card-chip"></div>
                        <span className="ncmc-logo">NCMC</span>
                    </div>
                    <div className="card-middle">
                        <span className="balance-label">Available Balance</span>
                        <h2 className="card-balance">₹{balance.toFixed(2)}</h2>
                    </div>
                    <div className="card-bottom">
                        <div className="card-user">
                            <span className="user-label">CARD HOLDER</span>
                            <span className="user-name">Bengaluru Commuter</span>
                        </div>
                        <div className="card-number">
                            <span>•••• 5678</span>
                        </div>
                        <div className="nfc-icon">📡</div>
                    </div>
                </div>
            </motion.div>

            <div className="wallet-actions">
                <button className="action-btn main" onClick={refreshBalance}>
                    {isRefreshing ? "Syncing..." : "🔄 Refresh Balance"}
                </button>
                <div className="action-grid">
                    <button className="action-btn">🚇 Buy Metro QR</button>
                    <button className="action-btn">🚌 Daily Bus Pass</button>
                    <button className="action-btn">🕒 View History</button>
                    <button className="action-btn">➕ Top Up Card</button>
                </div>
            </div>

            <section className="recent-activity">
                <h3 className="section-title">Recent Activity</h3>
                <div className="activity-list">
                    <ActivityItem 
                        icon="🚇" 
                        title="Metro: Indiranagar to Majestic" 
                        date="Today, 08:45 AM" 
                        amount="-₹28.50" 
                    />
                    <ActivityItem 
                        icon="🚌" 
                        title="Bus: Route 500-D (Marathahalli)" 
                        date="Yesterday, 06:15 PM" 
                        amount="-₹20.00" 
                    />
                    <ActivityItem 
                        icon="💰" 
                        title="Card Top-up: UPI" 
                        date="22 Mar, 10:00 AM" 
                        amount="+₹500.00" 
                        isPositive 
                    />
                </div>
            </section>
        </div>
    );
}

function ActivityItem({ icon, title, date, amount, isPositive }) {
    return (
        <div className="activity-item">
            <span className="activity-icon">{icon}</span>
            <div className="activity-info">
                <span className="activity-title">{title}</span>
                <span className="activity-date">{date}</span>
            </div>
            <span className={`activity-amount ${isPositive ? 'positive' : ''}`}>{amount}</span>
        </div>
    );
}
