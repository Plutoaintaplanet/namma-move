import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import MetroLiveMap from "./pages/MetroLiveMap";
import SchedulesPage from "./SchedulesPage";
import NewsPage from "./NewsPage";
import WalletPage from "./pages/WalletPage";
import { Preloader } from "./components/ui/preloader";

export default function App() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [activeJourney, setActiveJourney] = useState(null);
  const [walletBalance, setWalletBalance] = useState(245.50);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("nm-dark") === "1"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    try { localStorage.setItem("nm-dark", darkMode ? "1" : "0"); } catch { }
  }, [darkMode]);

  return (
    <BrowserRouter>
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      <Layout 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        activeJourney={activeJourney}
        setActiveJourney={setActiveJourney}
      >
        <Routes>
          <Route path="/" element={
            <Landing 
              activeJourney={activeJourney}
              setActiveJourney={setActiveJourney} 
              walletBalance={walletBalance} 
              setWalletBalance={setWalletBalance} 
            />
          } />
          <Route path="/plan" element={<Navigate to="/" replace />} />
          <Route path="/metro-live" element={<MetroLiveMap />} />
          <Route path="/wallet" element={
            <WalletPage balance={walletBalance} setBalance={setWalletBalance} />
          } />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/news" element={<NewsPage darkMode={darkMode} />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
