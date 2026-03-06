const http = require('http');

http.get('http://localhost:4000/api/route?fromLat=12.977&fromLon=77.571&toLat=12.968&toLon=77.750', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log("Error parsing JSON:", data);
        }
    });
}).on('error', err => console.error("Request error:", err.message));
