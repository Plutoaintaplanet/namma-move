async function test() {
    try {
        const r = await fetch("http://localhost:4000/api/route?fromLat=12.9750&fromLon=77.5720&toLat=12.9780&toLon=77.6400");
        console.log("Status:", r.status);
        const data = await r.json();
        if (!data.bus && !data.metro && !data.combo) console.log("NO ROUTES FOUND");
        else console.log("ROUTES FOUND:", {
            bus: data.bus ? data.bus.totalMins : null,
            metro: data.metro ? data.metro.totalMins : null,
            combo: data.combo ? data.combo.totalMins : null
        });
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}
test();
