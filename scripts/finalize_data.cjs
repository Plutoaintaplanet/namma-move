const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

// High-precision coordinates for Namma Metro Stations (Bengaluru)
const METRO_DATA = {
    "Purple Line": [
        ["Whitefield (Kadugodi)", 12.9957, 77.7601],
        ["Hopefarm Channasandra", 12.9931, 77.7512],
        ["Kadugodi Tree Park", 12.9892, 77.7405],
        ["Pattandur Agrahara", 12.9856, 77.7324],
        ["Sri Sathya Sai Hospital", 12.9814, 77.7218],
        ["Nallurhalli", 12.9789, 77.7125],
        ["Kundalahalli", 12.9755, 77.7021],
        ["Seetharam Palya", 12.9723, 77.6934],
        ["Hoodi", 12.9701, 77.6845],
        ["Garudacharapalya", 12.9678, 77.6756],
        ["Singayyanapalya", 12.9654, 77.6645],
        ["Krishnarajapura (K.R. Pura)", 12.9632, 77.6534],
        ["Benniganahalli", 12.9612, 77.6423],
        ["Baiyappanahalli", 12.9907, 77.6417],
        ["Swami Vivekananda Road", 12.9860, 77.6327],
        ["Indiranagar", 12.9784, 77.6408],
        ["Halasuru", 12.9755, 77.6265],
        ["Trinity", 12.9730, 77.6170],
        ["Mahatma Gandhi Road", 12.9757, 77.6068],
        ["Cubbon Park", 12.9810, 77.5970],
        ["Dr. B. R. Ambedkar Station, Vidhana Soudha", 12.9797, 77.5906],
        ["Sir M. Visvesvaraya Station, Central College", 12.9747, 77.5835],
        ["Nadaprabhu Kempegowda Station, Majestic", 12.9757, 77.5729],
        ["Krantivira Sangolli Rayanna Railway Station", 12.9740, 77.5650],
        ["Magadi Road", 12.9755, 77.5556],
        ["Sri Balagangadharanatha Swamiji Station, Hosahalli", 12.9750, 77.5445],
        ["Vijayanagar", 12.9715, 77.5360],
        ["Attiguppe", 12.9630, 77.5265],
        ["Deepanjali Nagar", 12.9530, 77.5180],
        ["Mysuru Road", 12.9455, 77.5305],
        ["Pantharapalya - Nayandahalli", 12.9405, 77.5205],
        ["Rajarajeshwari Nagar", 12.9350, 77.5150],
        ["Jnanabharathi", 12.9300, 77.5050],
        ["Pattanagere", 12.9230, 77.4980],
        ["Kengeri Bus Terminal", 12.9170, 77.4860],
        ["Kengeri", 12.9080, 77.4780],
        ["Challaghatta", 12.9010, 77.4650]
    ],
    "Green Line": [
        ["Madavara", 13.0625, 77.4750],
        ["Chikkabidarakallu", 13.0520, 77.4830],
        ["Manjunathanagara", 13.0420, 77.4910],
        ["Nagasandra", 13.0383, 77.4941],
        ["Dasarahalli", 13.0260, 77.5050],
        ["Jalahalli", 13.0220, 77.5160],
        ["Peenya Industry", 13.0190, 77.5260],
        ["Peenya", 13.0110, 77.5330],
        ["Goraguntepalya", 13.0070, 77.5460],
        ["Yeshwanthpur", 13.0236, 77.5503],
        ["Sandal Soap Factory", 13.0125, 77.5545],
        ["Mahalakshmi", 13.0080, 77.5490],
        ["Rajajinagar", 12.9990, 77.5500],
        ["Kuvempu Road", 12.9940, 77.5560],
        ["Srirampura", 12.9910, 77.5630],
        ["Mantri Square Sampige Road", 12.9890, 77.5710],
        ["Nadaprabhu Kempegowda Station, Majestic", 12.9757, 77.5729],
        ["Chickpete", 12.9700, 77.5740],
        ["Krishna Rajendra Market", 12.9610, 77.5740],
        ["National College", 12.9500, 77.5730],
        ["Lalbagh", 12.9460, 77.5800],
        ["South End Circle", 12.9380, 77.5800],
        ["Jayanagar", 12.9300, 77.5830],
        ["Rashtreeya Vidyalaya Road", 12.9210, 77.5830],
        ["Banashankari", 12.9150, 77.5730],
        ["Jaya Prakash Nagar", 12.9070, 77.5730],
        ["Yelachenahalli", 12.8950, 77.5710],
        ["Konanakunte Cross", 12.8850, 77.5730],
        ["Doddakallasandra", 12.8750, 77.5750],
        ["Vajarahalli", 12.8650, 77.5770],
        ["Thalaghattapura", 12.8550, 77.5800],
        ["Silk Institute", 12.8450, 77.5850]
    ],
    "Yellow Line": [
        ["Rashtreeya Vidyalaya Road", 12.9210, 77.5830],
        ["Ragigudda", 12.9160, 77.5920],
        ["Jayadeva Hospital", 12.9170, 77.6030],
        ["BTM Layout", 12.9160, 77.6130],
        ["Central Silk Board", 12.9175, 77.6225],
        ["Bommanahalli", 12.9030, 77.6240],
        ["Hongasandra", 12.8930, 77.6260],
        ["Kudlu Gate", 12.8800, 77.6300],
        ["Singasandra", 12.8680, 77.6350],
        ["Hosa Road", 12.8580, 77.6400],
        ["Beratena Agrahara", 12.8480, 77.6480],
        ["Electronic City", 12.8440, 77.6600],
        ["Konappana Agrahara", 12.8350, 77.6680],
        ["Huskur Road", 12.8250, 77.6780],
        ["Hebbagodi", 12.8150, 77.6880],
        ["Bommasandra", 12.8050, 77.6980]
    ]
};

