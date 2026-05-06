import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface, useTheme, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../app/_layout';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

export default function ActiveJourneyBanner() {
    const theme = useTheme();
    const router = useRouter();
    const { activeJourney, setActiveJourney } = useApp();

    if (!activeJourney) return null;

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
                        <Text variant="labelSmall" style={{ color: '#ccc', marginLeft: 8 }}>🛰️ GPS Active</Text>
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
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { backgroundColor: '#22c55e', width: '40%' }]} />
                    </View>
                    <Text variant="labelSmall" style={{ color: '#22c55e', marginTop: 6 }}>Enroute • Traveling on {activeJourney.route?.cls === 'metro' ? 'Metro' : 'Bus'}</Text>
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
