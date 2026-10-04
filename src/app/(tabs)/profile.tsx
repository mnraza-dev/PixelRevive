import React from 'react';
import { Alert, ScrollView, StyleSheet, View, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StorageService } from '../../services/storage';
import { useEnhancement } from '../../context/EnhancementContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useThemeColor';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { GlassSurface } from '../../components/GlassSurface';
import { MotionPressable, Reveal } from '../../components/Motion';
import { Button } from '../../components/Button';
export default function ProfileScreen() {
  const { user, logout } = useAuth(); const { colors } = useTheme();
  const { cancelActiveJob, refreshHistory } = useEnhancement();
  const openPage = (url: string | undefined, fallback: () => void) => {
    if (!url) { fallback(); return; }
    Linking.openURL(url).catch(() => Alert.alert('Could not open page', 'Please check your internet connection.'));
  };
  const credits = user?.creditsRemaining || 0;
  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; subtitle: string; action: () => void }[] = [
    { icon: 'images-outline', label: 'Your photo library', subtitle: 'Every moment you have revived', action: () => router.push('/(tabs)/history') },
    { icon: 'shield-checkmark-outline', label: 'Your photos & privacy', subtitle: 'You choose what to upload', action: () => openPage(process.env.EXPO_PUBLIC_PRIVACY_URL, () => Alert.alert('Your photos stay yours', 'The selected photo is sent to the image-processing server. Original uploads are deleted after processing; server results expire within 24 hours. Finished edits are stored in this app. If neural processing is enabled, your photo is also sent to Replicate.')) },
    { icon: 'help-circle-outline', label: 'A little help', subtitle: 'Get the most from your photos', action: () => openPage(process.env.EXPO_PUBLIC_SUPPORT_URL, () => Alert.alert('A better starting point', 'Use JPEG, PNG or WebP up to 15 MB. Well-lit photos with visible detail work best. Severe blur and missing detail cannot always be recovered. Keep the app open while processing. If a connection fails, check your internet connection and try again.')) },
    { icon: 'information-circle-outline', label: 'About PixelRevive', subtitle: 'Made for moments worth keeping', action: () => Alert.alert('PixelRevive · 1.0', 'A photo studio for enhancement, restoration, upscaling, color correction and transparent cutouts. Three free edits per day.') },
  ];
  return <ThemedView style={{ flex: 1 }}><SafeAreaView style={{ flex: 1 }} edges={['top']}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <Reveal><ThemedText variant="caption" color="muted">A SPACE OF YOUR OWN</ThemedText><ThemedText variant="hero" style={{ marginTop: 8 }}>Hello, {user?.isGuest ? 'you' : user?.name.split(' ')[0] || 'you'}.</ThemedText><ThemedText color="secondary" style={{ marginTop: 8, marginBottom: 28 }}>Good photos. No complicated account.</ThemedText>
    <GlassSurface style={styles.identity}><View style={[styles.avatar, { backgroundColor: colors.surfaceSubtle }]}><Ionicons name="person-outline" size={26} color={colors.text} /></View><View style={{ flex: 1 }}><ThemedText variant="title3">{user?.isGuest ? 'Your personal studio' : user?.name}</ThemedText><ThemedText variant="subhead" color="secondary" style={{ marginTop: 4 }}>{user?.isGuest ? 'Guest access · free plan' : user?.email}</ThemedText></View></GlassSurface></Reveal>
    <Reveal delay={100}><GlassSurface style={{ padding: 24, marginTop: 16 }}><View style={styles.between}><ThemedText variant="subheadBold" color="secondary">TODAY’S FREE EDITS</ThemedText><Ionicons name="flash-outline" color={colors.accent} size={20} /></View><View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 }}><ThemedText style={{ fontSize: 56, lineHeight: 64, letterSpacing: -3, fontWeight: '600' }}>{credits}</ThemedText><ThemedText color="secondary">of 3 remaining</ThemedText></View><View style={{ flexDirection: 'row', gap: 7, marginVertical: 18 }}>{[0, 1, 2].map(index => <View key={index} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: index < credits ? colors.accent : colors.surfaceSubtle }} />)}</View><ThemedText variant="subhead" color="secondary">Refreshes daily. Failed or canceled edits are free.</ThemedText></GlassSurface></Reveal>
    <View style={styles.stats}><View><ThemedText variant="title2">{user?.totalEnhancements || 0}</ThemedText><ThemedText variant="caption" color="secondary">PHOTOS REVIVED</ThemedText></View><View style={{ width: 1, height: 32, backgroundColor: colors.divider }} /><View><ThemedText variant="title2">Yours</ThemedText><ThemedText variant="caption" color="secondary">EVERY MOMENT</ThemedText></View></View>
    <GlassSurface style={{ padding: 8 }}>{rows.map((row, index) => <MotionPressable key={row.label} onPress={row.action}><View style={[styles.menuRow, index !== rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}><Ionicons name={row.icon} size={22} color={colors.textSecondary} /><View style={{ flex: 1 }}><ThemedText variant="bodyBold">{row.label}</ThemedText><ThemedText variant="caption" color="muted" style={{ marginTop: 3 }}>{row.subtitle}</ThemedText></View><Ionicons name="chevron-forward" size={16} color={colors.textMuted} /></View></MotionPressable>)}</GlassSurface>
    <Button title="Delete studio data" variant="text" style={{ marginTop: 24 }} onPress={() => Alert.alert('Delete your studio data?', 'This removes this device’s saved edits and guest profile. Photos saved to your camera roll stay there. Server results expire within 24 hours. Shared network limits still apply.', [{ text: 'Keep my data', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { cancelActiveJob(); await StorageService.clearAll(); await refreshHistory(); await logout(); } catch { Alert.alert('Could not delete data', 'Check your device storage and try again.'); } } }])} />
    <Button title="Leave guest session" variant="text" textStyle={{ color: colors.textSecondary }} style={{ marginTop: 24 }} onPress={() => Alert.alert('Leave this session?', 'You can return as a guest. Your edits stay in the library on this device.', [{ text: 'Stay here', style: 'cancel' }, { text: 'Leave', onPress: () => { logout().catch(() => Alert.alert('Could not leave session', 'Please try again.')); } }])} />
    <ThemedText variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 12 }}>PIXELREVIVE · PHOTO STUDIO</ThemedText>
  </ScrollView></SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 140, maxWidth: 640, width: '100%', alignSelf: 'center' }, identity: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }, avatar: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 32 }, menuRow: { paddingHorizontal: 12, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 14 } });
