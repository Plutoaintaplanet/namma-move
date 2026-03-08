async function nominatimSearch(query) {
    const q = encodeURIComponent(query + ", Bangalore, India");
    const primaryUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
    const res = await fetch(primaryUrl, {
        headers: { "User-Agent": "NammaMove/1.0 (Testing script)" }
    });
    const data = await res.json();
    if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
    }
    return null;
}

async function run() {
    const fromLoc = await nominatimSearch("ub");
    const toLoc = await nominatimSearch("dom");

    console.log("Resolving 'ub':", fromLoc);
    console.log("Resolving 'dom':", toLoc);
}
run().catch(console.error);
