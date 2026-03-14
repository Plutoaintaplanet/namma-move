import json
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

# Accuracy update based on provided station list
METRO_DATA = {
    "Purple": {
        "id": "M-PL",
        "name": "Purple Line",
        "stops": [
            {"name": "Baiyappanahalli", "lat": 12.9908, "lon": 77.6482},
            {"name": "Swami Vivekananda Road", "lat": 12.9851, "lon": 77.6446},
            {"name": "Indiranagar", "lat": 12.9785, "lon": 77.6408},
            {"name": "Halasuru", "lat": 12.9779, "lon": 77.6247},
            {"name": "Trinity", "lat": 12.9738, "lon": 77.6170},
            {"name": "MG Road", "lat": 12.9756, "lon": 77.6066},
            {"name": "Cubbon Park", "lat": 12.9797, "lon": 77.5993},
            {"name": "Vidhana Soudha", "lat": 12.9799, "lon": 77.5917},
            {"name": "Sir M. Visvesvaraya", "lat": 12.9780, "lon": 77.5864},
            {"name": "Majestic", "lat": 12.9764, "lon": 77.5713},
            {"name": "KSR Railway Station", "lat": 12.9785, "lon": 77.5673},
            {"name": "Magadi Road", "lat": 12.9755, "lon": 77.5575},
            {"name": "Hosahalli", "lat": 12.9744, "lon": 77.5476},
            {"name": "Vijayanagar", "lat": 12.9719, "lon": 77.5370},
            {"name": "Attiguppe", "lat": 12.9700, "lon": 77.5289},
            {"name": "Deepanjali Nagar", "lat": 12.9676, "lon": 77.5188},
            {"name": "Mysuru Road", "lat": 12.9663, "lon": 77.5084},
            {"name": "Nayandahalli", "lat": 12.9669, "lon": 77.4950},
            {"name": "Rajarajeshwari Nagar", "lat": 12.9644, "lon": 77.4762},
            {"name": "Jnanabharathi", "lat": 12.9603, "lon": 77.4706},
            {"name": "Pattanagere", "lat": 12.9565, "lon": 77.4635},
            {"name": "Kengeri Bus Terminal", "lat": 12.9497, "lon": 77.4559},
            {"name": "Kengeri", "lat": 12.9418, "lon": 77.4502},
            {"name": "Challaghatta", "lat": 12.9290, "lon": 77.4351}
        ]
    },
    "Green": {
        "id": "M-GL",
        "name": "Green Line",
        "stops": [
            {"name": "Nagasandra", "lat": 13.0475, "lon": 77.5005},
            {"name": "Dasarahalli", "lat": 13.0434, "lon": 77.5110},
            {"name": "Jalahalli", "lat": 13.0380, "lon": 77.5190},
            {"name": "Peenya Industry", "lat": 13.0285, "lon": 77.5263},
            {"name": "Peenya", "lat": 13.0281, "lon": 77.5333},
            {"name": "Goraguntepalya", "lat": 13.0280, "lon": 77.5415},
            {"name": "Yeshwanthpur", "lat": 13.0234, "lon": 77.5491},
            {"name": "Sandal Soap Factory", "lat": 13.0144, "lon": 77.5537},
            {"name": "Mahalakshmi", "lat": 13.0067, "lon": 77.5595},
            {"name": "Rajajinagar", "lat": 12.9986, "lon": 77.5628},
            {"name": "Kuvempu Road", "lat": 12.9906, "lon": 77.5639},
            {"name": "Srirampura", "lat": 12.9833, "lon": 77.5650},
            {"name": "Sampige Road", "lat": 12.9785, "lon": 77.5695},
            {"name": "Majestic", "lat": 12.9764, "lon": 77.5713},
            {"name": "Chickpete", "lat": 12.9713, "lon": 77.5740},
            {"name": "Krishna Rajendra Market", "lat": 12.9668, "lon": 77.5730},
            {"name": "National College", "lat": 12.9576, "lon": 77.5737},
            {"name": "Lalbagh", "lat": 12.9507, "lon": 77.5848},
            {"name": "South End Circle", "lat": 12.9434, "lon": 77.5857},
            {"name": "Jayanagar", "lat": 12.9293, "lon": 77.5834},
            {"name": "Rashtreeya Vidyalaya Road", "lat": 12.9180, "lon": 77.5809},
            {"name": "Banashankari", "lat": 12.9156, "lon": 77.5736},
            {"name": "JP Nagar", "lat": 12.9073, "lon": 77.5750},
            {"name": "Yelachenahalli", "lat": 12.8956, "lon": 77.5749},
            {"name": "Konanakunte Cross", "lat": 12.8850, "lon": 77.5665},
            {"name": "Doddakallasandra", "lat": 12.8763, "lon": 77.5673},
            {"name": "Vajarahalli", "lat": 12.8666, "lon": 77.5614},
            {"name": "Thalaghattapura", "lat": 12.8580, "lon": 77.5560},
            {"name": "Silk Institute", "lat": 12.8487, "lon": 77.5520}
        ]
    }
}

def main():
    print("Loading existing GTFS data...")
    with open(os.path.join(OUT_DIR, 'gtfs_stops.json'), 'r', encoding='utf-8') as f:
        stops = json.load(f)
    with open(os.path.join(OUT_DIR, 'gtfs_routes.json'), 'r', encoding='utf-8') as f:
        routes = json.load(f)
    with open(os.path.join(OUT_DIR, 'gtfs_route_stops.json'), 'r', encoding='utf-8') as f:
        route_stops = json.load(f)

    # Clean existing Metro entries to avoid duplicates
    stops = [s for s in stops if not str(s['id']).startswith('M-')]
    routes = [r for r in routes if not str(r['id']).startswith('M-')]
    route_stops = [rs for rs in route_stops if not str(rs['route_id']).startswith('M-')]

    print(f"Cleaned: {len(stops)} stops, {len(routes)} routes.")

    metro_stations = {}

    for line_key, line_data in METRO_DATA.items():
        print(f"Adding {line_data['name']}...")
        routes.append({
            "id": line_data["id"],
            "short_name": line_data["name"],
            "long_name": f"{line_data['stops'][0]['name']} to {line_data['stops'][-1]['name']}",
            "route_type": 1 
        })

        for i, stop_info in enumerate(line_data["stops"]):
            name = stop_info['name']
            if name not in metro_stations:
                stop_id = f"M-STA-{len(metro_stations) + 1}"
                metro_stations[name] = stop_id
                stops.append({
                    "id": stop_id,
                    "name": name + " Metro Station",
                    "latitude": stop_info['lat'],
                    "longitude": stop_info['lon']
                })
            else:
                stop_id = metro_stations[name]

            route_stops.append({
                "route_id": line_data["id"],
                "stop_id": stop_id,
                "stop_sequence": i + 1
            })

    print(f"Writing updated data to {OUT_DIR}...")
    with open(os.path.join(OUT_DIR, 'gtfs_stops.json'), 'w', encoding='utf-8') as f:
        json.dump(stops, f, separators=(',', ':'))
    with open(os.path.join(OUT_DIR, 'gtfs_routes.json'), 'w', encoding='utf-8') as f:
        json.dump(routes, f, separators=(',', ':'))
    with open(os.path.join(OUT_DIR, 'gtfs_route_stops.json'), 'w', encoding='utf-8') as f:
        json.dump(route_stops, f, separators=(',', ':'))

    print("✅ Metro data successfully integrated!")

if __name__ == '__main__':
    main()
