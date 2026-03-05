import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View, Text, Image } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

function LogoTitle() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={require('../../assets/images/icon.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
      <Text style={{ fontSize: 18, fontWeight: '900', color: theme.purple, letterSpacing: -0.3 }}>Namma Move</Text>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'dark'];
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.purple,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: isDark ? 'rgba(18,26,47,0.97)' : '#fff',
          borderTopColor: theme.border,
          borderTopWidth: 1,
          elevation: 20,
          shadowColor: '#703BDA',
          shadowOpacity: 0.15,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 12,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: isDark ? theme.surface : '#fff',
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '800' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => <LogoTitle />,
          title: 'Planner',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="map-search-outline" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          headerTitle: 'Transit News',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="newspaper-variant-outline" size={size + 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
