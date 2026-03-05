import urllib.request
import json
import os

print("Fetching route list from Namma BMTC API...")
req = urllib.request.Request(
    'https://nammabmtc.com/api/routelist',
    headers={'User-Agent': 'Mozilla/5.0'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())
        print(f"Success! Found {len(data.get('data', []))} routes.")
        
        # Save a sample just to verify shape
        with open('bmtc_api_sample.json', 'w') as f:
            json.dump(data.get('data', [])[:5], f, indent=2)
            
except Exception as e:
    print(f"Error: {e}")
