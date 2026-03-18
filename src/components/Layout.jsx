import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import AIAssistant from './AIAssistant';
import ActiveJourney from './ActiveJourney';

export default function Layout({ children, darkMode, setDarkMode, activeJourney, setActiveJourney }) {
    const location = useLocation();
    const [dbStatus, setDbStatus] = useState('checking');

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch('/api/health');
                const data = await res.json();
                setDbStatus(data.status === 'ok' ? 'online' : 'offline');
            } catch {
                setDbStatus('offline');
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    const navItems = [
        { path: '/', label: 'Home', icon: '🏠' },
        { path: '/plan', label: 'Plan', icon: '🗺️' },
        { path: '/wallet', label: 'Wallet', icon: '💳' },
        { path: '/schedules', label: 'Schedules', icon: '🕒' },
        { path: '/news', label: 'News', icon: '📰' }
    ];

    return (
        <div className="app-shell" data-theme={darkMode ? 'dark' : 'light'}>
            <header className="glass-nav">
                <div className="nav-container">
                    <Link to="/" className="brand">
                        <img src="/logo.png" alt="Namma Move" className="logo" />
                        <span className="brand-text">Namma Move</span>
                    </Link>

                    <nav className="desktop-nav">
                        {navItems.map(item => (
                            <Link 
                                key={item.path} 
                                to={item.path} 
                                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="nav-right">
                        <div className={`db-status-badge ${dbStatus}`}>
                            <span className="status-dot"></span>
                            <span className="status-label">{dbStatus === 'online' ? 'DB Online' : 'DB Offline'}</span>
                        </div>
                        <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="main-content">
                {activeJourney && <ActiveJourney journey={activeJourney} onEnd={setActiveJourney} />}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>

            <nav className="mobile-tab-bar">
                {navItems.map(item => (
                    <Link 
                        key={item.path} 
                        to={item.path} 
                        className={`tab-item ${location.pathname === item.path ? 'active' : ''}`}
                    >
                        <span className="tab-icon">{item.icon}</span>
                        <span className="tab-label">{item.label}</span>
                    </Link>
                ))}
            </nav>

            <AIAssistant />
        </div>
    );
}
