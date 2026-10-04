import React, { useEffect, useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, cancelAnimation, ReduceMotion, useReducedMotion, Easing } from 'react-native-reanimated';
import { useEnhancement } from '../context/EnhancementContext';
import { useTheme } from '../hooks/useThemeColor';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { GlassSurface } from '../components/GlassSurface';
import { MotionPressable, Reveal } from '../components/Motion';
import { Button } from '../components/Button';
export default function ProcessingScreen() {
  const { activeJob, cancelActiveJob } = useEnhancement(); const { colors } = useTheme();
  const [elapsed, setElapsed] = useState(0); const startedAt = activeJob?.startedAt;
  const scan = useSharedValue(0); const progress = useSharedValue(0); const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) scan.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }), -1, true, undefined, ReduceMotion.System));
    return () => cancelAnimation(scan);
  }, [scan, reduced]);
  useEffect(() => { progress.set(withTiming(activeJob?.progress || 0, { duration: 700, reduceMotion: ReduceMotion.System })); }, [activeJob?.progress, progress]);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  const scanStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scan.get() * 280 }] }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.get()}%` }));
  const cancel = () => Alert.alert('Stop this edit?', 'Your free edit will not be used.', [{ text: 'Keep going', style: 'cancel' }, { text: 'Stop editing', style: 'destructive', onPress: () => { cancelActiveJob(); router.replace('/(tabs)/enhance'); } }]);
  if (!activeJob) return <ThemedView style={styles.screen}><SafeAreaView style={styles.center}><ThemedText variant="title3">Preparing your photo…</ThemedText></SafeAreaView></ThemedView>;
  const currentIndex = Math.max(0, activeJob.stages.indexOf(activeJob.currentStage));
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <View style={styles.header}><ThemedText variant="title3">A little photo magic</ThemedText><MotionPressable onPress={cancel} accessibilityLabel="Cancel processing"><GlassSurface style={{ padding: 12, borderRadius: 24 }}><Ionicons name="close" size={20} color={colors.text} /></GlassSurface></MotionPressable></View>
    <View style={styles.center}><Reveal style={{ width: '100%', maxWidth: 420 }}>
      <View style={styles.photo}><Image source={{ uri: activeJob.image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /><LinearGradient colors={['transparent', 'rgba(16,17,22,0.35)']} style={StyleSheet.absoluteFill} />
        {!reduced && <Animated.View pointerEvents="none" style={[styles.scan, scanStyle]}><LinearGradient colors={['transparent', 'rgba(255,255,255,0.22)']} style={{ height: 45 }} /><View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.8)' }} /></Animated.View>}
        <View style={styles.percent}><ThemedText style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>{activeJob.progress}%</ThemedText></View>
      </View>
      <ThemedText variant="title1" style={styles.title}>{activeJob.settings.mode === 'remove_bg' ? 'Finding your best side.' : 'Good things take a moment.'}</ThemedText><ThemedText variant="subhead" color="secondary" style={styles.description}>{activeJob.settings.mode === 'remove_bg' ? 'Separating your subject from the background.' : 'Bringing a little more clarity to your photo.'}</ThemedText>
      <GlassSurface style={{ padding: 22, marginTop: 26 }}><View style={styles.track}><Animated.View style={[styles.fill, { backgroundColor: colors.accent }, progressStyle]} /></View>
        <View style={{ gap: 16, marginTop: 22 }}>{activeJob.stages.map((stage, index) => <View style={styles.stage} key={stage}><Ionicons name={index < currentIndex || activeJob.progress === 100 ? 'checkmark-circle' : index === currentIndex ? 'ellipse' : 'ellipse-outline'} color={index <= currentIndex ? colors.accent : colors.textMuted} size={index === currentIndex ? 10 : 16} style={{ width: 18 }} /><ThemedText variant="subhead" color={index <= currentIndex ? 'primary' : 'muted'}>{activeJob.stages.length === 3 ? ['Preparing your image', 'Working on the details', 'Saving your photo'][index] : stage}</ThemedText></View>)}</View>
      </GlassSurface><ThemedText variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 18 }}>{elapsed}s elapsed · keep the app open</ThemedText>
    </Reveal></View><Button title="Cancel edit" variant="text" onPress={cancel} style={{ marginHorizontal: 24, marginBottom: 12 }} />
  </SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }, photo: { height: 280, width: '100%', borderRadius: 28, overflow: 'hidden', backgroundColor: '#242630' }, scan: { position: 'absolute', left: 0, right: 0, top: -45 }, percent: { position: 'absolute', right: 16, bottom: 16, backgroundColor: 'rgba(16,17,22,0.5)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }, title: { textAlign: 'center', marginTop: 26 }, description: { textAlign: 'center', marginTop: 8 }, track: { height: 4, backgroundColor: 'rgba(150,150,160,0.18)', borderRadius: 4, overflow: 'hidden' }, fill: { height: 4, borderRadius: 4 }, stage: { flexDirection: 'row', alignItems: 'center', gap: 12 } });
