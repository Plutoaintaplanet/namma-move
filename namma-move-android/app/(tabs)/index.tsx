import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, View, ScrollView, Image, Keyboard,
} from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  ActivityIndicator, 
  useTheme, 
  IconButton,
  Surface,
  Portal,
  Modal
} from 'react-native-paper';
import { useColorScheme } from '@/components/useColorScheme';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { JourneyCard, CabCard } from '@/components/TransitCards';
import OnboardingModal from '@/components/OnboardingModal';
import * as SecureStore from 'expo-secure-store';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  Layout
} from 'react-native-reanimated';

const API_URL = 'https://namma-move.vercel.app/api';
const BANGALORE = { lat: 12.9716, lon: 77.5946 };

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

type ActiveField = 'origin' | 'dest' | null;

export default function PlannerScreen() {
  const paperTheme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // GPS state
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [noRouteMsg, setNoRouteMsg] = useState('');

  // Origin field
  const [originText, setOriginText] = useState('Current Location');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [usingGps, setUsingGps] = useState(true);

  // Destination field
  const [destText, setDestText] = useState('');
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Shared suggestion state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [region, setRegion] = useState({ latitude: BANGALORE.lat, longitude: BANGALORE.lon });

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const webviewRef = useRef<WebView>(null);

  // Reanimated shared values
  const panelTranslateY = useSharedValue(100);
  const panelOpacity = useSharedValue(0);

  useEffect(() => {
    panelTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });
    panelOpacity.value = withTiming(1, { duration: 500 });
  }, []);

  const animatedPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelTranslateY.value }],
    opacity: panelOpacity.value,
  }));

  // Onboarding check
  useEffect(() => {
    SecureStore.getItemAsync('onboarding_done').then((val: string | null) => {
      if (!val) setShowOnboarding(true);
    }).catch(() => { });
  }, []);

  const handleOnboardingDone = () => {
    setShowOnboarding(false);
    SecureStore.setItemAsync('onboarding_done', '1').catch(() => { });
  };

  const applyLocation = (lat: number, lon: number) => {
    const coords = { lat, lon };
    setGpsLocation(coords);
    
    // Inject the new coordinates directly to the leaflet map to prevent flash reloads
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(`
        if (typeof userMarker !== 'undefined') {
          userMarker.setLatLng([${lat}, ${lon}]);
        }
        true;
      `);
    }

    if (usingGps) {
      setOriginCoords(coords);
    }
  };

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { applyLocation(BANGALORE.lat, BANGALORE.lon); return; }
        const last = await Location.getLastKnownPositionAsync({});
        if (last) {
          applyLocation(last.coords.latitude, last.coords.longitude);
          setRegion({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        }
        // Start continuous live tracking
        subscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 10
        }, (loc) => {
          applyLocation(loc.coords.latitude, loc.coords.longitude);
        });
      } catch (_) { 
        if (!gpsLocation) {
          applyLocation(BANGALORE.lat, BANGALORE.lon); 
          setRegion(BANGALORE);
        }
      }
    })();
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) { setSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ' Bangalore')}&format=json&limit=4&countrycodes=in`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'NammaMove/1.0' } }
      );
      const data = await res.json();
      setSuggestions(data);
    } catch { setSuggestions([]); }
    finally { setSuggestLoading(false); }
  }, []);

  const onTextChange = (text: string, field: ActiveField) => {
    if (field === 'origin') { setOriginText(text); setOriginCoords(null); setUsingGps(false); }
    else { setDestText(text); setDestCoords(null); }
    setResults(null); setSuggestions([]);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(text), 350);
  };

  const onSelectSuggestion = (s: Suggestion) => {
    const coords = { lat: parseFloat(s.lat), lon: parseFloat(s.lon) };
    const short = s.display_name.split(',')[0];
    if (activeField === 'origin') {
      setOriginText(short); setOriginCoords(coords); setUsingGps(false);
    } else {
      setDestText(short); setDestCoords(coords);
      setRegion({ latitude: coords.lat, longitude: coords.lon });
    }
    setSuggestions([]); setActiveField(null); Keyboard.dismiss();
  };

  const resetToGps = () => {
    if (gpsLocation) {
      setOriginText('Current Location');
      setOriginCoords(gpsLocation);
      setUsingGps(true);
      if (webviewRef.current) {
        webviewRef.current.injectJavaScript(`
          if (typeof map !== 'undefined') map.setView([${gpsLocation.lat}, ${gpsLocation.lon}], 14);
          true;
        `);
      }
    }
    setSuggestions([]); setActiveField(null); Keyboard.dismiss();
  };

  const searchRoutes = async () => {
    const from = usingGps ? gpsLocation : originCoords;
    if (!from) { setNoRouteMsg('Please set a starting location.'); return; }
    if (!destCoords) { setNoRouteMsg('Please select a destination.'); return; }
    setLoading(true); setResults(null); setNoRouteMsg('');

    try {
      const res = await fetch(`${API_URL}/route?fromLat=${from.lat}&fromLon=${from.lon}&toLat=${destCoords.lat}&toLon=${destCoords.lon}`);
      if (!res.ok) throw new Error('API Error');
      const rawData = await res.json();
      
      const data = { ...rawData };
      // Keep routes dynamically iterable
      if (!data.routes || data.routes.length === 0) setNoRouteMsg('No transit route found.');
      setResults(data);
    } catch {
      setNoRouteMsg('Could not reach server.');
    } finally { setLoading(false); }
  };

  const fromCoords = usingGps ? gpsLocation : originCoords;
  const canSearch = !!fromCoords && !!destCoords;

  const mapHtml = useMemo(() => `
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>body{padding:0;margin:0;}#map{height:100vh;width:100vw;}.leaflet-control-attribution{display:none!important;}
    ${isDark ? '.leaflet-layer{filter:invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);}' : ''}</style>
    </head><body><div id="map"></div><script>
    var map=L.map('map',{zoomControl:false}).setView([${region.latitude},${region.longitude}],14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    var oIcon=L.divIcon({className:'',html:'<div style="background:${paperTheme.colors.primary};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
    var userMarker = L.marker([${region.latitude},${region.longitude}],{icon:oIcon}).addTo(map);
    var routeLayer = L.layerGroup().addTo(map);
    var trainLayer = L.layerGroup().addTo(map);
    ${destCoords ? `
      var dIcon=L.divIcon({className:'',html:'<div style="background:${paperTheme.colors.secondary};width:16px;height:16px;border-radius:4px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);transform:rotate(45deg);"></div>',iconSize:[16,16],iconAnchor:[8,8]});
      L.marker([${destCoords.lat},${destCoords.lon}],{icon:dIcon}).addTo(map);
      map.fitBounds([[${region.latitude},${region.longitude}],[${destCoords.lat},${destCoords.lon}]],{padding:[40,40]});
    ` : ''}
    </script></body></html>
  `, [region, destCoords, isDark, paperTheme.colors.primary, paperTheme.colors.secondary]);

  // Handle flash-free polyline injection
  useEffect(() => {
    if (results && results.routes && results.routes.length > 0 && webviewRef.current) {
      const best = results.routes[0];
      if (!best.legs) return;
      let js = `
        if (typeof routeLayer !== 'undefined') { routeLayer.clearLayers(); }
      `;
      best.legs.forEach((leg: any) => {
         if (!leg.stops) return;
         const coords = leg.stops.map((s:any) => `[${s.lat}, ${s.lon}]`).join(',');
         const color = leg.mode === 'metro' ? '#7c3aed' : '#00A86B';
         js += `L.polyline([${coords}], {color: '${color}', weight: 4, opacity: 0.8}).addTo(routeLayer);\n`;
      });
      js += `
        var bounds = routeLayer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, {padding:[40,40]});
        true;
      `;
      webviewRef.current.injectJavaScript(js);
    } else if (!results && webviewRef.current) {
      webviewRef.current.injectJavaScript(`if (typeof routeLayer !== 'undefined') { routeLayer.clearLayers(); } true;`);
    }
  }, [results]);

  // Live trains polling — update existing markers instead of recreating them for smooth motion
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const fetchTrains = async () => {
      try {
        const res = await fetch(`${API_URL}/live?type=metro`);
        const data = await res.json();
        
        if (webviewRef.current && data) {
          let js = `if (typeof window.trainMarkers === 'undefined') window.trainMarkers = {}; if (typeof trainLayer === 'undefined') var trainLayer = L.layerGroup().addTo(map); var seen = {};`;
          const colors: Record<string, string> = { 'M-PL': '#9B7BB4', 'M-GL': '#64AA78', 'M-YL': '#C8AA5A' };
          
          Object.keys(data).forEach(lineId => {
            const trains = data[lineId] || [];
            const color = colors[lineId] || '#9B7BB4';
            
            trains.forEach((t: any) => {
              const id = t.id || `${lineId}_${t.lat}_${t.lon}`;
              js += `\n(function(){ var id='${"${id}"}'; var lat=${"${t.lat}"}, lon=${"${t.lon}"}; seen[id]=true; if (window.trainMarkers && window.trainMarkers[id]) { window.trainMarkers[id].setLatLng([lat, lon]); } else { var iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="${color}" fill-opacity="0.95" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/><text x="14" y="19" text-anchor="middle" font-size="12" fill="white">🚇</text></svg>'; var tIcon = L.divIcon({ html: iconHtml, className: "", iconSize: [28, 28], iconAnchor: [14, 14] }); window.trainMarkers[id] = L.marker([lat, lon], {icon: tIcon}).addTo(trainLayer); } })();`;
            });
          });
          js += `\nfor (var k in window.trainMarkers){ if (!seen[k]) { try{ trainLayer.removeLayer(window.trainMarkers[k]); } catch(e){} delete window.trainMarkers[k]; } }\ntrue;`;
          webviewRef.current.injectJavaScript(js);
        }
      } catch (e) {}
    };

    fetchTrains();
    intervalId = setInterval(fetchTrains, 10000);
    return () => { if (intervalId) clearInterval(intervalId); };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
      <OnboardingModal visible={showOnboarding} onDone={handleOnboardingDone} />

      {/* MAP */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={[styles.map, { opacity: 0.99 }]}
          scrollEnabled={false} javaScriptEnabled domStorageEnabled mixedContentMode="always"
        />
        <Surface style={[styles.gpsPill, { backgroundColor: paperTheme.colors.surfaceVariant }]} elevation={2}>
          <View style={[styles.gpsDot, { backgroundColor: gpsLocation ? '#22c55e' : paperTheme.colors.primary }]} />
          <Text variant="labelSmall" style={{ color: gpsLocation ? '#22c55e' : paperTheme.colors.onSurfaceVariant }}>
            {gpsLocation ? (usingGps ? 'GPS Active' : 'Custom Origin') : 'Locating…'}
          </Text>
        </Surface>
      </View>

      {/* PANEL */}
      <Animated.View style={[styles.panelContainer, animatedPanelStyle]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.panel, { backgroundColor: paperTheme.colors.surface }]}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.dragPill, { backgroundColor: paperTheme.colors.onSurfaceVariant, opacity: 0.2 }]} />

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Animated.View entering={FadeIn.delay(200)} style={styles.badge}>
              <Text variant="labelMedium" style={{ color: paperTheme.colors.primary }}>🚀 Better Transit for Bengaluru</Text>
            </Animated.View>
            <Text variant="displaySmall" style={styles.heroTitle}>Move Faster, Save Smarter.</Text>
            <Text variant="bodyMedium" style={{ color: paperTheme.colors.onSurfaceVariant }}>
              Bengaluru's first community-driven transit app. Smart routing and live status.
            </Text>
          </View>

          {/* Inputs */}
          <View style={styles.inputStack}>
            <TextInput
              mode="outlined"
              label="From"
              placeholder="Current Location"
              value={originText}
              onChangeText={t => onTextChange(t, 'origin')}
              onFocus={() => { setActiveField('origin'); if (usingGps) setOriginText(''); }}
              onBlur={() => { if (!originCoords && !usingGps) resetToGps(); }}
              left={<TextInput.Icon icon="crosshairs-gps" color={usingGps ? '#22c55e' : undefined} onPress={resetToGps} />}
              style={styles.input}
            />

            <View style={styles.connectorRow}>
              <IconButton 
                icon="swap-vertical" 
                size={20} 
                onPress={() => {
                  const tempText = originText, tempCoords = originCoords;
                  setOriginText(destText); setOriginCoords(destCoords); setUsingGps(false);
                  setDestText(tempText); setDestCoords(tempCoords);
                }}
              />
            </View>

            <TextInput
              mode="outlined"
              label="Where to?"
              placeholder="e.g. Whitefield"
              value={destText}
              onChangeText={t => onTextChange(t, 'dest')}
              onFocus={() => setActiveField('dest')}
              right={suggestLoading ? <TextInput.Icon icon={() => <ActivityIndicator size={20} />} /> : <TextInput.Icon icon="map-marker-outline" />}
              style={styles.input}
            />

            {/* Suggestions */}
            {suggestions.length > 0 && activeField !== null && (
              <Surface style={styles.suggestionBox} elevation={4}>
                {suggestions.map((s, i) => (
                  <View key={s.place_id}>
                    <Button
                      mode="text"
                      onPress={() => onSelectSuggestion(s)}
                      contentStyle={styles.suggestionItem}
                      labelStyle={{ textAlign: 'left' }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium" numberOfLines={1}>{s.display_name.split(',')[0]}</Text>
                        <Text variant="labelSmall" style={{ color: paperTheme.colors.onSurfaceVariant }} numberOfLines={1}>
                          {s.display_name.split(',').slice(1, 3).join(',')}
                        </Text>
                      </View>
                    </Button>
                    {i < suggestions.length - 1 && <View style={[styles.divider, { backgroundColor: paperTheme.colors.outlineVariant }]} />}
                  </View>
                ))}
              </Surface>
            )}
          </View>

          <Button
            mode="contained"
            onPress={searchRoutes}
            loading={loading}
            disabled={loading || !canSearch}
            style={styles.searchBtn}
            contentStyle={{ height: 56 }}
            icon="routes"
          >
            Find Routes
          </Button>

          {noRouteMsg ? (
            <Surface style={[styles.warnBox, { backgroundColor: paperTheme.colors.errorContainer }]} elevation={0}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={paperTheme.colors.error} />
              <Text variant="bodySmall" style={{ color: paperTheme.colors.onErrorContainer, marginLeft: 8 }}>{noRouteMsg}</Text>
            </Surface>
          ) : null}

          {/* Results */}
          {results && (
            <Animated.View layout={Layout.springify()} entering={FadeIn} style={styles.resultsWrap}>
              {results.routes && results.routes.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="transit-connection-variant" size={18} color={paperTheme.colors.primary} />
                    <Text variant="titleMedium" style={{ marginLeft: 8 }}>Public Transit</Text>
                  </View>
                  {results.routes.map((route: any, idx: number) => {
                    const dynamicTitle = route.labels?.length > 0 
                                         ? route.labels.join(" · ") 
                                         : `Option ${idx + 1}`;
                    return (
                      <TouchableOpacity key={idx} onPress={() => { setSelectedRouteIndex(idx); }}>
                        <View style={ idx === selectedRouteIndex ? { borderWidth: 2, borderColor: paperTheme.colors.primary, borderRadius: 12, padding: 8 } : { padding: 0 } }>
                          <JourneyCard data={route} title={dynamicTitle} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              {results.rides && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                    <MaterialCommunityIcons name="car-multiple" size={18} color={paperTheme.colors.tertiary} />
                    <Text variant="titleMedium" style={{ marginLeft: 8 }}>Cabs & Autos</Text>
                  </View>
                  <CabCard rides={results.rides} origin={fromCoords} dest={destCoords} />
                </>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { height: '30%', position: 'relative' },
  map: { width: '100%', height: '100%' },
  gpsPill: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },

  panelContainer: { flex: 1, marginTop: -24 },
  panel: {
    padding: 20, paddingTop: 12, paddingBottom: 60,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    minHeight: '70%',
  },
  dragPill: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  heroSection: { marginBottom: 24 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(112,59,218,0.1)',
    marginBottom: 8,
  },
  heroTitle: { fontWeight: '900', letterSpacing: -1, marginBottom: 4 },

  inputStack: { gap: 8, marginBottom: 20 },
  input: { backgroundColor: 'transparent' },
  connectorRow: { alignItems: 'center', height: 20, justifyContent: 'center' },

  suggestionBox: {
    borderRadius: 12,
    marginTop: -8,
    overflow: 'hidden',
  },
  suggestionItem: {
    justifyContent: 'flex-start',
    paddingVertical: 8,
  },
  divider: { height: 1 },

  searchBtn: { borderRadius: 16, marginTop: 8 },
  warnBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginTop: 16 },
  resultsWrap: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
});
