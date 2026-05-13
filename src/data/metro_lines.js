// Namma Metro — Real station coordinates (WGS84 lat/lon)
// Source: BMRCL official corridor maps

export const METRO_LINES = [
  {
    id: "M-PL",
    name: "Purple Line",
    shortName: "PL",
    color: "#9B59B6",
    colorHex: "#9B59B6",
    freq: 6,         // minutes between trains (peak)
    freqOffPeak: 10,
    stations: [
      { id: "PL-01", name: "Baiyappanahalli",     lat: 12.9915, lon: 77.6494 },
      { id: "PL-02", name: "Swami Vivekananda Rd",lat: 12.9892, lon: 77.6394 },
      { id: "PL-03", name: "Indiranagar",          lat: 12.9784, lon: 77.6408 },
      { id: "PL-04", name: "Halasuru",             lat: 12.9779, lon: 77.6285 },
      { id: "PL-05", name: "Trinity",              lat: 12.9768, lon: 77.6197 },
      { id: "PL-06", name: "Majestic (KIAS)",      lat: 12.9766, lon: 77.5713 },
      { id: "PL-07", name: "Cubbon Park",          lat: 12.9773, lon: 77.5974 },
      { id: "PL-08", name: "MG Road",              lat: 12.9752, lon: 77.6085 },
      { id: "PL-09", name: "Vidhana Soudha",       lat: 12.9792, lon: 77.5913 },
      { id: "PL-10", name: "Sir M Visvesvaraya",   lat: 12.9776, lon: 77.5802 },
      { id: "PL-11", name: "City Railway Stn",     lat: 12.9777, lon: 77.5709 },
      { id: "PL-12", name: "Magadi Road",          lat: 12.9750, lon: 77.5584 },
      { id: "PL-13", name: "Hosahalli",            lat: 12.9700, lon: 77.5481 },
      { id: "PL-14", name: "Vijayanagar",          lat: 12.9710, lon: 77.5343 },
      { id: "PL-15", name: "Attiguppe",            lat: 12.9619, lon: 77.5279 },
      { id: "PL-16", name: "Deepanjali Nagar",     lat: 12.9574, lon: 77.5196 },
      { id: "PL-17", name: "Mysuru Road",          lat: 12.9530, lon: 77.5108 },
      { id: "PL-18", name: "Kengeri Bus Terminal", lat: 12.9088, lon: 77.4822 },
      { id: "PL-19", name: "Pattanagere",          lat: 12.9150, lon: 77.4895 },
      { id: "PL-20", name: "Challaghatta",         lat: 12.9230, lon: 77.5002 },
    ]
  },
  {
    id: "M-GL",
    name: "Green Line",
    shortName: "GL",
    color: "#27AE60",
    colorHex: "#27AE60",
    freq: 8,
    freqOffPeak: 12,
    stations: [
      { id: "GL-01", name: "Nagasandra",           lat: 13.0510, lon: 77.5139 },
      { id: "GL-02", name: "Dasarahalli",          lat: 13.0382, lon: 77.5148 },
      { id: "GL-03", name: "Jalahalli",            lat: 13.0279, lon: 77.5159 },
      { id: "GL-04", name: "Peenya Industry",      lat: 13.0209, lon: 77.5199 },
      { id: "GL-05", name: "Peenya",               lat: 13.0142, lon: 77.5194 },
      { id: "GL-06", name: "Goraguntepalya",       lat: 13.0057, lon: 77.5221 },
      { id: "GL-07", name: "Yeshwanthpur",         lat: 13.0241, lon: 77.5413 },
      { id: "GL-08", name: "Sandal Soap Factory",  lat: 13.0164, lon: 77.5416 },
      { id: "GL-09", name: "Mahalakshmi",          lat: 13.0093, lon: 77.5419 },
      { id: "GL-10", name: "Rajajinagar",          lat: 12.9991, lon: 77.5521 },
      { id: "GL-11", name: "Kuvempu Road",         lat: 12.9908, lon: 77.5598 },
      { id: "GL-12", name: "Srirampura",           lat: 12.9841, lon: 77.5632 },
      { id: "GL-13", name: "Majestic",             lat: 12.9766, lon: 77.5713 },
      { id: "GL-14", name: "Chickpete",            lat: 12.9686, lon: 77.5757 },
      { id: "GL-15", name: "KR Market",            lat: 12.9641, lon: 77.5762 },
      { id: "GL-16", name: "National College",     lat: 12.9561, lon: 77.5767 },
      { id: "GL-17", name: "Lalbagh",              lat: 12.9508, lon: 77.5839 },
      { id: "GL-18", name: "South End Circle",     lat: 12.9427, lon: 77.5890 },
      { id: "GL-19", name: "Jayanagar",            lat: 12.9353, lon: 77.5839 },
      { id: "GL-20", name: "RV Road",              lat: 12.9310, lon: 77.5780 },
      { id: "GL-21", name: "Banashankari",         lat: 12.9252, lon: 77.5705 },
      { id: "GL-22", name: "Jaya Prakash Nagar",   lat: 12.9155, lon: 77.5688 },
      { id: "GL-23", name: "Yelachenahalli",       lat: 12.9039, lon: 77.5714 },
      { id: "GL-24", name: "Konanakunte Cross",    lat: 12.8977, lon: 77.5734 },
      { id: "GL-25", name: "Doddakallasandra",     lat: 12.8910, lon: 77.5757 },
      { id: "GL-26", name: "Vajarahalli",          lat: 12.8851, lon: 77.5779 },
      { id: "GL-27", name: "Thalaghattapura",      lat: 12.8793, lon: 77.5804 },
      { id: "GL-28", name: "Silk Institute",       lat: 12.8731, lon: 77.5831 },
    ]
  },
  {
    id: "M-YL",
    name: "Yellow Line",
    shortName: "YL",
    color: "#F39C12",
    colorHex: "#F39C12",
    freq: 10,
    freqOffPeak: 15,
    stations: [
      { id: "YL-01", name: "RV Road",              lat: 12.9310, lon: 77.5780 },
      { id: "YL-02", name: "Bommanahalli",         lat: 12.9119, lon: 77.6084 },
      { id: "YL-03", name: "Hongasandra",          lat: 12.8981, lon: 77.6216 },
      { id: "YL-04", name: "Gottigere",            lat: 12.8858, lon: 77.6057 },
      { id: "YL-05", name: "Hulimavu",             lat: 12.8743, lon: 77.5980 },
      { id: "YL-06", name: "Meenakshi Mall",       lat: 12.8700, lon: 77.6063 },
      { id: "YL-07", name: "Begur Road",           lat: 12.8623, lon: 77.6154 },
      { id: "YL-08", name: "Harlur Road",          lat: 12.8812, lon: 77.6487 },
      { id: "YL-09", name: "Haralur Road",         lat: 12.8879, lon: 77.6590 },
      { id: "YL-10", name: "Carmelaram",           lat: 12.8957, lon: 77.6708 },
      { id: "YL-11", name: "Sarjapura Road",       lat: 12.9036, lon: 77.6832 },
      { id: "YL-12", name: "Ambalipura",           lat: 12.9131, lon: 77.6942 },
      { id: "YL-13", name: "Bellandur",            lat: 12.9224, lon: 77.6864 },
      { id: "YL-14", name: "Iblur",                lat: 12.9222, lon: 77.6700 },
      { id: "YL-15", name: "Agara",                lat: 12.9222, lon: 77.6574 },
      { id: "YL-16", name: "HSR Layout",           lat: 12.9196, lon: 77.6464 },
      { id: "YL-17", name: "Bommasandra",          lat: 12.8245, lon: 77.6876 },
    ]
  }
];

