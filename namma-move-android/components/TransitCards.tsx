import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export function CabCard({ cab }: { cab: any }) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    return (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderTopColor: theme.accent, borderTopWidth: 4 }]}>
            <View style={styles.cabRows}>

                {/* Auto */}
                <View style={styles.cabRow}>
                    <View style={styles.cabMode}>
                        <MaterialCommunityIcons name="rickshaw-electric" size={24} color={theme.text} />
                        <Text style={[styles.cabLabel, { color: theme.text }]}>Auto</Text>
                    </View>
                    <View style={styles.cabInfo}>
                        <Text style={[styles.cabTime, { color: theme.textMuted, backgroundColor: theme.border }]}>{cab.autoMin} min</Text>
                        <Text style={[styles.cabFare, { color: theme.text }]}>₹{cab.autoFare}</Text>
                        <View style={styles.btnGroup}>
                            <TouchableOpacity style={[styles.rideBtn, styles.olaBtn]} onPress={() => Linking.openURL('ola://')}>
                                <Text style={styles.rideBtnText}>Ola</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.rideBtn, styles.uberBtn]} onPress={() => Linking.openURL('uber://')}>
                                <Text style={styles.rideBtnText}>Uber</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                {/* Cab */}
                <View style={styles.cabRow}>
                    <View style={styles.cabMode}>
                        <MaterialCommunityIcons name="car" size={24} color={theme.text} />
                        <Text style={[styles.cabLabel, { color: theme.text }]}>Cab</Text>
                    </View>
                    <View style={styles.cabInfo}>
                        <Text style={[styles.cabTime, { color: theme.textMuted, backgroundColor: theme.border }]}>{cab.cabMin} min</Text>
                        <Text style={[styles.cabFare, { color: theme.text }]}>₹{cab.cabFare}</Text>
                        <View style={styles.btnGroup}>
                            <TouchableOpacity style={[styles.rideBtn, styles.olaBtn]} onPress={() => Linking.openURL('ola://')}>
                                <Text style={styles.rideBtnText}>Ola</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.rideBtn, styles.uberBtn]} onPress={() => Linking.openURL('uber://')}>
                                <Text style={styles.rideBtnText}>Uber</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                {/* Bike */}
                <View style={styles.cabRow}>
                    <View style={styles.cabMode}>
                        <MaterialCommunityIcons name="motorbike" size={24} color={theme.text} />
                        <Text style={[styles.cabLabel, { color: theme.text }]}>Bike</Text>
                    </View>
                    <View style={styles.cabInfo}>
                        <Text style={[styles.cabTime, { color: theme.textMuted, backgroundColor: theme.border }]}>{cab.bikeMin} min</Text>
                        <Text style={[styles.cabFare, { color: theme.text }]}>₹{cab.bikeFare}</Text>
                        <View style={styles.btnGroup}>
                            <TouchableOpacity style={[styles.rideBtn, styles.rapidoBtn]} onPress={() => Linking.openURL('rapido://')}>
                                <Text style={styles.rideBtnText}>Rapido</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

            </View>
        </View>
    );
}

