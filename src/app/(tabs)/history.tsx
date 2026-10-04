import React from 'react';
import { Alert, FlatList, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEnhancement } from '../../context/EnhancementContext';
import { useTheme } from '../../hooks/useThemeColor';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { GlassSurface } from '../../components/GlassSurface';
import { MotionPressable, Reveal } from '../../components/Motion';
import { Button } from '../../components/Button';
import { toolName } from '../../constants/tools';
export default function HistoryScreen() {
  const { history, openHistoryJob, deleteHistoryItem } = useEnhancement(); const { colors } = useTheme(); const { width } = useWindowDimensions();
  const tileWidth = (Math.min(width, 640) - 56) / 2;
  return <ThemedView style={{ flex: 1 }}><SafeAreaView style={{ flex: 1 }} edges={['top']}><FlatList data={history} keyExtractor={item => item.id} numColumns={2} showsVerticalScrollIndicator={false} columnWrapperStyle={{ gap: 12 }} contentContainerStyle={styles.content}
    ListHeaderComponent={<Reveal style={styles.header}><ThemedText variant="caption" color="muted">YOUR FAVORITES, REVISITED</ThemedText><ThemedText variant="hero" style={{ marginTop: 8 }}>The library.</ThemedText><ThemedText color="secondary" style={{ marginTop: 8 }}>{history.length ? `${history.length} ${history.length === 1 ? 'moment' : 'moments'}, a little clearer.` : 'A home for the photos you bring back to life.'}</ThemedText></Reveal>}
    renderItem={({ item }) => <View style={{ width: tileWidth, marginBottom: 14 }}><MotionPressable onPress={() => { openHistoryJob(item.id); router.push('/result'); }} accessibilityLabel={`Open ${item.image.originalFilename}`}><GlassSurface style={{ padding: 7 }}><Image source={{ uri: item.result?.resultImageUrl || item.image.uri }} style={{ height: tileWidth * 1.18, borderRadius: 18 }} contentFit="cover" transition={150} /><View style={styles.tileMeta}><View style={{ flex: 1 }}><ThemedText variant="subheadBold">{toolName(item.settings.mode)}</ThemedText><ThemedText variant="caption" color="muted" style={{ marginTop: 3 }}>{new Date(item.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</ThemedText></View><MotionPressable accessibilityLabel={`Delete ${item.image.originalFilename}`} onPress={() => Alert.alert('Remove from library?', 'This removes the edit from your app library. Photos already saved to your device stay there.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { deleteHistoryItem(item.id).catch(() => Alert.alert('Could not remove photo', 'Please try again.')); } }])}><View style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} /></View></MotionPressable></View></GlassSurface></MotionPressable></View>}
    ListEmptyComponent={<Reveal delay={100}><GlassSurface style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSubtle }]}><Ionicons name="images-outline" color={colors.textSecondary} size={32} /></View><ThemedText variant="title2" style={{ marginTop: 24 }}>Make room for a memory.</ThemedText><ThemedText color="secondary" style={{ textAlign: 'center', marginTop: 10, marginBottom: 28 }}>Your first edit is one photo away.</ThemedText><Button title="Choose your first photo" onPress={() => router.push('/(tabs)/enhance')} /></GlassSurface></Reveal>} />
  </SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 22, paddingBottom: 140, maxWidth: 640, width: '100%', alignSelf: 'center' }, header: { paddingTop: 28, paddingBottom: 28 }, tileMeta: { paddingTop: 7, paddingLeft: 7, flexDirection: 'row', alignItems: 'center' }, empty: { padding: 28, alignItems: 'center', marginTop: 30 }, emptyIcon: { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center' } });
