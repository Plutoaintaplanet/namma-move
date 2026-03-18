const express = require("express");
const router = express.Router();

/**
 * NAMMA AI KNOWLEDGE BASE (KB)
 * Simulating a trained model with intent-based weighted matching.
 * Covers: Fares, Metro, Bus, Passes, Night Travel, Safety, Connectivity, etc.
 */
const knowledgeBase = [
    {
        intent: "fares",
        patterns: ["fare", "cost", "price", "ticket", "charge", "how much"],
        responses: [
            "BMTC non-AC bus fares start at ₹5 (Stage 1) and go up to ₹25. AC Volvo (Vajra) starts at ₹10.",
            "Namma Metro fares range from ₹10 to ₹60 depending on the distance. Using a Smart Card gives you a 5% discount!",
            "For long commutes, a BMTC Daily Pass at ₹70 is usually the most economical choice."
        ]
    },
    {
        intent: "passes",
        patterns: ["pass", "daily pass", "monthly pass", "smart card", "student pass"],
        responses: [
            "BMTC Daily Pass: ₹70 (Non-AC), ₹150 (AC). You can buy them directly from the conductor with an ID proof (Aadhaar/DL).",
            "Monthly BMTC passes require a 'Bus Pass ID Card' which you can get at major bus stations like Majestic, Shivajinagar, or Shanthinagar.",
            "Metro Smart Cards cost ₹50 (refundable deposit) and can be topped up online or at any station kiosk."
        ]
    },
    {
        intent: "metro_timings",
        patterns: ["metro time", "last train", "first train", "metro sunday", "frequency"],
        responses: [
            "Purple & Green Line: First train starts at 5:00 AM (Mon-Sat) and 7:00 AM (Sun).",
            "Last Metro usually departs at 11:00 PM from terminal stations (Majestic, Whitefield, Silk Institute).",
            "During peak hours (8 AM - 11 AM), Metro frequency is every 3-5 minutes. Off-peak is 8-10 minutes."
        ]
    },
    {
        intent: "night_travel",
        patterns: ["night", "late night", "midnight", "after 11", "24 hours"],
        responses: [
            "Bengaluru does not have 24/7 public transit. Metro ends at 11:00 PM. BMTC night services (G-prefix) are very limited.",
            "For travel after midnight, Rapido or Ola/Uber are your best bets. Stay near 'Majestic' for the highest chance of finding a night bus.",
            "Safety Tip: If traveling late, use the Metro until 11 PM and then switch to a verified cab/auto service."
        ]
    },
    {
        intent: "safety",
        patterns: ["safe", "women", "emergency", "police", "help", "danger"],
        responses: [
            "Namma Metro is highly secure with CCTV and security personnel at every station. Every train has a dedicated women's coach (the first one).",
            "For emergencies, call 112 (Namma 112) or use the 'Suraksha' app by Bengaluru Police.",
            "BMTC buses are generally safe, but avoid empty buses late at night. Stick to well-lit bus stands like Corporation or MG Road."
        ]
    },
    {
        intent: "connectivity",
        patterns: ["auto", "last mile", "walk", "reach", "connectivity", "cycle"],
        responses: [
            "Most Metro stations now have 'Metro Feeder' buses (MF series). Check for them at the station exit.",
            "Use the 'Auto' tab in our app to find the nearest official auto-stands. Metered autos start at ₹30.",
            "Yulu electric bikes are available at almost all major Metro stations for easy last-mile connectivity."
        ]
    },
    {
        intent: "lost_found",
        patterns: ["lost", "forgot", "bag", "item", "complaint", "left behind"],
        responses: [
            "Metro: Visit the 'Customer Care' desk at the station where you got off, or the Majestic terminal Lost & Found center.",
            "BMTC: Contact the specific Depot manager. You'll need the Bus Number (e.g., KA-01-F-1234) and the time of travel.",
            "You can also call the BMTC Helpline at 080-22483777."
        ]
    },
    {
        intent: "app_help",
        patterns: ["how to", "app", "work", "neo4j", "calculate", "social"],
        responses: [
            "I use a Neo4j Graph Database to find the most efficient paths between 2,500+ Bengaluru stops in milliseconds!",
            "Click 'Start Trip' on a route to track your CO2 and money savings. I'll save it to your Supabase profile.",
            "Check the '🤖 AI Analysis' on any route card for my smart take on current traffic and crowd conditions."
        ]
    },
    {
        intent: "majestic",
        patterns: ["majestic", "kbs", "railway station", "sbc", "central"],
        responses: [
            "Majestic (KBS) is the heart of Bengaluru transit. Platform 1-10 are for long-distance, 11-20 for city buses.",
            "The 'Nadaprabhu Kempegowda Station' at Majestic is the interchange for both Purple and Green Metro lines.",
            "Pro-tip: Walking from the Railway Station to the Bus Stand takes about 10 minutes via the skybridge."
        ]
    },
    {
        intent: "airport",
        patterns: ["airport", "kia", "kempegowda airport", "vayu vajra", "bia"],
        responses: [
            "BMTC 'Vayu Vajra' (KIA-series) buses are the best way to reach the airport. They run 24/7 from all major areas.",
            "Tickets for Vayu Vajra cost between ₹200-₹350. They are fully air-conditioned and have luggage racks.",
            "Avoid taking an auto to the airport; it's too far and expensive. Stick to KIA buses or Airport Cabs."
        ]
    }
];

// Helper to find the best response based on keyword weights
function getSmartReply(userMessage) {
    const msg = userMessage.toLowerCase();
    let bestMatch = { intent: null, score: 0 };

    knowledgeBase.forEach(kb => {
        let score = 0;
        kb.patterns.forEach(p => {
            if (msg.includes(p)) score += 1;
        });
        if (score > bestMatch.score) {
            bestMatch = { intent: kb.intent, score, responses: kb.responses };
        }
    });

    if (bestMatch.score > 0) {
        // Return a random response from the matching intent's list
        return bestMatch.responses[Math.floor(Math.random() * bestMatch.responses.length)];
    }

    return "I'm not quite sure about that specific detail, but I'm learning! Ask me about Metro timings, Bus passes, or how to reach the Airport.";
}

// 1. Analyze specific route
router.post("/analyze-route", (req, res) => {
    const { routeName, routeDetails, reports } = req.body;
    
    let analysis = `AI Insights for ${routeName}: `;
    
    const isMetro = routeName?.toLowerCase().includes("metro") || routeDetails?.legs?.some(l => l.mode === 'metro');
    const crowdFactor = reports?.crowded || 0;
    const delayFactor = reports?.delayed || 0;

    if (isMetro) {
        analysis += "This is a high-reliability path. Metro bypasses the notorious traffic at Tin Factory and Goraguntepalya. ";
    } else {
        analysis += "This bus route is great for door-to-door access. Note: Outer Ring Road segments are prone to unpredictable delays near Marathahalli. ";
    }

    if (crowdFactor > 2) {
        analysis += "📊 Peak load detected. If you have a choice, wait 10 mins for a less crowded vehicle.";
    } else if (delayFactor > 1) {
        analysis += "⏳ Commuters report a slow-down. I recommend starting 10 minutes earlier.";
    } else {
        analysis += "✨ Smooth sailing! No significant delays or crowding reported in the last hour.";
    }

    res.json({ analysis });
});

// 2. General AI Chat Assistant (Powered by KB)
router.post("/chat", (req, res) => {
    const { message } = req.body;
    const reply = getSmartReply(message);
    res.json({ reply });
});

module.exports = router;
