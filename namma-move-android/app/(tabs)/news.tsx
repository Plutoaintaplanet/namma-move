import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, FlatList, RefreshControl, Linking, TouchableOpacity } from 'react-native';
import Colors from '@/constants/Colors';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const API_URL = 'https://www.nammamove.in.net/api'; // Live Vercel Production API

export default function NewsScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [news, setNews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNews = async () => {
        try {
            const res = await fetch(`${API_URL}/news`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            setNews(data.items || []);
        } catch (error) {
            console.warn('News Fetch Error:', error);
            // Fallback empty state
            setNews([
                { id: 1, title: 'Offline Mode Active', summary: 'Cannot connect to backend server. Showing cached information.', date: new Date().toLocaleDateString(), type: 'alert' }
            ]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNews();
    }, []);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.teal} />
                <Text style={{ color: theme.textMuted, marginTop: 12 }}>Fetching transit updates...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <FlatList
                data={news}
                keyExtractor={(item, idx) => item.url || String(idx)}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onPress={() => item.url ? Linking.openURL(item.url) : null}
                        activeOpacity={0.8}
                    >
                        <View style={styles.cardHeader}>
                            <View style={[styles.badge, { backgroundColor: item.cat === 'Metro' ? 'rgba(124,58,237,0.1)' : 'rgba(0,168,168,0.1)' }]}>
                                <Text style={[styles.badgeText, { color: item.cat === 'Metro' ? theme.purple : theme.tealDark }]}>
                                    {item.cat}
                                </Text>
                            </View>
                            <Text style={[styles.date, { color: theme.textMuted }]}>{item.date}</Text>
                        </View>
                        <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
                        <View style={styles.cardFooter}>
                            <Text style={[styles.source, { color: theme.textMuted }]}>{item.source}</Text>
                            <MaterialCommunityIcons name="arrow-top-right" size={16} color={theme.tealDark} />
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, gap: 14 },
    card: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
    badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    date: { fontSize: 11 },
    title: { fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 16 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    source: { fontSize: 12 },
});
