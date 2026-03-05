import json
import urllib.request
import urllib.parse
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

# We know the exact ordered sequences for Purple, Green, and Yellow from Wikipedia/Namma Metro.
# We'll just hardcode the ordered lists of station names and fetch their coords via Nominatim, 
# because Overpass won't give us the ordered sequence easily.

LINES = {
    "Purple": {
        "id": "M-PL",
        "name": "Purple Line",
        "stops": [
            "Whitefield (Kadugodi)", "Hopefarm Channasandra", "Kadugodi Tree Park", "Pattandur Agrahara",
            "Sri Sathya Sai Hospital", "Nallurhalli", "Kundalahalli", "Seetharam Palya", "Hoodi",
            "Garudacharapalya", "Singayyanapalya", "Krishnarajapura (K.R. Pura)", "Benniganahalli",
            "Baiyappanahalli", "Swami Vivekananda Road", "Indiranagar", "Halasuru", "Trinity",
            "Mahatma Gandhi Road", "Cubbon Park", "Dr. B. R. Ambedkar Station, Vidhana Soudha",
            "Sir M. Visvesvaraya Station, Central College", "Nadaprabhu Kempegowda Station, Majestic",
            "Krantivira Sangolli Rayanna Railway Station", "Magadi Road", "Sri Balagangadharanatha Swamiji Station, Hosahalli",
            "Vijayanagar", "Attiguppe", "Deepanjali Nagar", "Mysuru Road", "Pantharapalya - Nayandahalli",
            "Rajarajeshwari Nagar", "Jnanabharathi", "Pattanagere", "Kengeri Bus Terminal", "Kengeri", "Challaghatta"
        ]
    },
    "Green": {
        "id": "M-GL",
        "name": "Green Line",
        "stops": [
            "Madavara", "Chikkabidarakallu", "Manjunathanagara", "Nagasandra", "Dasarahalli", 
            "Jalahalli", "Peenya Industry", "Peenya", "Goraguntepalya", "Yeshwanthpur", 
            "Sandal Soap Factory", "Mahalakshmi", "Rajajinagar", "Kuvempu Road", "Srirampura", 
            "Mantri Square Sampige Road", "Nadaprabhu Kempegowda Station, Majestic", "Chickpete", 
            "Krishna Rajendra Market", "National College", "Lalbagh", "South End Circle", 
            "Jayanagar", "Rashtreeya Vidyalaya Road", "Banashankari", "Jaya Prakash Nagar", 
            "Yelachenahalli", "Konanakunte Cross", "Doddakallasandra", "Vajarahalli", 
            "Thalaghattapura", "Silk Institute"
        ]
    },
    "Yellow": {
        "id": "M-YL",
        "name": "Yellow Line",
        "stops": [
            "Rashtreeya Vidyalaya Road", "Ragigudda", "Jayadeva Hospital", "BTM Layout", 
            "Central Silk Board", "Bommanahalli", "Hongasandra", "Kudlu Gate", "Singasandra", 
            "Hosa Road", "Beratena Agrahara", "Electronic City", "Konappana Agrahara", 
            "Huskur Road", "Hebbagodi", "Bommasandra"
        ]
    }
}

import time

def fetch_coords(name):
    # Nominatim search
    q = urllib.parse.quote(f"{name} Metro Station Bengaluru")
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'NammaMoveMetroBuilder/1.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        pass
    
    # Fallback broader query
    q = urllib.parse.quote(f"{name} Bengaluru")
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    req = urllib.request.Request(url, headers={'User-Agent': 'NammaMoveMetroBuilder/1.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception:
        pass
    
    return None, None

def main():
    print("Loading existing GTFS data...")
    with open(os.path.join(OUT_DIR, 'gtfs_stops.json'), 'r', encoding='utf-8') as f:
        stops = json.load(f)
    with open(os.path.join(OUT_DIR, 'gtfs_routes.json'), 'r', encoding='utf-8') as f:
        routes = json.load(f)
    with open(os.path.join(OUT_DIR, 'gtfs_route_stops.json'), 'r', encoding='utf-8') as f:
        route_stops = json.load(f)
        
    print(f"Current: {len(stops)} stops, {len(routes)} routes, {len(route_stops)} route-stops.")
    
    metro_stations = {}
    
    print("\nGeocoding Metro Stations via Nominatim...")
    for line_key, line_data in LINES.items():
        print(f"\n--- Processing {line_data['name']} ---")
        routes.append({
            "id": line_data["id"],
            "short_name": line_data["name"],
            "long_name": f"{line_data['stops'][0]} to {line_data['stops'][-1]}",
            "route_type": 1 # 1 = Subway/Metro
        })
        
        for i, stop_name in enumerate(line_data["stops"]):
            if stop_name not in metro_stations:
                print(f"  Geocoding {stop_name}...")
                lat, lon = fetch_coords(stop_name)
                # Small delay to respect Nominatim limits
                time.sleep(0.4)
                
                if not lat:
                    print(f"  [WARN] Failed finding {stop_name}. Using roughly Majestic center.")
                    lat, lon = 12.9778, 77.5702
                    
                stop_id = f"M-STA-{len(metro_stations)+1}"
                metro_stations[stop_name] = stop_id
                
                stops.append({
                    "id": stop_id,
                    "name": stop_name + " Metro Station",
                    "latitude": lat,
                    "longitude": lon
                })
            else:
                stop_id = metro_stations[stop_name]
                
            route_stops.append({
                "route_id": line_data["id"],
                "stop_id": stop_id,
                "stop_sequence": i + 1
            })

    print(f"\nWriting updated JSON back to {OUT_DIR}...")
    with open(os.path.join(OUT_DIR, 'gtfs_stops.json'), 'w', encoding='utf-8') as f:
        json.dump(stops, f, separators=(',', ':'))

    with open(os.path.join(OUT_DIR, 'gtfs_routes.json'), 'w', encoding='utf-8') as f:
        json.dump(routes, f, separators=(',', ':'))
        
    with open(os.path.join(OUT_DIR, 'gtfs_route_stops.json'), 'w', encoding='utf-8') as f:
        json.dump(route_stops, f, separators=(',', ':'))

    print("✅ Successfully appended Green, Purple, and Yellow metro lines!")

if __name__ == '__main__':
    main()