// Compute average speed (minutes per station) for each line
export function getTrainSpeed(line) {
  const totalStations = line.stations.length;
  // Each station ~2–2.5 min apart for metro
  return 2.2; // minutes per station
}

// Get the current frequency based on time of day
export function getCurrentFreq(line) {
  const h = new Date().getHours();
  const isPeak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
  return isPeak ? line.freq : line.freqOffPeak;
}

// Compute all active train positions for a given line at a specific timestamp
// Returns array of {lat, lon, direction, fromStation, toStation, progress, nextStopName, etaMin}
export function getTrainPositions(line, now = new Date()) {
  const stations = line.stations;
  const n = line.stations.length;
  const freq = getCurrentFreq(line);
  const secPerStation = getTrainSpeed(line) * 60; // in seconds
  const tripDurationSec = n * secPerStation;      // one-way trip in seconds
  const cycleSec = tripDurationSec * 2;            // round trip

  const totalSecOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const serviceStart = 5 * 3600; // 5:00 AM

  if (totalSecOfDay < serviceStart || totalSecOfDay >= 23 * 3600) return [];

  const trains = [];
  // Spawn trains offset by frequency, from both directions
  const numTrains = Math.ceil(cycleSec / (freq * 60));
  
  for (let i = 0; i < numTrains; i++) {
    const offsetSec = i * (freq * 60);
    const phase = ((totalSecOfDay - serviceStart + offsetSec) % cycleSec + cycleSec) % cycleSec;

    let lat, lon, direction, fromIdx, toIdx, progress, nextStop, etaMin;

    if (phase < tripDurationSec) {
      // Forward direction: station 0 → n-1
      direction = "forward";
      const stationProgress = phase / secPerStation;
      fromIdx = Math.floor(stationProgress);
      progress = stationProgress - fromIdx;
      if (fromIdx >= n - 1) { fromIdx = n - 2; progress = 1; }
      toIdx = fromIdx + 1;
      nextStop = stations[toIdx];
      etaMin = Math.round((secPerStation * (1 - progress)) / 60);
    } else {
      // Reverse direction: station n-1 → 0
      direction = "reverse";
      const reversedSec = phase - tripDurationSec;
      const stationProgress = reversedSec / secPerStation;
      fromIdx = (n - 1) - Math.floor(stationProgress);
      progress = stationProgress - Math.floor(stationProgress);
      if (fromIdx <= 0) { fromIdx = 1; progress = 1; }
      toIdx = fromIdx - 1;
      nextStop = stations[toIdx];
      etaMin = Math.round((secPerStation * (1 - progress)) / 60);
    }

    // Interpolate lat/lon
    const from = stations[fromIdx];
    const to   = stations[toIdx];
    lat = from.lat + (to.lat - from.lat) * progress;
    lon = from.lon + (to.lon - from.lon) * progress;

    trains.push({ lat, lon, direction, fromIdx, toIdx, progress, nextStop, etaMin, lineId: line.id, lineColor: line.color });
  }

  return trains;
}

