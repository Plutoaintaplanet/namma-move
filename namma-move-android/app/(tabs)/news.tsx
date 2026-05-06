import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, FlatList, Linking, TouchableOpacity, View } from 'react-native';
import { 
  Text, 
  Surface, 
  useTheme, 
  ActivityIndicator, 
  IconButton, 
  Chip,
  Divider
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

const API_URL = 'https://nammamove-backend-api.vercel.app/api';

const CATEGORY_COLORS: any = {
    BMTC: { bg: 'rgba(0, 168, 168, 0.1)', color: '#00A86B' },
    Metro: { bg: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' },
    Integration: { bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316' },
    Update: { bg: 'rgba(45, 95, 93, 0.1)', color: '#2D5F5D' },
};

export default function NewsScreen() {
    const theme = useTheme();
    const [news, setNews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All');

    const fetchNews = async () => {
        try {
            const res = await fetch(`${API_URL}/news`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            setNews(data.items || []);
        } catch (error) {
            console.warn('News Fetch Error:', error);
            setNews([
                { id: 1, title: 'Offline Mode Active', summary: 'Showing cached or fallback information.', date: new Date().toLocaleDateString(), cat: 'Update', source: 'System' }
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

    const categories = useMemo(() => {
        const base = ['All', 'BMTC', 'Metro', 'Integration', 'Update'];
        const fromData = [...new Set(news.map(a => a.cat))];
        return [...new Set([...base, ...fromData])].filter(c => c && c !== 'undefined');
    }, [news]);

    const visible = useMemo(() => 
        filter === 'All' ? news : news.filter((a) => a.cat === filter),
        [filter, news]
    );

    if (loading && news.length === 0) {
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text variant="bodyMedium" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>Fetching transit updates...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text variant="headlineSmall" style={{ fontWeight: '900' }}>Transit News</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Latest from BMTC and Namma Metro</Text>
                </View>
                <IconButton icon="refresh" onPress={onRefresh} loading={refreshing} />
            </View>

            {/* Filters */}
            <View style={styles.filterContainer}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={categories}
                    keyExtractor={item => item}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                    renderItem={({ item }) => (
                        <Chip 
                            selected={filter === item} 
                            onPress={() => setFilter(item)}
                            showSelectedCheck={false}
                            mode="outlined"
                            style={{ borderRadius: 99 }}
                        >
                            {item}
                        </Chip>
                    )}
                />
            </View>

            <FlatList
                data={visible}
                keyExtractor={(item, idx) => item.url || String(idx)}
                contentContainerStyle={styles.list}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={({ item, index }) => {
                    const catStyle = CATEGORY_COLORS[item.cat] || CATEGORY_COLORS.Update;
                    return (
                        <Animated.View entering={FadeInUp.delay(index * 50)} layout={Layout.springify()}>
                            <TouchableOpacity
                                onPress={() => item.url ? Linking.openURL(item.url) : null}
                                activeOpacity={0.7}
                            >
                                <Surface style={styles.card} elevation={1}>
                                    <View style={styles.cardHeader}>
                                        <Surface style={[styles.badge, { backgroundColor: catStyle.bg }]} elevation={0}>
                                            <Text variant="labelSmall" style={{ color: catStyle.color, fontWeight: 'bold' }}>{item.cat}</Text>
                                        </Surface>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.date}</Text>
                                    </View>
                                    <Text variant="titleMedium" style={styles.title}>{item.title}</Text>
                                    {item.summary && (
                                        <Text variant="bodySmall" style={styles.summary} numberOfLines={2}>{item.summary}</Text>
                                    )}
                                    <View style={styles.cardFooter}>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>📡 {item.source}</Text>
                                        <MaterialCommunityIcons name="arrow-top-right" size={16} color={theme.colors.primary} />
                                    </View>
                                </Surface>
                            </TouchableOpacity>
                        </Animated.View>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 16 },
    filterContainer: { marginBottom: 16 },
    list: { padding: 16, paddingTop: 0, gap: 16, paddingBottom: 100 },
    card: {
        borderRadius: 16,
        padding: 16,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    title: { fontWeight: '700', lineHeight: 22, marginBottom: 8 },
    summary: { color: 'rgba(0,0,0,0.6)', marginBottom: 12 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
