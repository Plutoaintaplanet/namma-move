import zipfile
import json
import csv
import io
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
os.makedirs(OUT_DIR, exist_ok=True)

ARCHIVE_PATH = os.path.join(os.path.dirname(__file__), '..', 'archive.zip')

print("Opening Kaggle archive...")
with zipfile.ZipFile(ARCHIVE_PATH, 'r') as outer_zip:
    print("Extracting bmtc.zip...")
    bmtc_zip_data = outer_zip.read('bmtc.zip')

print("Parsing GTFS data from bmtc.zip...")
with zipfile.ZipFile(io.BytesIO(bmtc_zip_data), 'r') as gtfs_zip:
    
    # --- 1. Stops ---
    print("Parsing stops...")
    stops_data = gtfs_zip.read('stops.txt').decode('utf-8-sig')
    stops_reader = csv.DictReader(io.StringIO(stops_data))
    
    stops_out = []
    for row in stops_reader:
        if row.get('stop_id') and row.get('stop_lat'):
            stops_out.append({
                "id": row['stop_id'],
                "name": row['stop_name'],
                "latitude": float(row['stop_lat']),
                "longitude": float(row['stop_lon'])
            })
            
    # --- 2. Routes ---
    print("Parsing routes...")
    routes_data = gtfs_zip.read('routes.txt').decode('utf-8-sig')
    routes_reader = csv.DictReader(io.StringIO(routes_data))
    
    routes_out = []
    for row in routes_reader:
        routes_out.append({
            "id": row['route_id'],
            "short_name": row.get('route_short_name', row['route_id']),
            "long_name": row.get('route_long_name', ''),
            "route_type": int(row.get('route_type', 3))
        })
        
    # --- 3. Trips (to map Route -> Trip) ---
    print("Parsing trips...")
    trips_data = gtfs_zip.read('trips.txt').decode('utf-8-sig')
    trips_reader = csv.DictReader(io.StringIO(trips_data))
    
    trip_to_route = {}
    rep_trip = {}
    for row in trips_reader:
        rid = row['route_id']
        tid = row['trip_id']
        trip_to_route[tid] = rid
        if rid not in rep_trip or tid < rep_trip[rid]:
            rep_trip[rid] = tid
            
    rep_set = set(rep_trip.values())
    
    # --- 4. Stop Times (to build Route-Stops) ---
    print("Parsing stop_times...")
    st_data = gtfs_zip.read('stop_times.txt').decode('utf-8-sig')
    st_reader = csv.DictReader(io.StringIO(st_data))
    
    rs_out = []
    seen = set()
    
    count = 0
    for row in st_reader:
        count += 1
        if count % 100000 == 0:
            print(f"Processed {count} stop_times...")
            
        tid = row['trip_id']
        if tid not in rep_set:
            continue
            
        rid = trip_to_route.get(tid)
        if not rid:
            continue
            
        sid = row['stop_id']
        key = f"{rid}|{sid}"
        if key in seen:
            continue
            
        seen.add(key)
        rs_out.append({
            "route_id": rid,
            "stop_id": sid,
            "stop_sequence": int(row['stop_sequence'])
        })

print(f"\nWriting JSON to {OUT_DIR}...")
with open(os.path.join(OUT_DIR, 'gtfs_stops.json'), 'w', encoding='utf-8') as f:
    json.dump(stops_out, f, separators=(',', ':'))

with open(os.path.join(OUT_DIR, 'gtfs_routes.json'), 'w', encoding='utf-8') as f:
    json.dump(routes_out, f, separators=(',', ':'))
    
with open(os.path.join(OUT_DIR, 'gtfs_route_stops.json'), 'w', encoding='utf-8') as f:
    json.dump(rs_out, f, separators=(',', ':'))

print(f"✅ Success! Generated JSON for {len(stops_out)} stops, {len(routes_out)} routes, and {len(rs_out)} route-stops.")
