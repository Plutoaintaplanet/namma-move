// This script tests the online API.
// NOTE: This script will fail if the Vercel deployment has authentication enabled.
// The API returns an error: "The client is unauthorized due to authentication failure."
// This is a Vercel setting and cannot be fixed in the code.
(async () => {
    const fetch = (await import('node-fetch')).default;

    fetch("https://namma-move.vercel.app/api/route?fromLat=12.9718591&fromLon=77.5956698&toLat=12.9624669&toLon=77.6381958")
        .then(r => r.json())
        .then(data => {
            if (!data.bus && !data.metro && !data.combo) console.log("NO ROUTES FOUND");
            else console.log("ROUTES FOUND ONLINE:", {
                bus: data.bus ? data.bus.totalMins : null,
                metro: data.metro ? data.metro.totalMins : null,
                combo: data.combo ? data.combo.totalMins : null
            });
        })
        .catch(console.error);
})();
