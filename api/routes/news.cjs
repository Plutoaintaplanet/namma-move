// routes/news.js  — GET /api/news?q=
const express = require("express");
const https = require("https");
const router = express.Router();

const CURATED = [
    { title: "BMTC launches 10 new Volvo AC routes connecting outer Bengaluru", source: "Deccan Herald", date: "2026-03-15", cat: "BMTC", url: "https://www.deccanherald.com/bangalore" },
    { title: "Namma Metro Phase 3 construction accelerates on RR Nagar corridor", source: "The Hindu", date: "2026-03-14", cat: "Metro", url: "https://www.thehindu.com/news/cities/bangalore/" },
    { title: "BMTC-Metro integrated ticketing pilot launches at MG Road", source: "Times of India", date: "2026-03-12", cat: "Integration", url: "https://timesofindia.indiatimes.com/city/bengaluru" },
    { title: "Bangalore ranks 3rd for public transport satisfaction in India", source: "Bangalore Mirror", date: "2026-03-10", cat: "Update", url: "https://bangaloremirror.indiatimes.com/" },
    { title: "Electric BMTC buses to cover Outer Ring Road from April 2026", source: "Deccan Herald", date: "2026-03-08", cat: "BMTC", url: "https://www.deccanherald.com/bangalore" },
    { title: "Metro Purple Line Kengeri extension now sees 40,000 daily riders", source: "The Hindu", date: "2026-03-05", cat: "Metro", url: "https://www.thehindu.com/news/cities/bangalore/" },
    { title: "BMTC introduces real-time bus tracking for 500+ routes on WhatsApp", source: "Times of India", date: "2026-03-02", cat: "BMTC", url: "https://timesofindia.indiatimes.com/city/bengaluru" },
];

async function fetchRSS(query) {
    return new Promise((resolve) => {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const req = https.get(url, { headers: { "User-Agent": "namma-move-api/1.0" } }, (res) => {
            let body = "";
            res.on("data", c => body += c);
            res.on("end", () => {
                try { 
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } catch { 
                    resolve(null); 
                }
            });
        });
        req.setTimeout(6000, () => { req.destroy(); resolve(null); });
        req.on("error", () => resolve(null));
    });
}

router.get("/", async (req, res) => {
    const queries = [
        "Bangalore BMTC bus news",
        "Namma Metro Bangalore news",
        "Bangalore transport updates"
    ];

    try {
        // Fetch from multiple queries to ensure variety
        const results = await Promise.all(queries.map(q => fetchRSS(q)));
        
        let allItems = [];
        results.forEach(data => {
            if (data?.status === "ok" && data.items?.length > 0) {
                const items = data.items.map(item => ({
                    title: item.title.replace(/ - [^-]+$/, ""),
                    url: item.link,
                    source: item.author || (item.pubDate ? new URL(item.link).hostname.replace("www.", "") : "News"),
                    date: item.pubDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                    summary: item.description?.replace(/<[^>]+>/g, "").slice(0, 180) || "",
                    cat: item.title.toLowerCase().includes("metro") ? "Metro"
                        : item.title.toLowerCase().includes("bmtc") ? "BMTC"
                        : "Update",
                    live: true,
                }));
                allItems = [...allItems, ...items];
            }
        });

        if (allItems.length > 0) {
            // Deduplicate by title
            const uniqueItems = Array.from(new Map(allItems.map(item => [item.title, item])).values());
            // Sort by date descending
            uniqueItems.sort((a, b) => new Date(b.date) - new Date(a.date));
            return res.json({ items: uniqueItems.slice(0, 25), source: "live" });
        }
    } catch (err) {
        console.error("News fetch error:", err);
    }

    res.json({ items: CURATED, source: "curated" });
});

module.exports = router;
