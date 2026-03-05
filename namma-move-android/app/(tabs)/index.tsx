import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, Image, Keyboard, Animated,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { JourneyCard, CabCard } from '@/components/TransitCards';
import OnboardingModal from '@/components/OnboardingModal';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://nammamove-backend-api.vercel.app/api';
const BANGALORE = { lat: 12.9716, lon: 77.5946 };

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

type ActiveField = 'origin' | 'dest' | null;

export default function PlannerScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];
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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [region, setRegion] = useState({ latitude: BANGALORE.lat, longitude: BANGALORE.lon });

  // ── Animation refs ───────────────────────────────────────────────────────────
  const panelSlide = useRef(new Animated.Value(40)).current;
  const panelFade = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const resultsFade = useRef(new Animated.Value(0)).current;
  const resultsSlide = useRef(new Animated.Value(20)).current;

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Panel entrance
  useEffect(() => {
    Animated.parallel([
      Animated.spring(panelSlide, { toValue: 0, useNativeDriver: true, tension: 65, friction: 9 }),
      Animated.timing(panelFade, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, []);

  // Onboarding check (show only once)
  useEffect(() => {
    SecureStore.getItemAsync('onboarding_done').then((val: string | null) => {
      if (!val) setShowOnboarding(true);
    }).catch(() => { });
  }, []);

  const handleOnboardingDone = () => {
    setShowOnboarding(false);
    SecureStore.setItemAsync('onboarding_done', '1').catch(() => { });
  };

  // ── Location ─────────────────────────────────────────────────────────────────
  const applyLocation = (lat: number, lon: number) => {
    const coords = { lat, lon };
    setGpsLocation(coords);
    setOriginCoords(coords);
    setRegion({ latitude: lat, longitude: lon });
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { applyLocation(BANGALORE.lat, BANGALORE.lon); return; }
        try {
          const last = await Location.getLastKnownPositionAsync({});
          if (last) applyLocation(last.coords.latitude, last.coords.longitude);
        } catch (_) { }
        try {
          const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          applyLocation(fresh.coords.latitude, fresh.coords.longitude);
        } catch (_) {
          if (!gpsLocation) applyLocation(BANGALORE.lat, BANGALORE.lon);
        }
      } catch (_) { applyLocation(BANGALORE.lat, BANGALORE.lon); }
    })();
  }, []);

  // ── Autocomplete ──────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) { setSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ' Bangalore')}&format=json&limit=5&countrycodes=in`,
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
      setRegion({ latitude: gpsLocation.lat, longitude: gpsLocation.lon });
    }
    setSuggestions([]); setActiveField(null); Keyboard.dismiss();
  };

  // ── Route Search ──────────────────────────────────────────────────────────────
  const searchRoutes = async () => {
    const from = usingGps ? gpsLocation : originCoords;
    if (!from) { setNoRouteMsg('Please set a starting location.'); return; }
    if (!destCoords) { setNoRouteMsg('Please select a destination from the suggestions.'); return; }
    setLoading(true); setResults(null); setNoRouteMsg('');

    // Pulse the button
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.94, duration: 100, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 5 }),
    ]).start();

    try {
      const res = await fetch(`${API_URL}/route?fromLat=${from.lat}&fromLon=${from.lon}&toLat=${destCoords.lat}&toLon=${destCoords.lon}`);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      if (!data.bus && !data.metro && !data.combo) setNoRouteMsg('No transit route found. Try the cab options.');
      setResults(data);
      // Animate results in
      resultsFade.setValue(0); resultsSlide.setValue(20);
      Animated.parallel([
        Animated.timing(resultsFade, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(resultsSlide, { toValue: 0, useNativeDriver: true, tension: 70, friction: 9 }),
      ]).start();
    } catch {
      setNoRouteMsg('Could not reach server. Check your connection.');
    } finally { setLoading(false); }
  };

  const fromCoords = usingGps ? gpsLocation : originCoords;
  const canSearch = !!fromCoords && !!destCoords;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <OnboardingModal visible={showOnboarding} onDone={handleOnboardingDone} />

      {/* MAP */}
      <View style={styles.mapContainer}>
        <WebView
          originWhitelist={['*']}
          source={{
            html: `<!DOCTYPE html><html><head>
              <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
              <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
              <style>body{padding:0;margin:0;}#map{height:100vh;width:100vw;}.leaflet-control-attribution{display:none!important;}
              ${isDark ? '.leaflet-layer{filter:invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);}' : ''}</style>
              </head><body><div id="map"></div><script>
              var map=L.map('map',{zoomControl:false}).setView([${region.latitude},${region.longitude}],14);
              L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
              var oIcon=L.divIcon({className:'',html:'<div style="background:#703BDA;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(112,59,218,0.6);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
              L.marker([${region.latitude},${region.longitude}],{icon:oIcon}).addTo(map);
              ${destCoords ? `
                var dIcon=L.divIcon({className:'',html:'<div style="background:#00D2D3;width:16px;height:16px;border-radius:4px;border:2px solid white;box-shadow:0 2px 8px rgba(0,210,211,0.6);transform:rotate(45deg);"></div>',iconSize:[16,16],iconAnchor:[8,8]});
                L.marker([${destCoords.lat},${destCoords.lon}],{icon:dIcon}).addTo(map);
                map.fitBounds([[${region.latitude},${region.longitude}],[${destCoords.lat},${destCoords.lon}]],{padding:[40,40]});
              ` : ''}
              </script></body></html>`
          }}
          style={[styles.map, { opacity: 0.99 }]}
          scrollEnabled={false} javaScriptEnabled domStorageEnabled mixedContentMode="always"
        />
        <View style={[styles.gpsPill, { backgroundColor: isDark ? 'rgba(18,26,47,0.88)' : 'rgba(255,255,255,0.92)', borderColor: theme.border }]}>
          <View style={[styles.gpsDot, { backgroundColor: gpsLocation ? '#22c55e' : theme.purple }]} />
          <Text style={[styles.gpsText, { color: gpsLocation ? '#22c55e' : theme.textMuted }]}>
            {gpsLocation ? (usingGps ? 'GPS Active' : 'Custom Origin') : 'Locating…'}
          </Text>
        </View>
      </View>

      {/* PANEL */}
      <Animated.View
        style={[
          { flex: 1, opacity: panelFade, transform: [{ translateY: panelSlide }] }
        ]}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.panel, {
            backgroundColor: isDark ? theme.surface : '#fff',
            borderColor: isDark ? theme.border : 'rgba(112,59,218,0.12)',
          }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.dragPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }]} />

          {/* Brand */}
          <View style={styles.brandRow}>
            <Image source={require('../../assets/images/icon.png')} style={styles.brandLogo} resizeMode="contain" />
            <View>
              <Text style={[styles.brandTitle, { color: theme.purple }]}>Plan Your Ride</Text>
              <Text style={[styles.brandSub, { color: theme.textMuted }]}>Bus · Metro · Cab — All in one</Text>
            </View>
          </View>

          {/* Inputs */}
          <View style={styles.inputStack}>

            {/* ── ORIGIN ── */}
            <View style={[styles.inputCard, {
              backgroundColor: isDark ? theme.panel : '#F5F3FF',
              borderColor: activeField === 'origin' ? theme.purple : (originCoords || usingGps ? '#22c55e' : 'rgba(112,59,218,0.2)'),
            }]}>
              <View style={[styles.inputDot, { backgroundColor: '#22c55e' }]} />
              <TextInput
                style={[styles.inputText, { color: theme.text }]}
                placeholder="From (current location)"
                placeholderTextColor={theme.textMuted}
                value={originText}
                onChangeText={t => onTextChange(t, 'origin')}
                onFocus={() => { setActiveField('origin'); if (usingGps) setOriginText(''); }}
                onBlur={() => { if (!originCoords && !usingGps) resetToGps(); }}
                returnKeyType="search"
                autoCorrect={false}
              />
              {/* GPS reset button */}
              <TouchableOpacity onPress={resetToGps} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={18}
                  color={usingGps ? '#22c55e' : theme.purple}
                />
              </TouchableOpacity>
            </View>

            {/* Connector */}
            <View style={styles.connectorRow}>
              <View style={[styles.connectorLine, { backgroundColor: 'rgba(112,59,218,0.25)' }]} />
              <TouchableOpacity
                onPress={() => {
                  // Swap origin ↔ destination
                  const tempText = originText, tempCoords = originCoords;
                  setOriginText(destText); setOriginCoords(destCoords); setUsingGps(false);
                  setDestText(tempText); setDestCoords(tempCoords);
                }}
                style={[styles.swapBtn, { backgroundColor: isDark ? theme.panel : '#F5F3FF', borderColor: 'rgba(112,59,218,0.2)' }]}
              >
                <MaterialCommunityIcons name="swap-vertical" size={18} color={theme.purple} />
              </TouchableOpacity>
            </View>

            {/* ── DESTINATION ── */}
            <View style={[styles.inputCard, {
              backgroundColor: isDark ? theme.panel : '#F5F3FF',
              borderColor: activeField === 'dest' ? theme.purple : (destCoords ? '#00D2D3' : 'rgba(112,59,218,0.2)'),
            }]}>
              <View style={[styles.inputDot, { backgroundColor: destCoords ? '#00D2D3' : theme.accent }]} />
              <TextInput
                style={[styles.inputText, { color: theme.text }]}
                placeholder="Where to? (e.g. Whitefield)"
                placeholderTextColor={theme.textMuted}
                value={destText}
                onChangeText={t => onTextChange(t, 'dest')}
                onFocus={() => setActiveField('dest')}
                returnKeyType="search"
                autoCorrect={false}
              />
              {suggestLoading && activeField === 'dest'
                ? <ActivityIndicator size="small" color={theme.purple} />
                : destCoords
                  ? <MaterialCommunityIcons name="check-circle" size={18} color="#00D2D3" />
                  : <MaterialCommunityIcons name="map-marker-outline" size={18} color={theme.accent} />
              }
            </View>

            {/* Suggestion Dropdown */}
            {suggestions.length > 0 && activeField !== null && (
              <View
                style={[styles.suggestionBox, {
                  backgroundColor: isDark ? theme.surface : '#fff',
                  borderColor: isDark ? theme.border : 'rgba(112,59,218,0.15)',
                }]}
              >
                {/* GPS button at top of origin suggestions */}
                {activeField === 'origin' && gpsLocation && (
                  <TouchableOpacity
                    style={[styles.suggestionItem, { borderBottomColor: isDark ? theme.border : 'rgba(0,0,0,0.06)', borderBottomWidth: 1 }]}
                    onPress={resetToGps}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#22c55e" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionMain, { color: '#22c55e' }]}>Use my current location</Text>
                      <Text style={[styles.suggestionSub, { color: theme.textMuted }]}>GPS — automatically detected</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={s.place_id}
                    style={[styles.suggestionItem, {
                      borderBottomColor: isDark ? theme.border : 'rgba(0,0,0,0.06)',
                      borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                    }]}
                    onPress={() => onSelectSuggestion(s)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="map-marker-outline" size={16} color={theme.purple} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionMain, { color: theme.text }]} numberOfLines={1}>
                        {s.display_name.split(',')[0]}
                      </Text>
                      <Text style={[styles.suggestionSub, { color: theme.textMuted }]} numberOfLines={1}>
                        {s.display_name.split(',').slice(1, 3).join(',')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Time Tabs */}
          <View style={styles.timeTabs}>
            {(['Leave now', 'Leave at', 'Arrive by'] as string[]).map((label, i) => (
              <TouchableOpacity key={label} style={[styles.timeTab, {
                backgroundColor: i === 0 ? theme.purple : (isDark ? theme.panel : '#F5F3FF'),
                borderColor: i === 0 ? theme.purple : 'rgba(112,59,218,0.2)',
              }]}>
                <Text style={[styles.timeTabText, { color: i === 0 ? '#fff' : theme.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Button – with animated scale */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[styles.searchBtn, { opacity: (loading || !canSearch) ? 0.65 : 1 }]}
              onPress={searchRoutes} disabled={loading || !canSearch} activeOpacity={0.82}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><MaterialCommunityIcons name="routes" size={20} color="#fff" /><Text style={styles.searchBtnText}>Find Routes</Text></>
              }
            </TouchableOpacity>
          </Animated.View>

          {/* Warning */}
          {noRouteMsg ? (
            <View style={[styles.warnBox, { backgroundColor: isDark ? 'rgba(255,154,0,0.1)' : '#FFF8F0', borderColor: 'rgba(255,154,0,0.3)' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.accent} />
              <Text style={[styles.warnText, { color: theme.accent }]}>{noRouteMsg}</Text>
            </View>
          ) : null}

          {/* Results – animated spring entrance */}
          {results && (
            <Animated.View style={[styles.resultsWrap, { opacity: resultsFade, transform: [{ translateY: resultsSlide }] }]}>
              {(results.metro || results.combo || results.bus) && (
                <>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons name="transit-connection-variant" size={18} color={theme.purple} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Public Transit</Text>
                  </View>
                  {results.metro && <JourneyCard data={results.metro} />}
                  {results.combo && <JourneyCard data={results.combo} />}
                  {results.bus && <JourneyCard data={results.bus} />}
                </>
              )}
              {results.cab && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                    <MaterialCommunityIcons name="car-multiple" size={18} color={theme.accent} />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Cabs & Autos</Text>
                  </View>
                  <CabCard cab={results.cab} />
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

  mapContainer: { height: '35%', position: 'relative' },
  map: { width: '100%', height: '100%' },
  gpsPill: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1, elevation: 6,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontSize: 12, fontWeight: '700' },

  panel: {
    padding: 20, paddingTop: 10, paddingBottom: 60,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, minHeight: '70%',
  },
  dragPill: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  brandLogo: { width: 48, height: 48 },
  brandTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  brandSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  inputStack: { gap: 0 },
  inputCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5,
  },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  inputText: { flex: 1, fontSize: 15, fontWeight: '500' },

  connectorRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, marginVertical: 4 },
  connectorLine: { width: 2, height: 20, marginRight: 8 },
  swapBtn: {
    marginLeft: 'auto', width: 32, height: 32, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  suggestionBox: {
    borderRadius: 14, borderWidth: 1, marginTop: 6, overflow: 'hidden',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  suggestionMain: { fontSize: 14, fontWeight: '600' },
  suggestionSub: { fontSize: 12, marginTop: 2 },

  timeTabs: { flexDirection: 'row', gap: 8, marginTop: 20 },
  timeTab: { flex: 1, height: 34, borderRadius: 99, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  timeTabText: { fontSize: 12, fontWeight: '700' },

  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 56, borderRadius: 18, marginTop: 20, backgroundColor: '#703BDA',
    shadowColor: '#703BDA', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 16 },
  warnText: { fontSize: 14, fontWeight: '600', flex: 1 },

  resultsWrap: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
});
