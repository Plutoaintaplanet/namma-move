import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const API_URL = 'http://10.0.2.2:4000/api'; // Android Emulator to host

export default function PlannerScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dummy Region for Bangalore initially
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
      setRegion(prev => ({ ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
    })();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* MAP SECTION */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={region}
          showsUserLocation
          showsMyLocationButton={false}
          userInterfaceStyle={colorScheme ?? 'dark'} // Enables dark mode maps implicitly based on system
        />

        {/* Floating pill over map */}
        <View style={[styles.floatingPill, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <MaterialCommunityIcons
            name={location ? "map-marker-check" : "map-marker-radius"}
            size={16}
            color={location ? "#22c55e" : theme.teal}
          />
          <Text style={[styles.pillText, { color: location ? "#22c55e" : theme.tealDark }]}>
            {location ? "Location set" : "Finding GPS..."}
          </Text>
        </View>
      </View>

      {/* PLANNER PANEL */}
      <View style={[styles.panel, { backgroundColor: theme.panel, borderColor: theme.border }]}>

        {/* Search Inputs */}
        <View style={styles.inputStack}>
          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Current Location"
              placeholderTextColor={theme.textMuted}
              editable={false} // For now, fixed to GPS
            />
          </View>
          <View style={styles.inputConnector} />
          <View style={styles.inputRow}>
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
              placeholder="Where to?"
              placeholderTextColor={theme.textMuted}
            />
          </View>
        </View>

        {/* Time Tabs */}
        <View style={styles.timeTabs}>
          <TouchableOpacity style={[styles.timeTab, { backgroundColor: theme.teal }]}>
            <Text style={[styles.timeTabText, { color: '#fff', fontWeight: 'bold' }]}>Leave now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.timeTab, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.timeTabText, { color: theme.textMuted }]}>Leave at</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.timeTab, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.timeTabText, { color: theme.textMuted }]}>Arrive by</Text>
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>Search Routes</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { flex: 1, position: 'relative' },
  map: { width: '100%', height: '100%' },
  floatingPill: {
    position: 'absolute', top: 16, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 99, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  pillText: { fontSize: 12, fontWeight: '800' },

  panel: {
    padding: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 20,
    marginTop: -24, // overlap map
  },
  inputStack: { gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  inputConnector: {
    position: 'absolute', left: 5, top: 22, bottom: 22, width: 2,
    backgroundColor: 'rgba(255,255,255,0.1)', zIndex: -1
  },
  input: {
    flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 16,
    borderWidth: 1, fontSize: 15, fontWeight: '500'
  },

  timeTabs: { flexDirection: 'row', gap: 8, marginTop: 20 },
  timeTab: {
    flex: 1, height: 36, borderRadius: 99, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  timeTabText: { fontSize: 13, fontWeight: '600' },

  searchBtn: {
    backgroundColor: '#00a8a8',
    height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#00a8a8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
});
