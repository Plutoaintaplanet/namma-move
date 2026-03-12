import zipfile
import json
import csv
import io
import os
import math

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')
os.makedirs(OUT_DIR, exist_ok=True)
ARCHIVE_PATH = os.path.join(os.path.dirname(__file__), '..', 'archive.zip')

def distance_approx(lat1, lon1, lat2, lon2):
    # Quick Euclidean distance in degrees. Good enough for < 1km at equator
    return math.hypot(lat2 - lat1, lon2 - lon1) * 111000  # meters

stops_out = []
stops_grid = {} 
GRID_SIZE = 0.005 # ~500 meters

def get_grid_key(lat, lon):
    return (int(lat / GRID_SIZE), int(lon / GRID_SIZE))

routes_out = []
route_stops_out = []

print("Reading CSVs from Kaggle archive...")
with zipfile.ZipFile(ARCHIVE_PATH, 'r') as z:
    with z.open('stops.csv') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, 'utf-8-sig'))
        for row in reader:
            if not row.get('id'): continue
            geom = row.get('geometry', '')
            if geom.startswith('POINT ('):
                coords = geom.replace('POINT (', '').replace(')', '').split()
                if len(coords) == 2:
                    lon, lat = float(coords[0]), float(coords[1])
                    stop_obj = {"id": row['id'], "name": row['name'].strip(), "latitude": lat, "longitude": lon}
                    stops_out.append(stop_obj)
                    
                    key = get_grid_key(lat, lon)
                    if key not in stops_grid: stops_grid[key] = []
                    stops_grid[key].append(stop_obj)

    print(f"Loaded {len(stops_out)} real BMTC stops into spatial grid.")

    with z.open('routes.csv') as f:
        reader = csv.DictReader(io.TextIOWrapper(f, 'utf-8-sig'))
        for r_idx, row in enumerate(reader):
            rid = row.get('id', str(r_idx))
            name = row.get('name', '')
            if not name: continue
            
            routes_out.append({
                "id": rid,
                "short_name": name,
                "long_name": row.get('full_name', name),
                "route_type": 3
            })
            
            geom = row.get('geometry', '')
            if geom.startswith('LINESTRING ('):
                c_str = geom.replace('LINESTRING (', '').replace(')', '')
                points = []
                for pt in c_str.split(', '):
                    parts = pt.split()
                    if len(parts) == 2: points.append((float(parts[1]), float(parts[0]))) # lat, lon
                
                seq = 1
                seen_stops = set()
                
                # Check every 10th point in the LineString
                for p_i, (plat, plon) in enumerate(points):
                    if p_i % 10 != 0 and p_i != len(points)-1: continue
                    
                    closest_stop = None
                    min_dist = 60 # Check within 60 meters
                    
                    gk = get_grid_key(plat, plon)
                    
                    # Search local 3x3 grid cells
                    for dx in [-1, 0, 1]:
                        for dy in [-1, 0, 1]:
                            gx, gy = gk
                            cell_key = (gx + dx, gy + dy)
                            if cell_key in stops_grid:
                                for stop in stops_grid[cell_key]:
                                    d = distance_approx(plat, plon, stop['latitude'], stop['longitude'])
                                    if d < min_dist:
                                        min_dist = d
                                        closest_stop = stop['id']
                                        
                    if closest_stop is not None and closest_stop not in seen_stops:
                        seen_stops.add(str(closest_stop))
                        route_stops_out.append({
                            "route_id": rid,
                            "stop_id": closest_stop,
                            "stop_sequence": seq
                        })
                        seq = seq + 1
            
            if r_idx % 500 == 0 and r_idx > 0:
                print(f"Processed {r_idx} routes... Found {len(route_stops_out)} connections")
                
print(f"\n✅ Reconstructed {len(routes_out)} real BMTC routes and {len(route_stops_out)} connections!")

with open(os.path.join(OUT_DIR, 'gtfs_stops.json'), 'w', encoding='utf-8') as f:
    json.dump(stops_out, f, separators=(',', ':'))

with open(os.path.join(OUT_DIR, 'gtfs_routes.json'), 'w', encoding='utf-8') as f:
    json.dump(routes_out, f, separators=(',', ':'))
    
with open(os.path.join(OUT_DIR, 'gtfs_route_stops.json'), 'w', encoding='utf-8') as f:
    json.dump(route_stops_out, f, separators=(',', ':'))