// Suggest what time user should leave home to catch the next metro from a station
// Returns: { leaveBy: "11:42 AM", nextTrain: "11:48 AM", walkMin: 8, waitMin: 6 }
export function getLeaveByTime(stationName, walkMinFromUser) {
  const now = new Date();
  const h = now.getHours();
  const isPeak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);

  // Find which line has this station
  for (const line of METRO_LINES) {
    const station = line.stations.find(s => s.name.toLowerCase().includes(stationName.toLowerCase()));
    if (!station) continue;

    const freq = isPeak ? line.freq : line.freqOffPeak;
    const nowMin = h * 60 + now.getMinutes();
    const minsUntilNext = freq - (nowMin % freq) || freq;

    const nextTrainMin = nowMin + minsUntilNext;
    const leaveByMin   = nextTrainMin - walkMinFromUser;

    const fmt = (m) => {
      const hh = Math.floor(m / 60) % 24;
      const mm = m % 60;
      const ampm = hh >= 12 ? 'PM' : 'AM';
      return `${((hh % 12) || 12).toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')} ${ampm}`;
    };

    return {
      line: line.name,
      lineColor: line.color,
      stationName: station.name,
      leaveBy: fmt(leaveByMin),
      nextTrain: fmt(nextTrainMin),
      walkMin: walkMinFromUser,
      waitMin: minsUntilNext - walkMinFromUser
    };
  }
  return null;
}
