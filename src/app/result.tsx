import React, { useState } from 'react';
import { Alert, ScrollView, View, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useThemeColor';
import { useEnhancement } from '../context/EnhancementContext';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { GlassSurface } from '../components/GlassSurface';
import { MotionPressable, Reveal } from '../components/Motion';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { Button } from '../components/Button';
import { saveImage, shareImage } from '../services/image-export';
import { toolName } from '../constants/tools';
type Mode = 'split' | 'enhanced' | 'original';
export default function ResultScreen() {
  const { activeJob, setDraftImage } = useEnhancement(); const { colors } = useTheme(); const { width, height: screenHeight } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('split'); const [busy, setBusy] = useState<'save' | 'share' | null>(null); const [saved, setSaved] = useState(false);
  if (!activeJob?.result) return <ThemedView style={styles.screen}><SafeAreaView style={styles.empty}><ThemedText variant="title3">Nothing to show just yet.</ThemedText><Button title="Choose a photo" onPress={() => router.replace('/(tabs)/enhance')} /></SafeAreaView></ThemedView>;
  const { result, image } = activeJob; const imageHeight = Math.max(250, Math.min(screenHeight * 0.5, (Math.min(width, 640) - 44) * image.height / Math.max(1, image.width)));
  const exportImage = async (action: 'save' | 'share') => {
    if (busy) return;
    setBusy(action);
    try {
      if (action === 'save') { await saveImage(result.resultImageUrl); setSaved(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
      else await shareImage(result.resultImageUrl);
    } catch (error) { if (error instanceof Error && error.name === 'AbortError') return; Alert.alert(action === 'save' ? 'Could not save photo' : 'Could not share photo', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(null); }
  };
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.screen} edges={['top', 'bottom']}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={styles.header}><MotionPressable onPress={() => router.replace('/(tabs)')} accessibilityLabel="Back to studio"><GlassSurface style={styles.iconButton}><Ionicons name="arrow-back" size={20} color={colors.text} /></GlassSurface></MotionPressable><ThemedText variant="subheadBold">{toolName(activeJob.settings.mode)}</ThemedText><View style={styles.iconButton}><Ionicons name="checkmark-circle" size={24} color={colors.success} /></View></View>
    <Reveal><ThemedText variant="hero" style={{ marginTop: 14 }}>Ready to keep.</ThemedText><ThemedText color="secondary" style={{ marginTop: 8, marginBottom: 22 }}>{activeJob.settings.mode === 'remove_bg' ? 'Your subject. A clean slate.' : 'Same moment. A little more clarity.'}</ThemedText></Reveal>
    <GlassSurface style={styles.segment}>{(['split', 'enhanced', 'original'] as const).map(item => <MotionPressable key={item} style={{ flex: 1 }} accessibilityState={{ selected: mode === item }} onPress={() => setMode(item)}><View style={[styles.segmentItem, mode === item && { backgroundColor: colors.surfaceSubtle }]}><ThemedText variant="subheadBold" color={mode === item ? 'primary' : 'muted'}>{item === 'split' ? 'Compare' : item === 'enhanced' ? 'After' : 'Before'}</ThemedText></View></MotionPressable>)}</GlassSurface>
    <Animated.View key={mode} entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)} style={{ marginTop: 16 }}>
      {mode === 'split' ? <BeforeAfterSlider originalUri={image.uri} enhancedUri={result.resultImageUrl} height={imageHeight} contentFit="contain" /> : <View style={[styles.photo, { height: imageHeight, backgroundColor: activeJob.settings.mode === 'remove_bg' ? '#E0E2E6' : colors.surface }]}><Image source={{ uri: mode === 'original' ? image.uri : result.resultImageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" /></View>}
    </Animated.View>
    <ThemedText variant="caption" color="muted" style={styles.hint}>{result.isDemoResult ? 'Sample result · demo mode' : mode === 'split' ? 'Drag the divider to take a closer look' : activeJob.settings.mode === 'remove_bg' ? 'The PNG preserves your transparent background' : 'Your finished photo, in full resolution'}</ThemedText>
    <GlassSurface style={styles.details}><View><ThemedText variant="caption" color="muted">RESOLUTION</ThemedText><ThemedText variant="subheadBold" style={{ marginTop: 4 }}>{result.width} × {result.height}</ThemedText></View><View style={{ width: 1, height: 28, backgroundColor: colors.divider }} /><View><ThemedText variant="caption" color="muted">FILE TYPE</ThemedText><ThemedText variant="subheadBold" style={{ marginTop: 4 }}>PNG</ThemedText></View><View style={{ width: 1, height: 28, backgroundColor: colors.divider }} /><View><ThemedText variant="caption" color="muted">READY IN</ThemedText><ThemedText variant="subheadBold" style={{ marginTop: 4 }}>{((result.processingTimeMs || 0) / 1000).toFixed(1)}s</ThemedText></View></GlassSurface>
    <View style={{ marginTop: 26, gap: 12 }}><Button title={saved ? 'Saved to your photos' : 'Save photo'} size="lg" loading={busy === 'save'} disabled={busy === 'share'} onPress={() => exportImage('save')} icon={<Ionicons name={saved ? 'checkmark' : 'download-outline'} size={21} color="#FFF" />} /><Button title="Share this moment" variant="secondary" loading={busy === 'share'} disabled={busy === 'save'} onPress={() => exportImage('share')} icon={<Ionicons name="share-outline" size={20} color={colors.text} />} /><Button title="Try another photo" variant="text" onPress={() => { setDraftImage(null); router.replace('/(tabs)/enhance'); }} /></View>
  </ScrollView></SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, empty: { flex: 1, justifyContent: 'center', padding: 30, gap: 20 }, content: { paddingHorizontal: 22, paddingBottom: 30, width: '100%', maxWidth: 640, alignSelf: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }, iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, segment: { flexDirection: 'row', padding: 5, borderRadius: 20 }, segmentItem: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 15 }, photo: { overflow: 'hidden', borderRadius: 28 }, hint: { textAlign: 'center', marginTop: 12, marginBottom: 20 }, details: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 } });
