// routes/news.js  — GET /api/news?q=
const express = require("express");
const https = require("https");
const router = express.Router();

const CURATED = [
    { title: "BMTC adds 200 new electric buses on Outer Ring Road routes", source: "Deccan Herald", date: "2025-01", cat: "BMTC", url: "https://www.deccanherald.com" },
    { title: "Namma Metro Phase 3 construction begins near Hebbal", source: "Times of India", date: "2025-02", cat: "Metro", url: "https://timesofindia.indiatimes.com" },
    { title: "BMTC-Metro integrated ticketing pilot launches at KR Market", source: "The Hindu", date: "2025-01", cat: "Integration", url: "https://www.thehindu.com" },
    { title: "Namma Metro ridership crosses 7 lakh daily during peak season", source: "Bangalore Mirror", date: "2024-12", cat: "Metro", url: "https://bangaloremirror.indiatimes.com" },
    { title: "BMTC introduces real-time tracking for 500 routes via GTFS-RT", source: "Indian Express", date: "2024-11", cat: "BMTC", url: "https://www.indianexpress.com" },
    { title: "Airport Vayu Vajra service adds 10 new routes via Whitefield", source: "Deccan Herald", date: "2025-02", cat: "BMTC", url: "https://www.deccanherald.com" },
];

function fetchRSS(query) {
    return new Promise((resolve) => {
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`)}`;
        const req = https.get(url, { headers: { "User-Agent": "namma-move-api/1.0" } }, (res) => {
            let body = "";
            res.on("data", c => body += c);
            res.on("end", () => {
                try { resolve(JSON.parse(body)); } catch { resolve(null); }
            });
        });
        req.setTimeout(5000, () => { req.destroy(); resolve(null); });
        req.on("error", () => resolve(null));
    });
}

router.get("/", async (req, res) => {
    const q = (req.query.q || "Bangalore BMTC Metro transport").slice(0, 100);
    const data = await fetchRSS(q);

    if (data?.status === "ok" && data.items?.length > 0) {
        const items = data.items.slice(0, 20).map(item => ({
            title: item.title,
            url: item.link,
            source: item.author || item.pubDate?.slice(0, 10),
            date: item.pubDate?.slice(0, 10) || "",
            summary: item.description?.replace(/<[^>]+>/g, "").slice(0, 180) || "",
            cat: item.title.toLowerCase().includes("metro") ? "Metro"
                : item.title.toLowerCase().includes("bmtc") ? "BMTC"
                    : "Update",
            live: true,
        }));
        return res.json({ items, source: "live" });
    }

    res.json({ items: CURATED, source: "curated" });
});

module.exports = router;
