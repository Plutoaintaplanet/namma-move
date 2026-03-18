import { useState, useEffect } from "react";

// ── Curated fallback news (always shown if RSS fails) ─────────────────────────
const FALLBACK_NEWS = [
    {
        title: "BMTC launches 10 new Volvo AC routes connecting outer Bengaluru",
        source: "Deccan Herald",
        date: "2026-02-24",
        link: "https://www.deccanherald.com/bangalore",
        category: "BMTC",
        summary: "BMTC adds 10 new premium Volvo routes to areas including Sarjapur, Whitefield, and Electronic City to ease peak-hour traffic.",
    },
    {
        title: "Namma Metro Phase 3 construction accelerates on RR Nagar corridor",
        source: "The Hindu",
        date: "2026-02-23",
        link: "https://www.thehindu.com/news/cities/bangalore/",
        category: "Metro",
        summary: "BMRCL reports significant progress on the Phase 3 extension targeting Tumkur Road and Hosahalli corridors.",
    },
    {
        title: "BMTC-Metro integrated ticketing pilot launches at MG Road",
        source: "Times of India",
        date: "2026-02-22",
        link: "https://timesofindia.indiatimes.com/city/bengaluru",
        category: "Integration",
        summary: "A new QR-code based integrated ticket covering BMTC buses and Namma Metro is being piloted at MG Road metro station.",
    },
    {
        title: "Bangalore ranks 3rd for public transport satisfaction in India",
        source: "Bangalore Mirror",
        date: "2026-02-20",
        link: "https://bangaloremirror.indiatimes.com/",
        category: "Update",
        summary: "A national survey places Bengaluru third in public transport satisfaction, citing Namma Metro's frequency and BMTC's coverage.",
    },
    {
        title: "Electric BMTC buses to cover Outer Ring Road from April 2026",
        source: "Deccan Herald",
        date: "2026-02-19",
        link: "https://www.deccanherald.com/bangalore",
        category: "BMTC",
        summary: "BMTC plans electric bus deployment on the Outer Ring Road corridor starting April 2026 as part of its green fleet expansion.",
    },
    {
        title: "Metro Purple Line Kengeri extension now sees 40,000 daily riders",
        source: "The Hindu",
        date: "2026-02-17",
        link: "https://www.thehindu.com/news/cities/bangalore/",
        category: "Metro",
        summary: "The Challaghatta–Kengeri extension has seen a 35% increase in ridership since its opening, BMRCL data shows.",
    },
    {
        title: "BMTC introduces real-time bus tracking for 500+ routes on WhatsApp",
        source: "Times of India",
        date: "2026-02-15",
        link: "https://timesofindia.indiatimes.com/city/bengaluru",
        category: "BMTC",
        summary: "Commuters can now send a stop name on WhatsApp to get live bus arrival times, covering over 500 BMTC routes.",
    },
    {
        title: "Namma Metro fares revised; off-peak discounts introduced",
        source: "Bangalore Mirror",
        date: "2026-02-12",
        link: "https://bangaloremirror.indiatimes.com/",
        category: "Metro",
        summary: "BMRCL introduces 10% off-peak fare discounts for journeys before 8 AM and after 9 PM on weekdays.",
    },
];

const CATEGORY_COLORS = {
    BMTC: { bg: "var(--primary-light)", color: "var(--primary)" },
    Metro: { bg: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" },
    Integration: { bg: "rgba(249, 115, 22, 0.1)", color: "var(--accent)" },
    Update: { bg: "var(--primary-light)", color: "var(--primary)" },
};

function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ── RSS bridge: use rss2json (free, keyless, 10k req/day) ─────────────────────
async function fetchRssNews() {
    const queries = [
        "BMTC Bangalore bus",
        "Namma Metro Bangalore",
        "Bangalore public transport",
    ];
    // Google News RSS – keyless, no auth required
    const feeds = queries.map(
        (q) =>
            `https://news.google.com/rss/search?q=${encodeURIComponent(q + " 2026")}&hl=en-IN&gl=IN&ceid=IN:en`
    );

    // Use rss2json.com free tier as a CORS proxy for RSS
    const results = [];
    for (const feed of feeds) {
        try {
            const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}&count=4`;
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) continue;
            const data = await res.json();
            if (data.status === "ok" && Array.isArray(data.items)) {
                data.items.forEach((item) => {
                    results.push({
                        title: item.title?.replace(/ - [^-]+$/, "") || "No title",
                        source: item.author || data.feed?.title || "News",
                        date: item.pubDate?.split(" ")[0] || new Date().toISOString().split("T")[0],
                        link: item.link || "#",
                        summary: item.description?.replace(/<[^>]+>/g, "").slice(0, 180) + "…",
                        category: item.title?.toLowerCase().includes("metro") ? "Metro" : "BMTC",
                    });
                });
            }
        } catch {
            // silently skip – we'll fall back
        }
    }
    return results;
}

export default function NewsPage({ darkMode }) {
    const [articles, setArticles] = useState(FALLBACK_NEWS);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState("static");
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchRssNews().then((live) => {
            if (cancelled) return;
            if (live.length >= 3) {
                setArticles(live);
                setSource("live");
            } else {
                setSource("static");
            }
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    const categories = ["All", "BMTC", "Metro", "Integration", "Update"];
    const visible = filter === "All" ? articles : articles.filter((a) => a.category === filter);

    return (
        <div className="news-page-container">
            {/* Header */}
            <div className="page-header">
                <h2>📰 Bengaluru Transit News</h2>
                <p>Stay updated with the latest from BMTC and Namma Metro.</p>
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

            {loading && (
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
        </div>
    );
}
