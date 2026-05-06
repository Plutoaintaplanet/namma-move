import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { 
  Text, 
  Surface, 
  useTheme, 
  Button, 
  Divider,
  Avatar
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../app/_layout';
import Animated, { 
  FadeIn, 
  FadeOut, 
  Layout,
  useAnimatedStyle,
  withTiming,
  useSharedValue
} from 'react-native-reanimated';

export function CabCard({ cab }: { cab: any }) {
    const theme = useTheme();

    const CabItem = ({ icon, label, time, fare, providers }: any) => (
        <View style={styles.cabRow}>
            <View style={styles.cabMode}>
                <Avatar.Icon size={40} icon={icon} style={{ backgroundColor: theme.colors.surfaceVariant }} color={theme.colors.onSurfaceVariant} />
                <View style={{ marginLeft: 12 }}>
                    <Text variant="titleMedium">{label}</Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{time} min • ₹{fare}</Text>
                </View>
            </View>
            <View style={styles.btnGroup}>
                {providers.map((p: any) => (
                    <Button 
                        key={p.name}
                        mode="outlined" 
                        compact 
                        onPress={() => Linking.openURL(p.url)}
                        style={[styles.rideBtn, { borderColor: p.color }]}
                        labelStyle={{ color: p.color, fontSize: 10 }}
                    >
                        {p.name}
                    </Button>
                ))}
            </View>
        </View>
    );

    return (
        <Surface style={styles.card} elevation={1}>
            <View style={styles.cabRows}>
                <CabItem 
                    icon="rickshaw-electric" 
                    label="Auto" 
                    time={cab.autoMin} 
                    fare={cab.autoFare} 
                    providers={[
                        { name: 'Ola', url: 'ola://', color: '#22c55e' },
                        { name: 'Uber', url: 'uber://', color: '#000' }
                    ]} 
                />
                <Divider style={styles.divider} />
                <CabItem 
                    icon="car" 
                    label="Cab" 
                    time={cab.cabMin} 
                    fare={cab.cabFare} 
                    providers={[
                        { name: 'Ola', url: 'ola://', color: '#22c55e' },
                        { name: 'Uber', url: 'uber://', color: '#000' }
                    ]} 
                />
                <Divider style={styles.divider} />
                <CabItem 
                    icon="motorbike" 
                    label="Bike" 
                    time={cab.bikeMin} 
                    fare={cab.bikeFare} 
                    providers={[
                        { name: 'Rapido', url: 'rapido://', color: '#f97316' }
                    ]} 
                />
            </View>
        </Surface>
    );
}

export function JourneyCard({ data, title }: { data: any, title?: string }) {
    const theme = useTheme();
    const router = useRouter();
    const { walletBalance, setWalletBalance, setActiveJourney } = useApp();
    const [expanded, setExpanded] = useState(false);

    if (!data) return null;

    const isMetro = data.cls === 'metro';
    const isCombo = data.cls === 'combo';
    const accentColor = isCombo ? theme.colors.secondary : isMetro ? theme.colors.primary : '#00A8A8';
    const iconName = isCombo ? 'transit-transfer' : isMetro ? 'subway-variant' : 'bus';
    const label = title || (isCombo ? 'Combo Route' : isMetro ? 'Namma Metro' : 'BMTC Bus');

    const handleTravel = () => {
        if (walletBalance < data.fare) {
            Alert.alert("Insufficient Balance", "Please top up your wallet to continue.");
            return;
        }
        setWalletBalance((prev: number) => prev - data.fare);
        setActiveJourney({
            route: data,
            startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tickets: data.legs.map((l: any) => ({
                id: `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                mode: l.mode,
                routeName: l.route.name || "Transit"
            }))
        });
        router.push('/tickets');
    };

    return (
        <Surface style={styles.card} elevation={1}>
            {/* Summary Header */}
            <View style={styles.summary}>
                <View style={styles.summaryLeft}>
                    <Avatar.Icon size={48} icon={iconName} style={{ backgroundColor: accentColor + '20' }} color={accentColor} />
                    <View style={{ marginLeft: 12 }}>
                        <Text variant="titleMedium">{label}</Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {data.type === 'interchange' ? '1 change' : 'Direct'} • {data.hops} stops
                        </Text>
                    </View>
                </View>
                <View style={styles.summaryRight}>
                    <Text variant="headlineMedium" style={{ fontWeight: '900' }}>{data.totalMins}</Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>min</Text>
                    <Surface style={[styles.fareBadge, { backgroundColor: theme.colors.tertiaryContainer }]} elevation={0}>
                        <Text variant="labelSmall" style={{ color: theme.colors.onTertiaryContainer, fontWeight: 'bold' }}>₹{data.fare}</Text>
                    </Surface>
                </View>
            </View>

            <Divider />

            {/* Timeline */}
            <View style={styles.timeline}>
                {/* Transit Legs */}
                {data.legs.map((leg: any, i: number) => {
                    const isLegMetro = leg.route.type === 1;
                    const legColor = isLegMetro ? theme.colors.primary : theme.colors.secondary;
                    return (
                        <View key={i} style={styles.tlRow}>
                            <View style={styles.tlLineWrap}>
                                <View style={[styles.tlLine, { backgroundColor: theme.colors.outlineVariant }]} />
                            </View>
                            <View style={[styles.tlDot, { backgroundColor: legColor }]} />
                            <View style={styles.tlBody}>
                                <Text variant="labelMedium">Board at {leg.stops[0].name}</Text>
                                
                                <View style={styles.routeRow}>
                                    <Surface style={[styles.routeBadge, { backgroundColor: legColor + '20' }]} elevation={0}>
                                        <Text variant="labelSmall" style={{ color: legColor, fontWeight: 'bold' }}>{leg.route.name}</Text>
                                    </Surface>
                                    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                                            {leg.stops.length - 1} stops {expanded ? '▲' : '▼'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {expanded && (
                                    <Animated.View entering={FadeIn} exiting={FadeOut} layout={Layout.springify()}>
                                        {leg.stops.slice(1, -1).map((s: any, j: number) => (
                                            <Text key={j} variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>• {s.name}</Text>
                                        ))}
                                    </Animated.View>
                                )}

                                <Text variant="labelMedium" style={{ marginTop: 8 }}>Alight at {leg.stops[leg.stops.length - 1].name}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            <Divider />
            
            <View style={{ padding: 16 }}>
                <Button 
                    mode="contained" 
                    onPress={handleTravel} 
                    icon="rocket-launch-outline"
                    style={{ borderRadius: 12, backgroundColor: theme.colors.primary }}
                >
                    Let's Travel (Auto-pay ₹{data.fare || 0})
                </Button>
            </View>
        </Surface>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden'
    },
    summary: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
    summaryLeft: { flexDirection: 'row', alignItems: 'center' },
    summaryRight: { alignItems: 'flex-end' },
    fareBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },

    timeline: { padding: 16 },
    tlRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, position: 'relative' },
    tlLineWrap: { position: 'absolute', left: 7, top: 24, bottom: -8, width: 2, alignItems: 'center' },
    tlLine: { width: 2, height: '100%' },
    tlDot: { width: 16, height: 16, borderRadius: 8, marginTop: 2, zIndex: 1 },

    tlBody: { flex: 1 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    routeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    expandBtn: { padding: 4 },

    cabRows: { padding: 8 },
    cabRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
    cabMode: { flexDirection: 'row', alignItems: 'center' },
    btnGroup: { flexDirection: 'row', gap: 4 },
    rideBtn: { borderRadius: 8 },
    divider: { marginVertical: 4 }
});
