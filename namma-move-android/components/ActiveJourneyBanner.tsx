import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text, Surface, useTheme, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../app/_layout';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import * as Location from 'expo-location';

// Calculate distance in meters using Haversine formula
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export default function ActiveJourneyBanner() {
    const theme = useTheme();
    const router = useRouter();
    const { activeJourney, setActiveJourney } = useApp();
    const [phase, setPhase] = useState(0);
    const [currentPos, setCurrentPos] = useState<{lat: number, lon: number} | null>(null);

    useEffect(() => {
        if (!activeJourney) return;

        let locationSubscription: Location.LocationSubscription | null = null;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    distanceInterval: 10,
                    timeInterval: 5000,
                },
                (location) => {
                    setCurrentPos({
                        lat: location.coords.latitude,
                        lon: location.coords.longitude
                    });
                }
            );
        })();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, [activeJourney]);

    useEffect(() => {
        if (!currentPos || !activeJourney) return;

        if (phase === 0) {
            const dist = getDistance(currentPos.lat, currentPos.lon, activeJourney.route?.oStop?.lat, activeJourney.route?.oStop?.lon);
            if (dist < 100) setPhase(1);
        } else if (phase === 1) {
            const dist = getDistance(currentPos.lat, currentPos.lon, activeJourney.route?.dStop?.lat, activeJourney.route?.dStop?.lon);
            if (dist < 100) setPhase(2);
        }
    }, [currentPos, phase, activeJourney]);

    if (!activeJourney) return null;

    const phases = [
        { title: `Walk to ${activeJourney.route?.oStop?.name || 'Station'}`, width: '20%' },
        { title: `Transit Ride`, width: '60%' },
        { title: `Walk to ${activeJourney.route?.dStop?.name || 'Destination'}`, width: '100%' }
    ];

    const currentPhase = phases[phase];

    const openNavigation = () => {
        const dest = phase === 0 ? activeJourney.route?.oStop : activeJourney.route?.dStop;
        if (dest && dest.lat && dest.lon) {
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}&travelmode=walking`);
        }
    };

    return (
        <Animated.View 
            entering={FadeInUp.springify().damping(15)} 
            exiting={FadeOutUp} 
            style={styles.container}
        >
            <Surface style={[styles.banner, { backgroundColor: '#1e1e1e' }]} elevation={4}>
                <View style={styles.header}>
                    <View style={styles.liveBadgeRow}>
                        <View style={styles.liveDot} />
                        <Text variant="labelMedium" style={{ color: '#fff', fontWeight: 'bold', marginLeft: 6 }}>Live Journey</Text>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22d3ee', marginLeft: 8, shadowColor: '#22d3ee', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 }} />
                        <Text variant="labelSmall" style={{ color: '#ccc', marginLeft: 4 }}>GPS Active</Text>
                    </View>
                    <TouchableOpacity onPress={() => setActiveJourney(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text variant="labelMedium" style={{ color: '#ef4444' }}>End Trip</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.body}>
                    <View style={{ flex: 1 }}>
                        <Text variant="titleMedium" style={{ color: '#fff', fontWeight: 'bold' }}>Arriving at {activeJourney.route?.dStop?.name || 'Destination'}</Text>
                        <Text variant="bodySmall" style={{ color: '#aaa', marginTop: 2 }}>{activeJourney.startTime} • {activeJourney.route?.arrive}</Text>
                    </View>
                    <Button 
                        mode="contained" 
                        icon="ticket-confirmation"
                        style={{ borderRadius: 8, backgroundColor: theme.colors.primary }}
                        labelStyle={{ fontSize: 12, marginHorizontal: 12 }}
                        onPress={() => router.push('/tickets')}
                    >
                        Tickets
                    </Button>
                </View>

                <View style={styles.progressContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text variant="labelSmall" style={{ color: '#22c55e', fontWeight: 'bold' }}>{currentPhase.title}</Text>
                        {phase < 2 && (
                            <TouchableOpacity onPress={() => setPhase(p => p + 1)}>
                                <Text variant="labelSmall" style={{ color: theme.colors.primary }}>Next Step ⏭️</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { backgroundColor: '#22c55e', width: currentPhase.width as any }]} />
                    </View>
                    
                    {(phase === 0 || phase === 2) && (
                        <Button 
                            mode="outlined" 
                            icon="map-marker-path"
                            style={{ marginTop: 12, borderColor: theme.colors.primary }}
                            textColor={theme.colors.primary}
                            onPress={openNavigation}
                        >
                            Start Navigation
                        </Button>
                    )}
                </View>
            </Surface>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        left: 16,
        right: 16,
        zIndex: 50
    },
    banner: {
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 8
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    liveBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444'
    },
    body: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    progressContainer: {
        marginTop: 4
    },
    progressTrack: {
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: 3
    }
});
