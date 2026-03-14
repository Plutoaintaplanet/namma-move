import json
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

# Hardcoded Metro Data with Coordinates for Stability
# Data sourced from Namma Metro (approximate center-points for geofencing)
METRO_DATA = {
    "Purple": {
        "id": "M-PL",
        "name": "Purple Line",
        "stops": [
            {"name": "Whitefield (Kadugodi)", "lat": 12.9958, "lon": 77.7607},
            {"name": "Hope Farm Channasandra", "lat": 12.9922, "lon": 77.7516},
            {"name": "Kadugodi Tree Park", "lat": 12.9892, "lon": 77.7402},
            {"name": "Pattandur Agrahara", "lat": 12.9857, "lon": 77.7342},
            {"name": "Sri Sathya Sai Hospital", "lat": 12.9804, "lon": 77.7214},
            {"name": "Nallurhalli", "lat": 12.9772, "lon": 77.7126},
            {"name": "Kundalahalli", "lat": 12.9734, "lon": 77.7018},
            {"name": "Seetharam Palya", "lat": 12.9712, "lon": 77.6923},
            {"name": "Hoodi", "lat": 12.9691, "lon": 77.6806},
            {"name": "Garudacharapalya", "lat": 12.9678, "lon": 77.6710},
            {"name": "Singayyanapalya", "lat": 12.9668, "lon": 77.6631},
            {"name": "Krishnarajapura", "lat": 12.9661, "lon": 77.6521},
            {"name": "Benniganahalli", "lat": 12.9619, "lon": 77.6444},
            {"name": "Baiyappanahalli", "lat": 12.9571, "lon": 77.6405},
            {"name": "Swami Vivekananda Road", "lat": 12.9514, "lon": 77.6322},
            {"name": "Indiranagar", "lat": 12.9464, "lon": 77.6206},
            {"name": "Halasuru", "lat": 12.9431, "lon": 77.6106},
            {"name": "Trinity", "lat": 12.9408, "lon": 77.5997},
            {"name": "Mahatma Gandhi Road", "lat": 12.9383, "lon": 77.5873},
            {"name": "Cubbon Park", "lat": 12.9431, "lon": 77.5768},
            {"name": "Vidhana Soudha", "lat": 12.9461, "lon": 77.5681},
            {"name": "Sir M. Visvesvaraya", "lat": 12.9434, "lon": 77.5584},
            {"name": "Majestic", "lat": 12.9778, "lon": 77.5702},
            {"name": "KSR Railway Station", "lat": 12.9775, "lon": 77.5654},
            {"name": "Magadi Road", "lat": 12.9745, "lon": 77.5552},
            {"name": "Hosahalli", "lat": 12.9722, "lon": 77.5458},
            {"name": "Vijayanagar", "lat": 12.9698, "lon": 77.5358},
            {"name": "Attiguppe", "lat": 12.9676, "lon": 77.5258},
            {"name": "Deepanjali Nagar", "lat": 12.9654, "lon": 77.5158},
            {"name": "Mysuru Road", "lat": 12.9632, "lon": 77.5058},
            {"name": "Nayandahalli", "lat": 12.9511, "lon": 77.4958},
            {"name": "Rajarajeshwari Nagar", "lat": 12.9398, "lon": 77.4858},
            {"name": "Jnanabharathi", "lat": 12.9285, "lon": 77.4758},
            {"name": "Pattanagere", "lat": 12.9172, "lon": 77.4658},
            {"name": "Kengeri Bus Terminal", "lat": 12.9059, "lon": 77.4558},
            {"name": "Kengeri", "lat": 12.8946, "lon": 77.4458},
            {"name": "Challaghatta", "lat": 12.8833, "lon": 77.4358}
        ]
    },
    "Green": {
        "id": "M-GL",
        "name": "Green Line",
        "stops": [
            {"name": "Madavara", "lat": 13.0617, "lon": 77.5028},
            {"name": "Chikkabidarakallu", "lat": 13.0517, "lon": 77.5058},
            {"name": "Manjunathanagara", "lat": 13.0417, "lon": 77.5088},
            {"name": "Nagasandra", "lat": 13.0317, "lon": 77.5118},
            {"name": "Dasarahalli", "lat": 13.0217, "lon": 77.5148},
            {"name": "Jalahalli", "lat": 13.0117, "lon": 77.5178},
            {"name": "Peenya Industry", "lat": 13.0017, "lon": 77.5208},
            {"name": "Peenya", "lat": 12.9917, "lon": 77.5238},
            {"name": "Goraguntepalya", "lat": 12.9817, "lon": 77.5268},
            {"name": "Yeshwanthpur", "lat": 13.0233, "lon": 77.5492},
            {"name": "Sandal Soap Factory", "lat": 13.0133, "lon": 77.5522},
            {"name": "Mahalakshmi", "lat": 13.0033, "lon": 77.5552},
            {"name": "Rajajinagar", "lat": 12.9933, "lon": 77.5582},
            {"name": "Kuvempu Road", "lat": 12.9833, "lon": 77.5612},
            {"name": "Srirampura", "lat": 12.9733, "lon": 77.5642},
            {"name": "Mantri Square Sampige Road", "lat": 12.9633, "lon": 77.5672},
            {"name": "Majestic", "lat": 12.9778, "lon": 77.5702},
            {"name": "Chickpete", "lat": 12.9683, "lon": 77.5732},
            {"name": "Krishna Rajendra Market", "lat": 12.9583, "lon": 77.5762},
            {"name": "National College", "lat": 12.9483, "lon": 77.5792},
            {"name": "Lalbagh", "lat": 12.9383, "lon": 77.5822},
            {"name": "South End Circle", "lat": 12.9283, "lon": 77.5852},
            {"name": "Jayanagar", "lat": 12.9183, "lon": 77.5882},
            {"name": "Rashtreeya Vidyalaya Road", "lat": 12.9083, "lon": 77.5912},
            {"name": "Banashankari", "lat": 12.8983, "lon": 77.5942},
            {"name": "Jaya Prakash Nagar", "lat": 12.8883, "lon": 77.5972},
            {"name": "Yelachenahalli", "lat": 12.8783, "lon": 77.6002},
            {"name": "Konanakunte Cross", "lat": 12.8683, "lon": 77.6032},
            {"name": "Doddakallasandra", "lat": 12.8583, "lon": 77.6062},
            {"name": "Vajarahalli", "lat": 12.8483, "lon": 77.6092},
            {"name": "Thalaghattapura", "lat": 12.8383, "lon": 77.6122},
            {"name": "Silk Institute", "lat": 12.8283, "lon": 77.6152}
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
