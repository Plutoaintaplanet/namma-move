fetch("http://localhost:4000/api/route?fromLat=12.9718591&fromLon=77.5956698&toLat=12.9624669&toLon=77.6381958")
    .then(r => r.json())
    .then(data => {
        if (!data.bus && !data.metro && !data.combo) console.log("NO ROUTES FOUND");
        else console.log("ROUTES FOUND:", {
            bus: data.bus ? data.bus.totalMins : null,
            metro: data.metro ? data.metro.totalMins : null,
            combo: data.combo ? data.combo.totalMins : null
        });
    })
    .catch(console.error);
