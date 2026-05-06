import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, useTheme, Button, Divider } from 'react-native-paper';
import { useApp } from '../_layout';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TicketsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { activeJourney, setActiveJourney } = useApp();

    if (!activeJourney) {
        return (
            <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="ticket-outline" size={64} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
                <Text variant="titleLarge" style={{ marginTop: 16, fontWeight: 'bold' }}>No Active Journey</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 32 }}>
                    Plan a journey and buy tickets to see them here.
                </Text>
                <Button mode="contained" onPress={() => router.push('/')}>Plan a Journey</Button>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.header}>
                <Text variant="titleMedium">Active Tickets</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{activeJourney.startTime}</Text>
            </View>

            {activeJourney.tickets.map((tkt: any, idx: number) => {
                const isMetro = tkt.mode === 'metro';
                return (
                    <Surface key={idx} style={styles.ticketCard} elevation={2}>
                        <View style={[styles.stub, { backgroundColor: isMetro ? theme.colors.primaryContainer : theme.colors.secondaryContainer }]}>
                            <MaterialCommunityIcons name={isMetro ? 'subway-variant' : 'bus'} size={24} color={isMetro ? theme.colors.primary : theme.colors.secondary} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{tkt.routeName}</Text>
                            </View>
                            <Text variant="labelSmall" style={{ opacity: 0.7 }}>Valid</Text>
                        </View>
                        <View style={styles.qrContainer}>
                            <MaterialCommunityIcons name="qrcode" size={120} color={theme.colors.onSurface} />
                            <Text variant="labelMedium" style={{ marginTop: 8, letterSpacing: 2 }}>{tkt.id}</Text>
                        </View>
                    </Surface>
                );
            })}

            <Button 
                mode="outlined" 
                style={styles.endBtn} 
                icon="check-circle-outline"
                onPress={() => setActiveJourney(null)}
            >
                End Journey
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    ticketCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: '#fff' },
    stub: { padding: 16, flexDirection: 'row', alignItems: 'center' },
    qrContainer: { padding: 32, alignItems: 'center', backgroundColor: '#fff' },
    endBtn: { marginTop: 16, borderRadius: 12, borderColor: '#ef4444' }
});
