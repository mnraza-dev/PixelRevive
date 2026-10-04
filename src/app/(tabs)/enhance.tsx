import React, { useState } from 'react';
import { Alert, ScrollView, View, StyleSheet, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useThemeColor';
import { useAuth } from '../../context/AuthContext';
import { useEnhancement } from '../../context/EnhancementContext';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { Button } from '../../components/Button';
import { GlassSurface } from '../../components/GlassSurface';
import { MotionPressable, Reveal } from '../../components/Motion';
import { EnhancementControls } from '../../components/EnhancementControls';
import { CreditBadge } from '../../components/CreditBadge';
import { ImagePickerService } from '../../services/image-picker';
import { TOOLS, toolName } from '../../constants/tools';
export default function EnhanceScreen() {
  const { colors } = useTheme(); const { user } = useAuth(); const insets = useSafeAreaInsets(); const { width } = useWindowDimensions();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { defaultSettings, draftImage: selectedImage, setDraftImage, startEnhancement } = useEnhancement();
  const requestedMode = TOOLS.find(tool => tool.id === mode)?.id || 'auto';
  const [choice, setChoice] = useState({ source: mode, settings: { ...defaultSettings, mode: requestedMode } });
  const settings = choice.source === mode ? choice.settings : { ...defaultSettings, mode: requestedMode };
  const [consentedImage, setConsentedImage] = useState<string | null>(null);
  const neuralProcessing = process.env.EXPO_PUBLIC_PROCESSING_PROVIDER === 'replicate';
  const [showAdvanced, setShowAdvanced] = useState(false); const [picking, setPicking] = useState(false); const [starting, setStarting] = useState(false);
  const pick = async (camera = false) => {
    setPicking(true);
    try {
      const image = camera ? await ImagePickerService.takePhoto() : await ImagePickerService.pickImage();
      if (!image?.uri) return;
      setDraftImage({ id: `img_${Date.now()}`, userId: user?.id || 'guest', uri: image.uri, originalFilename: image.originalFilename || 'photo.jpg', mimeType: image.mimeType || 'image/jpeg', width: image.width || 1080, height: image.height || 1080, fileSize: image.fileSize, createdAt: Date.now() });
    } catch (error) { Alert.alert('Could not select photo', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setPicking(false); }
  };
  const start = async () => {
    if (!selectedImage || starting) return;
    if (consentedImage !== selectedImage.id) { Alert.alert('Your permission matters', 'Please confirm that you agree to upload this photo for processing.'); return; }
    if (!user?.creditsRemaining) { Alert.alert('All done for today', 'Your free edits refresh tomorrow. Your existing photos are still in your library.'); return; }
    setStarting(true);
    try {
      const processing = startEnhancement(selectedImage, settings);
      router.push('/processing');
      await processing;
      router.replace('/result');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (error instanceof Error && error.message === 'Processing canceled.') return;
      Alert.alert('Could not finish this edit', error instanceof Error ? error.message : 'Please try again.');
      router.replace('/(tabs)/enhance');
    } finally { setStarting(false); }
  };
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: selectedImage ? 240 : 140 }]}>
      <View style={styles.header}><View><ThemedText variant="caption" color="muted">YOUR PHOTO STUDIO</ThemedText><ThemedText variant="title1" style={{ marginTop: 4 }}>{selectedImage ? toolName(settings.mode) : 'Start with a photo'}</ThemedText></View><CreditBadge credits={user?.creditsRemaining || 0} size="sm" /></View>
      {!selectedImage ? <>
        <Reveal><View style={styles.emptyPhoto}><Image source={require('../../../assets/photos/natural-portrait.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" /><View style={styles.photoShade} /><View style={styles.emptyCaption}><ThemedText style={{ color: '#FFF', fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.7 }}>A good photo.{ '\n' }An even better memory.</ThemedText></View></View></Reveal>
        <Reveal delay={80}><GlassSurface style={{ padding: 24, marginTop: 20, gap: 18 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Ionicons name="images-outline" color={colors.text} size={28} /><View style={{ flex: 1 }}><ThemedText variant="title3">Pick something worth keeping</ThemedText><ThemedText color="secondary" variant="subhead" style={{ marginTop: 4 }}>Portraits, old favorites, everyday moments.</ThemedText></View></View><Button title="Open photo library" onPress={() => pick()} loading={picking} icon={<Ionicons name="add" size={20} color="#FFF" />} /><Button title="Take a photo" variant="ghost" onPress={() => pick(true)} icon={<Ionicons name="camera-outline" size={18} color={colors.text} />} /></GlassSurface><ThemedText variant="caption" color="muted" style={styles.note}>JPG, PNG & WebP · up to 15 MB</ThemedText></Reveal>
      </> : <>
        <Reveal><View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surface, height: Math.min(width * 0.86, 360) }}><Image source={{ uri: selectedImage.uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={180} /><MotionPressable style={styles.replace} onPress={() => pick()} accessibilityLabel="Choose another photo"><GlassSurface style={{ padding: 12, borderRadius: 24 }}><Ionicons name="images-outline" size={18} color={colors.text} /></GlassSurface></MotionPressable></View><View style={styles.photoInfo}><ThemedText variant="caption" color="secondary">{selectedImage.width} × {selectedImage.height}</ThemedText><MotionPressable onPress={() => setDraftImage(null)}><ThemedText variant="caption" color="secondary">Remove photo</ThemedText></MotionPressable></View></Reveal>
        <View style={{ marginTop: 20 }}><EnhancementControls settings={settings} onChange={updates => setChoice({ source: mode, settings: { ...settings, ...updates } })} showAdvanced={showAdvanced} onToggleAdvanced={() => setShowAdvanced(!showAdvanced)} /></View>
        <MotionPressable accessibilityRole="checkbox" accessibilityState={{ checked: consentedImage === selectedImage.id }} onPress={() => setConsentedImage(consentedImage === selectedImage.id ? null : selectedImage.id)} style={{ marginTop: 20 }}>
          <GlassSurface style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ionicons name={consentedImage === selectedImage.id ? 'checkbox' : 'square-outline'} size={25} color={colors.accent} />
            <ThemedText variant="subhead" color="secondary" style={{ flex: 1 }}>{neuralProcessing ? 'I agree to upload this photo to the studio server and Replicate for AI processing.' : 'I agree to upload this photo to the studio server for processing.'} Originals are deleted after processing. Server results expire within 24 hours.</ThemedText>
          </GlassSurface>
        </MotionPressable>
        <ThemedText variant="caption" color="muted" style={styles.note}>{settings.mode === 'remove_bg' ? 'Your cutout saves as a PNG with a transparent background.' : 'Every photo is different. Severe blur or missing detail may not be recoverable.'}</ThemedText>
      </>}
    </ScrollView>
    {selectedImage && <View style={[styles.dock, { bottom: insets.bottom + 94 }]}><GlassSurface style={{ padding: 12, borderRadius: 26 }}><Button title={settings.mode === 'remove_bg' ? 'Remove background' : 'Enhance this photo'} size="lg" onPress={start} loading={starting} disabled={consentedImage !== selectedImage.id} icon={<Ionicons name={settings.mode === 'remove_bg' ? 'cut-outline' : 'sparkles-outline'} size={20} color="#FFF" />} /><ThemedText variant="caption" color="secondary" style={{ textAlign: 'center', marginTop: 8 }}>Uses 1 free edit · charged only after success</ThemedText></GlassSurface></View>}
  </SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { paddingHorizontal: 22, width: '100%', maxWidth: 640, alignSelf: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24 }, emptyPhoto: { height: 310, borderRadius: 28, overflow: 'hidden' }, photoShade: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(16,17,22,0.17)' }, emptyCaption: { position: 'absolute', bottom: 24, left: 24, right: 24 }, replace: { position: 'absolute', top: 12, right: 12 }, photoInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }, note: { marginTop: 20, textAlign: 'center', paddingHorizontal: 14, lineHeight: 18 }, dock: { position: 'absolute', left: 16, right: 16, maxWidth: 608, alignSelf: 'center' } });
