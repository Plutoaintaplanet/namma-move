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
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const navItems = [
        { path: '/', label: 'Explore', icon: '🔍' },
        { path: '/wallet', label: 'Wallet', icon: '💳' },
        { path: '/news', label: 'Updates', icon: '📰' }
    ];

    const isHome = location.pathname === '/' || location.pathname === '/plan';

    return (
        <div className="app-shell" data-theme={darkMode ? 'dark' : 'light'}>
            <header className={`glass-nav ${isHome ? 'nav-over-map' : ''}`}>
                <div className="nav-container">
                    <div className="brand" style={{ cursor: 'pointer' }}>
                        <img src="/logo.png" alt="Namma Move" className="logo" onClick={() => window.location.href = '/'} />
                        <span className="brand-text">
                            <span onClick={() => window.location.href = '/'}>Namma </span>
                            <span onClick={() => window.location.href = '/metro-live'}>M</span>
                            <span onClick={() => window.location.href = '/'}>ove</span>
                        </span>
                    </div>

                    <nav className="desktop-nav">
                        {navItems.map(item => (
                            <Link 
                                key={item.path} 
                                to={item.path} 
                                className={`nav-link ${location.pathname === item.path || (item.path === '/' && location.pathname === '/plan') ? 'active' : ''}`}
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

            <main className={`main-content ${isHome ? 'main-map' : ''}`}>
                {activeJourney && <ActiveJourney journey={activeJourney} onEnd={setActiveJourney} />}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={isHome ? { height: '100%' } : {}}
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
                        className={`tab-item ${location.pathname === item.path || (item.path === '/' && location.pathname === '/plan') ? 'active' : ''}`}
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
