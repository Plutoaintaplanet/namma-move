const res = await fetch('http://localhost:4000/api/route?fromLat=12.9957428&fromLon=77.7579489&toLat=12.9778&toLon=77.5702');
const data = await res.json();
console.log(JSON.stringify(data.metro, null, 2));