export function JourneyCard({ data }: { data: any }) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const [expanded, setExpanded] = useState(false);

    if (!data) return null;

    const isMetro = data.cls === 'metro';
    const isCombo = data.cls === 'combo';
    const accentColor = isCombo ? '#0ea5e9' : isMetro ? theme.purple : theme.tealDark;
    const iconName = isCombo ? 'transit-transfer' : isMetro ? 'subway-variant' : 'bus';
    const label = isCombo ? 'Combo Route' : isMetro ? 'Namma Metro' : 'BMTC Bus';

    return (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderTopColor: accentColor, borderTopWidth: 4 }]}>

            {/* Summary Header */}
            <View style={[styles.summary, { borderBottomColor: theme.border }]}>
                <View style={styles.summaryLeft}>
                    <MaterialCommunityIcons name={iconName} size={32} color={accentColor} />
                    <View>
                        <Text style={[styles.jcardLabel, { color: theme.text }]}>{label}</Text>
                        <Text style={[styles.jcardSub, { color: theme.textMuted }]}>
                            {data.type === 'interchange' ? '1 change' : 'Direct'} • {data.hops} stops
                        </Text>
                    </View>
                </View>
                <View style={styles.summaryRight}>
                    <Text style={[styles.jcardTime, { color: theme.text }]}>{data.totalMins}<Text style={{ fontSize: 12, color: theme.textMuted }}> min</Text></Text>
                    <Text style={[styles.jcardWindow, { color: theme.textMuted }]}>{data.depart} → {data.arrive}</Text>
                    <View style={[styles.fareBadge, { backgroundColor: 'rgba(0,168,168,0.1)' }]}>
                        <Text style={[styles.fareText, { color: theme.tealDark }]}>₹{data.fare}</Text>
                    </View>
                </View>
            </View>

            {/* Timeline */}
            <View style={styles.timeline}>

                {/* Origin Walk */}
                <View style={styles.tlRow}>
                    <View style={styles.tlLineWrap}><View style={[styles.tlLine, { backgroundColor: theme.border }]} /></View>
                    <View style={[styles.tlDot, styles.tlWalk]} />
                    <View style={styles.tlBody}>
                        <Text style={[styles.tlLabel, { color: theme.text }]}>Walk ~{data.oStop.walkMin} min</Text>
                        <Text style={[styles.tlStop, { color: theme.textMuted }]}>to {data.oStop.name}</Text>
                    </View>
                </View>

                {/* Transit Legs */}
                {data.legs.map((leg: any, i: number) => {
                    const isLegMetro = leg.route.type === 1;
                    const legColor = isLegMetro ? theme.purple : theme.teal;
                    return (
                        <React.Fragment key={i}>
                            <View style={styles.tlRow}>
                                <View style={styles.tlLineWrap}><View style={[styles.tlLine, { backgroundColor: theme.border }]} /></View>
                                <View style={[styles.tlDot, { backgroundColor: legColor }]} />
                                <View style={styles.tlBody}>
                                    <Text style={[styles.tlLabel, { color: theme.text }]}>Board at {leg.stops[0].name}</Text>

                                    {/* Next Dep */}
                                    {i === 0 && data.nextDep && (
                                        <View style={styles.nextDepRow}>
                                            <View style={styles.pulseDot} />
                                            <Text style={[styles.nextDepText, { color: theme.textMuted }]}>{data.nextDep}</Text>
                                        </View>
                                    )}

                                    {/* Route Badge */}
                                    <View style={styles.routeRow}>
                                        <View style={[styles.routeBadge, { backgroundColor: isLegMetro ? 'rgba(124,58,237,0.15)' : 'rgba(0,168,168,0.15)' }]}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: isLegMetro ? theme.purple : theme.tealDark }}>{leg.route.name}</Text>
                                        </View>
                                        <Text style={[styles.stopsCount, { color: theme.textMuted }]} onPress={() => setExpanded(!expanded)}>
                                            {leg.stops.length - 1} stops {expanded ? '▲' : '▼'}
                                        </Text>
                                    </View>

                                    {/* Expanded Stops */}
                                    {expanded && (
                                        <View style={styles.expandedStops}>
                                            {leg.stops.slice(1, -1).map((s: any, j: number) => (
                                                <Text key={j} style={[styles.expandedStopText, { color: theme.textMuted }]}>• {s.name}</Text>
                                            ))}
                                        </View>
                                    )}

                                    <Text style={[styles.tlLabel, { color: theme.text, marginTop: 6 }]}>Alight at {leg.stops[leg.stops.length - 1].name}</Text>

                                </View>
                            </View>

                            {/* Transfer walk if multi-leg */}
                            {i < data.legs.length - 1 && (
                                <View style={styles.tlRow}>
                                    <View style={styles.tlLineWrap}><View style={[styles.tlLine, { backgroundColor: theme.border }]} /></View>
                                    <View style={[styles.tlDot, styles.tlWalk]} />
                                    <View style={styles.tlBody}>
                                        <Text style={[styles.tlLabel, { color: theme.text }]}>Change transport</Text>
                                    </View>
                                </View>
                            )}
                        </React.Fragment>
                    );
                })}

                {/* Dest Walk */}
                <View style={styles.tlRow}>
                    <View style={[styles.tlDot, styles.tlDest]} />
                    <View style={styles.tlBody}>
                        <Text style={[styles.tlLabel, { color: theme.text }]}>Walk ~{data.dStop.walkMin} min</Text>
                        <Text style={[styles.tlStop, { color: theme.textMuted }]}>to destination</Text>
                    </View>
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 18, borderWidth: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 6,
        marginBottom: 16, overflow: 'hidden'
    },
    summary: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
    summaryLeft: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    jcardLabel: { fontSize: 16, fontWeight: '700' },
    jcardSub: { fontSize: 12, marginTop: 2 },
    summaryRight: { alignItems: 'flex-end' },
    jcardTime: { fontSize: 24, fontWeight: '900', lineHeight: 28 },
    jcardWindow: { fontSize: 11, marginTop: 2 },
    fareBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    fareText: { fontSize: 12, fontWeight: '700' },

    timeline: { padding: 16, paddingTop: 6 },
    tlRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, position: 'relative' },
    tlLineWrap: { position: 'absolute', left: 7, top: 26, bottom: -6, width: 2, alignItems: 'center' },
    tlLine: { width: 2, height: '100%' },
    tlDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', marginTop: 2, backgroundColor: '#94a3b8', zIndex: 1 },
    tlWalk: { backgroundColor: '#e2e8f0', borderColor: '#94a3b8' },
    tlDest: { backgroundColor: '#f97316', borderColor: '#ea580c' },

    tlBody: { flex: 1 },
    tlLabel: { fontSize: 13, fontWeight: '700' },
    tlStop: { fontSize: 12 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    routeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
    stopsCount: { fontSize: 12, fontWeight: '600' },
    expandedStops: { paddingLeft: 8, marginTop: 4, gap: 2 },
    expandedStopText: { fontSize: 12 },

    nextDepRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
    nextDepText: { fontSize: 11, fontWeight: '600' },

    cabRows: { paddingHorizontal: 16, paddingVertical: 8 },
    cabRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    cabMode: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cabLabel: { fontSize: 14, fontWeight: '700' },
    cabInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cabTime: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 },
    cabFare: { fontSize: 16, fontWeight: '800' },
    divider: { height: 1, width: '100%' },
    btnGroup: { flexDirection: 'row', gap: 6 },
    rideBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
    rideBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    olaBtn: { backgroundColor: '#22c55e' },
    uberBtn: { backgroundColor: '#0f172a' },
    rapidoBtn: { backgroundColor: '#f97316' },
});
