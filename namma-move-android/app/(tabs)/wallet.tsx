import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, useTheme, Button, Divider, IconButton } from 'react-native-paper';
import { useApp } from '../_layout';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function WalletScreen() {
    const theme = useTheme();
    const { walletBalance, setWalletBalance } = useApp();
    const [adding, setAdding] = useState(false);

    const addFunds = (amount: number) => {
        setAdding(true);
        setTimeout(() => {
            setWalletBalance((prev: number) => prev + amount);
            setAdding(false);
        }, 1000);
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ padding: 20 }}>
            {/* Balance Card */}
            <Surface style={styles.card} elevation={2}>
                <View style={styles.cardHeader}>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>Current Balance</Text>
                    <MaterialCommunityIcons name="wallet-outline" size={24} color={theme.colors.primary} />
                </View>
                <Text variant="displayMedium" style={{ fontWeight: '900', marginTop: 8 }}>₹{walletBalance.toFixed(2)}</Text>
                <View style={styles.cardFooter}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Autopay Active • Linked to UPI</Text>
                </View>
            </Surface>

            {/* Quick Top-Up */}
            <Text variant="titleMedium" style={{ marginTop: 24, marginBottom: 12, fontWeight: 'bold' }}>Quick Top-Up</Text>
            <View style={styles.topUpGrid}>
                {[50, 100, 200, 500].map(amt => (
                    <Button 
                        key={amt} 
                        mode="outlined" 
                        onPress={() => addFunds(amt)} 
                        style={styles.topUpBtn}
                        disabled={adding}
                    >
                        + ₹{amt}
                    </Button>
                ))}
            </View>

            <Button 
                mode="contained" 
                style={styles.actionBtn} 
                icon="plus-circle"
                loading={adding}
                onPress={() => addFunds(500)}
            >
                Add Custom Amount
            </Button>

            {/* Recent Transactions Placeholder */}
            <Text variant="titleMedium" style={{ marginTop: 32, marginBottom: 12, fontWeight: 'bold' }}>Recent Activity</Text>
            <Surface style={styles.historyCard} elevation={0}>
                <View style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                        <Surface style={[styles.historyIcon, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
                            <MaterialCommunityIcons name="arrow-down" size={20} color={theme.colors.primary} />
                        </Surface>
                        <View style={{ marginLeft: 12 }}>
                            <Text variant="titleSmall">Loaded via UPI</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Today, 09:41 AM</Text>
                        </View>
                    </View>
                    <Text variant="titleMedium" style={{ color: '#22c55e', fontWeight: 'bold' }}>+ ₹500</Text>
                </View>
                <Divider style={{ marginVertical: 12 }} />
                <View style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                        <Surface style={[styles.historyIcon, { backgroundColor: theme.colors.errorContainer }]} elevation={0}>
                            <MaterialCommunityIcons name="transit-connection-variant" size={20} color={theme.colors.error} />
                        </Surface>
                        <View style={{ marginLeft: 12 }}>
                            <Text variant="titleSmall">Metro Journey</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Yesterday, 06:15 PM</Text>
                        </View>
                    </View>
                    <Text variant="titleMedium">- ₹35</Text>
                </View>
            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: {
        borderRadius: 24, padding: 24, backgroundColor: '#ffffff',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardFooter: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
    topUpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    topUpBtn: { flexGrow: 1, borderRadius: 12 },
    actionBtn: { marginTop: 16, borderRadius: 16, paddingVertical: 4 },
    historyCard: { borderRadius: 16, padding: 16, backgroundColor: 'transparent' },
    historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyLeft: { flexDirection: 'row', alignItems: 'center' },
    historyIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }
});