function finalize() {
    console.log("🚀 Finalizing Transit Data...");

    // 1. Load BMTC data
    const bmtcStops = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'gtfs_stops.json'), 'utf-8'));
    const bmtcRoutes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'gtfs_routes.json'), 'utf-8'));
    const bmtcRouteStops = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'gtfs_route_stops.json'), 'utf-8'));

    // Filter out any existing metro-like IDs just in case
    let stops = bmtcStops.filter(s => !String(s.id).startsWith('M-'));
    let routes = bmtcRoutes.filter(r => !String(r.id).startsWith('M-'));
    let routeStops = bmtcRouteStops.filter(rs => !String(rs.route_id).startsWith('M-'));

    const metroStationMap = {}; // Name -> ID

    // 2. Add Metro Data
    Object.entries(METRO_DATA).forEach(([lineName, stations]) => {
        const lineId = "M-" + lineName.charAt(0).toUpperCase();
        routes.push({
            id: lineId,
            short_name: lineName,
            long_name: stations[0][0] + " to " + stations[stations.length - 1][0],
            route_type: 1
        });

        stations.forEach(([name, lat, lon], idx) => {
            let stopId = metroStationMap[name];
            if (!stopId) {
                stopId = "M-" + name.replace(/\s+/g, '-').replace(/[(),]/g, '').toUpperCase();
                metroStationMap[name] = stopId;
                stops.push({
                    id: stopId,
                    name: name + " Metro Station",
                    latitude: lat,
                    longitude: lon
                });
            }

            routeStops.push({
                route_id: lineId,
                stop_id: stopId,
                stop_sequence: idx + 1
            });
        });
    });

    console.log(`📊 Statistics:`);
    console.log(`   Stops: ${stops.length}`);
    console.log(`   Routes: ${routes.length}`);
    console.log(`   Connections: ${routeStops.length}`);

    fs.writeFileSync(path.join(DATA_DIR, 'gtfs_stops.json'), JSON.stringify(stops));
    fs.writeFileSync(path.join(DATA_DIR, 'gtfs_routes.json'), JSON.stringify(routes));
    fs.writeFileSync(path.join(DATA_DIR, 'gtfs_route_stops.json'), JSON.stringify(routeStops));

    console.log("✅ Final data saved to src/data/");
}

finalize();
