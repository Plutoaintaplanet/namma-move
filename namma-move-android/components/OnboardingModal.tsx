import React, { useEffect, useState } from 'react';
import {
    View, StyleSheet, Modal, Dimensions,
} from 'react-native';
import { 
  Text, 
  Surface, 
  Button, 
  IconButton, 
  useTheme,
  Avatar
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  ScaleInCenter, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  Layout,
  FadeOut
} from 'react-native-reanimated';

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
        tip: 'Tap the GPS icon to reset origin',
    },
];

interface Props {
    visible: boolean;
    onDone: () => void;
}

export default function OnboardingModal({ visible, onDone }: Props) {
    const theme = useTheme();
    const [step, setStep] = useState(0);
    
    const iconScale = useSharedValue(0.8);
    const contentTranslateX = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setStep(0);
            iconScale.value = withSpring(1, { damping: 12, stiffness: 90 });
        }
    }, [visible]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconScale.value }]
    }));

    const goToStep = (newStep: number) => {
        const dir = newStep > step ? -1 : 1;
        contentTranslateX.value = dir * 50;
        contentTranslateX.value = withSpring(0, { damping: 15, stiffness: 100 });
        setStep(newStep);
        iconScale.value = 0.8;
        iconScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    };

    const handleNext = () => {
        if (step < STEPS.length - 1) goToStep(step + 1);
        else onDone();
    };

    const handleBack = () => {
        if (step > 0) goToStep(step - 1);
    };

    const current = STEPS[step];

    return (
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <Surface style={styles.card} elevation={5}>
                    {/* Icon Area */}
                    <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
                        <Avatar.Icon 
                          size={100} 
                          icon={current.icon} 
                          style={{ backgroundColor: current.bg }} 
                          color={current.color} 
                        />
                    </Animated.View>

                    {/* Content */}
                    <Animated.View key={step} entering={FadeIn} exiting={FadeOut} style={styles.content}>
                        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
                          {current.title}
                        </Text>
                        <Text variant="bodyMedium" style={[styles.desc, { color: theme.colors.onSurfaceVariant }]}>
                          {current.desc}
                        </Text>

                        <Surface style={[styles.tipBox, { backgroundColor: theme.colors.surfaceVariant, borderColor: current.color + '44' }]} elevation={0}>
                            <MaterialCommunityIcons name="lightbulb-on" size={16} color={current.color} />
                            <Text variant="labelSmall" style={{ color: current.color, flex: 1, fontWeight: '700' }}>{current.tip}</Text>
                        </Surface>
                    </Animated.View>

                    {/* Step Indicators */}
                    <View style={styles.indicators}>
                        {STEPS.map((_, i) => (
                            <View key={i} style={[
                              styles.dot, 
                              { 
                                width: i === step ? 24 : 8, 
                                backgroundColor: i === step ? current.color : theme.colors.outlineVariant 
                              }
                            ]} />
                        ))}
                    </View>

                    {/* Buttons */}
                    <View style={styles.btnRow}>
                        {step > 0 ? (
                            <IconButton 
                              icon="chevron-left" 
                              mode="outlined" 
                              onPress={handleBack} 
                              style={styles.backBtn}
                            />
                        ) : (
                            <Button onPress={onDone} labelStyle={{ color: theme.colors.onSurfaceVariant }}>Skip</Button>
                        )}
                        
                        <Button
                            mode="contained"
                            onPress={handleNext}
                            style={[styles.nextBtn, { backgroundColor: current.color }]}
                            contentStyle={{ paddingHorizontal: 16, height: 48 }}
                            icon={step < STEPS.length - 1 ? "chevron-right" : "check"}
                        >
                            {step < STEPS.length - 1 ? 'Next' : "Let's Go"}
                        </Button>
                    </View>
                </Surface>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%', borderRadius: 28, padding: 24,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 24,
    },
    content: { alignItems: 'center', width: '100%' },
    title: { fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
    desc: { textAlign: 'center', lineHeight: 22, marginBottom: 20 },
    tipBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1,
        width: '100%',
    },
    indicators: {
        flexDirection: 'row', gap: 6, marginVertical: 24, alignItems: 'center',
    },
    dot: { height: 8, borderRadius: 4 },
    btnRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%',
    },
    backBtn: { borderRadius: 12 },
    nextBtn: { borderRadius: 16 },
});
