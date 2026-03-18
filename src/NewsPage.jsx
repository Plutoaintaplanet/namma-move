import { useState, useEffect, useCallback } from "react";

// ── Curated fallback news (shown if API fails) ───────────────────────────────
const FALLBACK_NEWS = [
    {
        title: "BMTC launches 10 new Volvo AC routes connecting outer Bengaluru",
        source: "Deccan Herald",
        date: "2026-03-15",
        link: "https://www.deccanherald.com/bangalore",
        category: "BMTC",
        summary: "BMTC adds 10 new premium Volvo routes to areas including Sarjapur, Whitefield, and Electronic City to ease peak-hour traffic.",
    },
    {
        title: "Namma Metro Phase 3 construction accelerates on RR Nagar corridor",
        source: "The Hindu",
        date: "2026-03-14",
        link: "https://www.thehindu.com/news/cities/bangalore/",
        category: "Metro",
        summary: "BMRCL reports significant progress on the Phase 3 extension targeting Tumkur Road and Hosahalli corridors.",
    },
    {
        title: "BMTC-Metro integrated ticketing pilot launches at MG Road",
        source: "Times of India",
        date: "2026-03-12",
        link: "https://timesofindia.indiatimes.com/city/bengaluru",
        category: "Integration",
        summary: "A new QR-code based integrated ticket covering BMTC buses and Namma Metro is being piloted at MG Road metro station.",
    },
    {
        title: "Bangalore ranks 3rd for public transport satisfaction in India",
        source: "Bangalore Mirror",
        date: "2026-03-10",
        link: "https://bangaloremirror.indiatimes.com/",
        category: "Update",
        summary: "A national survey places Bengaluru third in public transport satisfaction, citing Namma Metro's frequency and BMTC's coverage.",
    },
    {
        title: "Electric BMTC buses to cover Outer Ring Road from April 2026",
        source: "Deccan Herald",
        date: "2026-03-08",
        link: "https://www.deccanherald.com/bangalore",
        category: "BMTC",
        summary: "BMTC plans electric bus deployment on the Outer Ring Road corridor starting April 2026 as part of its green fleet expansion.",
    },
];

const CATEGORY_COLORS = {
    BMTC: { bg: "rgba(0, 168, 168, 0.1)", color: "var(--primary)" },
    Metro: { bg: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" },
    Integration: { bg: "rgba(249, 115, 22, 0.1)", color: "var(--accent)" },
    Update: { bg: "rgba(0, 168, 168, 0.1)", color: "var(--primary)" },
};

function timeAgo(dateStr) {
    try {
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (isNaN(diff)) return "Recently";
        if (diff < 3600) return `${Math.floor(Math.max(1, diff / 60))}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    } catch {
        return "Recently";
    }
}

export default function NewsPage({ darkMode }) {
    const [articles, setArticles] = useState(FALLBACK_NEWS);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState("static");
    const [filter, setFilter] = useState("All");

    const getBaseUrl = () => {
        const isProd = window.location.hostname !== "localhost";
        return isProd ? "/api" : (import.meta.env.VITE_API_URL || "http://localhost:4000/api");
    };

    const loadNews = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBaseUrl()}/news`, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                const formatted = data.items.map(item => ({
                    title: item.title,
                    source: item.source,
                    date: item.date,
                    link: item.url,
                    summary: item.summary,
                    category: item.cat || "Update"
                }));
                setArticles(formatted);
                setSource(data.source || "live");
            }
        } catch (err) {
            console.error("News load error:", err);
            setSource("fallback");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadNews();
    }, [loadNews]);

    const categories = ["All", "BMTC", "Metro", "Integration", "Update"];
    const visible = filter === "All" ? articles : articles.filter((a) => a.category === filter);

    return (
        <div className="news-page-container">
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>📰 Bengaluru Transit News</h2>
                    <p>Stay updated with the latest from BMTC and Namma Metro.</p>
                </div>
                <button 
                    className={`refresh-btn ${loading ? 'loading' : ''}`} 
                    onClick={loadNews}
                    disabled={loading}
                    title="Refresh News"
                >
                    {loading ? "⌛" : "🔄"}
                </button>
            </div>

            {/* Category filter pills */}
            <div className="news-filters">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        className={`news-filter-btn ${filter === cat ? "active" : ""}`}
                        onClick={() => setFilter(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {loading && articles === FALLBACK_NEWS && (
                <div className="news-loading">
                    <div className="news-spinner" />
                    <span>Fetching latest news…</span>
                </div>
            )}

            {/* News cards */}
            <div className="news-grid">
                {visible.map((article, idx) => {
                    const catStyle = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.Update;
                    return (
                        <a
                            key={idx}
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="news-card"
                        >
                            <div className="news-card-top">
                                <span
                                    className="news-cat-badge"
                                    style={{ background: catStyle.bg, color: catStyle.color }}
                                >
                                    {article.category}
                                </span>
                                <span className="news-date">{timeAgo(article.date)}</span>
                            </div>
                            <h3 className="news-card-title">{article.title}</h3>
                            {article.summary && (
                                <p className="news-card-summary">{article.summary}</p>
                            )}
                            <div className="news-card-footer">
                                <span className="news-source">📡 {article.source}</span>
                                <span className="news-read-more">Read →</span>
                            </div>
                        </a>
                    );
                })}
            </div>

            {visible.length === 0 && !loading && (
                <p className="no-news-msg">No news found for this category.</p>
            )}

            <div className="news-footer-info">
                <span>Source: {source === 'live' ? 'Live RSS Feed' : 'Curated Updates'}</span>
                {source === 'live' && <span> • Updated real-time</span>}
            </div>
        </div>
    );
}
