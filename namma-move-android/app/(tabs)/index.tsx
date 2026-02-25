import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Animated } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { JourneyCard, CabCard } from '@/components/TransitCards';

const API_URL = 'https://www.nammamove.in.net/api'; // Live Vercel Production API

export default function PlannerScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [noRouteMsg, setNoRouteMsg] = useState('');

  const [region, setRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setRegion(prev => ({ ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.04, longitudeDelta: 0.02 }));
    })();
  }, []);

  const searchRoutes = async () => {
    if (!location) return;
    setLoading(true);
    setResults(null);
    setNoRouteMsg('');

    // Hardcode Majestic to Whitefield for demo testing Native multi-modal search
    const fLat = location.coords.latitude;
    const fLon = location.coords.longitude;
    const tLat = 12.968; // Whitefield (destination)
    const tLon = 77.750;

    try {
      const res = await fetch(`${API_URL}/route?fromLat=${fLat}&fromLon=${fLon}&toLat=${tLat}&toLon=${tLon}`);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();

      if (!data.bus && !data.metro && !data.combo) {
        setNoRouteMsg("No transit route found. Try the cab options.");
      }
      setResults(data);

    } catch (err) {
      console.warn('API Error', err);
      setNoRouteMsg("Failed to connect to backend api. Is it running on port 4000?");
    } finally {
      setLoading(false);
    }
  };

  if (!location && !errorMsg) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.teal} />
        <Text style={{ color: theme.text, marginTop: 16, fontWeight: '600' }}>Finding accurate GPS location...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* MAP SECTION (OpenStreetMap via WebView) */}
      <View style={styles.mapContainer}>
        <WebView
          originWhitelist={['*']}
          source={{
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <style>
                  body { padding: 0; margin: 0; background: ${theme.background}; }
                  #map { height: 100vh; width: 100vw; }
                  .leaflet-control-attribution { display: none !important; }
                  ${colorScheme === 'dark' ? `
                    .leaflet-layer, .leaflet-control-zoom-in, .leaflet-control-zoom-out, .leaflet-control-attribution {
                      filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
                    }
                  ` : ''}
                </style>
              </head>
              <body>
                <div id="map"></div>
                <script>
                  var map = L.map('map', { zoomControl: false }).setView([${region.latitude}, ${region.longitude}], 14);
                  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
                  
                  // Origin Marker
                  var oIcon = L.divIcon({ className: 'custom-div-icon', html: '<div style="background-color:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
                  var oMarker = L.marker([${region.latitude}, ${region.longitude}], {icon: oIcon}).addTo(map);

                  // Destination Marker
                  ${results && results.to ? `
                    var dIcon = L.divIcon({ className: 'custom-div-icon', html: '<div style="background-color:#f97316;width:16px;height:16px;border-radius:4px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3); transform: rotate(45deg);"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
                    var dMarker = L.marker([${results.to.lat}, ${results.to.lon}], {icon: dIcon}).addTo(map);
                    map.fitBounds([ 
                      [${region.latitude}, ${region.longitude}], 
                      [${results.to.lat}, ${results.to.lon}] 
                    ], { padding: [40, 40] });
                  ` : ''}
                </script>
              </body>
              </html>
            `
          }}
          style={[styles.map, { opacity: 0.99, overflow: 'hidden' }]}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
        />

        {/* Floating pill over map */}
        <View style={[styles.floatingPill, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <MaterialCommunityIcons name={location ? "map-marker-check" : "map-marker-radius"} size={16} color={location ? "#22c55e" : theme.teal} />
          <Text style={[styles.pillText, { color: location ? "#22c55e" : theme.tealDark }]}>
            {location ? "GPS Active" : "Finding GPS..."}
          </Text>
        </View>
      </View>

      {/* PLANNER PANEL */}
      <ScrollView
        contentContainerStyle={[styles.panel, { backgroundColor: theme.panel, borderColor: theme.border }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.dragPill} />

        {/* Search Inputs */}
        <View style={styles.inputStack}>
          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Current Location" placeholderTextColor={theme.textMuted} editable={false}
            />
          </View>
          <View style={styles.inputConnector} />
          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Destination (e.g. ITPL Whitefield)" placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {/* Time Tabs */}
        <View style={styles.timeTabs}>
          <TouchableOpacity style={[styles.timeTab, { backgroundColor: theme.teal }]}><Text style={[styles.timeTabText, { color: '#fff' }]}>Leave now</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.timeTab, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.timeTabText, { color: theme.textMuted }]}>Leave at</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.timeTab, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.timeTabText, { color: theme.textMuted }]}>Arrive by</Text></TouchableOpacity>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.searchBtn} onPress={searchRoutes} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Search Routes</Text>}
        </TouchableOpacity>

        {/* API RESULTS */}
        {noRouteMsg ? <Text style={[styles.warnMsg, { color: theme.accent }]}>{noRouteMsg}</Text> : null}

        {results && (
          <View style={styles.resultsWrap}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Suggested transit</Text>
            {results.metro && <JourneyCard data={results.metro} />}
            {results.combo && <JourneyCard data={results.combo} />}
            {results.bus && <JourneyCard data={results.bus} />}

            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 12 }]}>Cabs & Autos (Estimate)</Text>
            {results.cab && <CabCard cab={results.cab} />}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { height: '35%', position: 'relative' },
  map: { width: '100%', height: '100%' },
  customMarker: { padding: 4, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  floatingPill: {
    position: 'absolute', top: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, elevation: 4,
  },
  pillText: { fontSize: 12, fontWeight: '800' },

  panel: {
    padding: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    marginTop: -24, minHeight: '65%', paddingBottom: 60,
  },
  dragPill: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(150,150,150,0.3)', alignSelf: 'center', marginBottom: 16 },
  inputStack: { gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  inputConnector: { position: 'absolute', left: 5, top: 22, bottom: 22, width: 2, backgroundColor: 'rgba(255,255,255,0.1)', zIndex: -1 },
  input: { flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, fontSize: 15, fontWeight: '500' },

  timeTabs: { flexDirection: 'row', gap: 8, marginTop: 20 },
  timeTab: { flex: 1, height: 36, borderRadius: 99, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  timeTabText: { fontSize: 13, fontWeight: '600' },

  searchBtn: { backgroundColor: '#00a8a8', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20, elevation: 8 },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  resultsWrap: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
  warnMsg: { marginTop: 20, textAlign: 'center', fontWeight: '600', fontSize: 15 },
});
