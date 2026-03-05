import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
    Modal, ScrollView, PanResponder,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = [
    {
        icon: 'map-marker-radius' as const,
        color: '#703BDA',
        bg: 'rgba(112,59,218,0.12)',
        title: 'Plan Any Journey',
        desc: "Enter where you're headed and we'll instantly find the best Bus, Metro, or Cab combo \u2014 just for you.",
        tip: 'Tap "Where to?" to get started',
    },
    {
        icon: 'transit-connection-variant' as const,
        color: '#00D2D3',
        bg: 'rgba(0,210,211,0.12)',
        title: 'Multi-Modal Routing',
        desc: 'We combine Namma Metro (Green, Purple & Yellow lines), thousands of BMTC buses, and cab options into one seamless journey.',
        tip: '8,300+ real stops powered by live data',
    },
    {
        icon: 'crosshairs-gps' as const,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.12)',
        title: 'Your Location, Your Rules',
        desc: 'We\'ll pick up your GPS automatically. Tap the crosshair icon anytime to reset your starting point, or type any custom origin.',
        tip: 'Tap ⊕ to set a custom start point',
    },
];

interface Props {
    visible: boolean;
    onDone: () => void;
}

export default function OnboardingModal({ visible, onDone }: Props) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = Colors[colorScheme ?? 'dark'];

    const [step, setStep] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const iconBounce = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    // Entrance animation when the modal appears
    useEffect(() => {
        if (visible) {
            setStep(0);
            Animated.parallel([
                Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
            ]).start();
            bounceIcon();
        } else {
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.88);
        }
    }, [visible]);

    // Bounce icon when step changes
    const bounceIcon = () => {
        iconBounce.setValue(0);
        Animated.spring(iconBounce, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 5,
        }).start();
    };

    const goToStep = (newStep: number) => {
        const dir = newStep > step ? -1 : 1;
        Animated.sequence([
            Animated.timing(slideAnim, { toValue: 40 * dir, duration: 120, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start();
        setStep(newStep);
        bounceIcon();
    };

    const handleNext = () => {
        if (step < STEPS.length - 1) goToStep(step + 1);
        else onDone();
    };

    const handleBack = () => {
        if (step > 0) goToStep(step - 1);
    };

    const iconScale = iconBounce.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.6, 1.15, 1],
    });

    const current = STEPS[step];

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: isDark ? '#1A1232' : '#FFFFFF',
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* Icon Area */}
                    <Animated.View style={[styles.iconCircle, { backgroundColor: current.bg, transform: [{ scale: iconScale }, { translateX: slideAnim }] }]}>
                        <MaterialCommunityIcons name={current.icon} size={52} color={current.color} />
                    </Animated.View>

                    {/* Content */}
                    <Animated.View style={[styles.content, { transform: [{ translateX: slideAnim }] }]}>
                        <Text style={[styles.title, { color: theme.text }]}>{current.title}</Text>
                        <Text style={[styles.desc, { color: theme.textMuted }]}>{current.desc}</Text>

                        <View style={[styles.tipBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: current.color + '33' }]}>
                            <MaterialCommunityIcons name="lightbulb-on" size={14} color={current.color} />
                            <Text style={[styles.tipText, { color: current.color }]}>{current.tip}</Text>
                        </View>
                    </Animated.View>

                    {/* Step Indicators */}
                    <View style={styles.indicators}>
                        {STEPS.map((_, i) => (
                            <TouchableOpacity key={i} onPress={() => goToStep(i)}>
                                <Animated.View style={[styles.dot, {
                                    width: i === step ? 24 : 8,
                                    backgroundColor: i === step ? current.color : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                                }]} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Buttons */}
                    <View style={styles.btnRow}>
                        {step > 0 ? (
                            <TouchableOpacity style={[styles.backBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]} onPress={handleBack}>
                                <MaterialCommunityIcons name="chevron-left" size={22} color={theme.textMuted} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={onDone}>
                                <Text style={[styles.skipText, { color: theme.textMuted }]}>Skip</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.nextBtn, { backgroundColor: current.color }]}
                            onPress={handleNext}
                            activeOpacity={0.82}
                        >
                            <Text style={styles.nextBtnText}>
                                {step < STEPS.length - 1 ? 'Next' : "Let's Go 🚀"}
                            </Text>
                            {step < STEPS.length - 1 && (
                                <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%', borderRadius: 28, padding: 28,
        shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25, shadowRadius: 30, elevation: 20,
        alignItems: 'center',
    },
    iconCircle: {
        width: 110, height: 110, borderRadius: 55,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
        borderWidth: 1.5, borderColor: 'transparent',
    },
    content: { alignItems: 'center', width: '100%' },
    title: { fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, marginBottom: 10 },
    desc: { fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 22, marginBottom: 18 },
    tipBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
        width: '100%',
    },
    tipText: { fontSize: 13, fontWeight: '700', flex: 1 },
    indicators: {
        flexDirection: 'row', gap: 6, marginTop: 28, marginBottom: 24, alignItems: 'center',
    },
    dot: { height: 8, borderRadius: 4 },
    btnRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%',
    },
    backBtn: {
        width: 44, height: 44, borderRadius: 14, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    skipText: { fontSize: 14, fontWeight: '600' },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16,
    },
    nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
