import React, { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useEnhancement } from '../../context/EnhancementContext';
import { useTheme } from '../../hooks/useThemeColor';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { Button } from '../../components/Button';
import { GlassSurface, StudioBlurTarget } from '../../components/GlassSurface';
import { MotionPressable, Reveal } from '../../components/Motion';
import { BeforeAfterSlider } from '../../components/BeforeAfterSlider';
import { CreditBadge } from '../../components/CreditBadge';
import { ImagePickerService } from '../../services/image-picker';
import { TOOLS } from '../../constants/tools';
const portrait = require('../../../assets/photos/natural-portrait.jpg');
const memory = require('../../../assets/photos/family.jpg');

export default function HomeScreen() {
  const { user } = useAuth(); const { colors } = useTheme();
  const { history, setDraftImage, openHistoryJob } = useEnhancement();
  const [picking, setPicking] = useState(false); const photoTarget = useRef<View | null>(null);
  const pick = async () => {
    setPicking(true);
    try {
      const image = await ImagePickerService.pickImage();
      if (!image?.uri) return;
      setDraftImage({ id: `img_${Date.now()}`, userId: user?.id || 'guest', uri: image.uri, originalFilename: image.originalFilename || 'photo.jpg', mimeType: image.mimeType || 'image/jpeg', width: image.width || 1080, height: image.height || 1080, fileSize: image.fileSize, createdAt: Date.now() });
      router.push({ pathname: '/(tabs)/enhance', params: { mode: 'auto' } });
    } catch (error) { Alert.alert('Could not open photos', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setPicking(false); }
  };
  return <ThemedView style={styles.screen}>
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}><View style={[styles.mark, { backgroundColor: colors.text }]}><Ionicons name="aperture" size={21} color={colors.background} /></View><ThemedText variant="title3" style={{ letterSpacing: -0.7 }}>PixelRevive</ThemedText></View>
          <CreditBadge credits={user?.creditsRemaining || 0} size="sm" onPress={() => router.push('/(tabs)/profile')} />
        </View>
        <Reveal><ThemedText variant="hero" style={styles.headline}>Keep the moment.{ '\n' }Lose the blur.</ThemedText><ThemedText color="secondary" style={styles.subtitle}>A fresh look at your favorite photos.</ThemedText></Reveal>
        <Reveal delay={80}>
          <View style={styles.hero}>
            <StudioBlurTarget ref={photoTarget}><BeforeAfterSlider sample height={340} /></StudioBlurTarget>
            <GlassSurface appearance="dark" target={photoTarget} style={styles.heroBadge}><Ionicons name="scan-outline" size={16} color="#FFF" /><ThemedText style={{ color: '#FFF', fontSize: 12, lineHeight: 18 }}>Slide to see the difference</ThemedText></GlassSurface>
          </View>
          <ThemedText color="muted" style={styles.previewNote}>Clarity preview · illustrative comparison</ThemedText>
          <Button title="Choose a photo" size="lg" onPress={pick} loading={picking} icon={<Ionicons name="add" size={22} color="#FFF" />} style={{ marginTop: 14 }} />
          <View style={styles.helper}><Ionicons name="checkmark-circle-outline" size={14} color={colors.textMuted} /><ThemedText color="muted" variant="caption">3 free edits every day · no account needed</ThemedText></View>
        </Reveal>
        <Reveal delay={160}>
          <View style={styles.sectionHeader}><ThemedText variant="title2">A tool for every photo</ThemedText><ThemedText variant="caption" color="muted">THE STUDIO</ThemedText></View>
          <View style={styles.grid}>
            {TOOLS.filter(tool => ['face_enhance', 'photo_restore', 'remove_bg', 'hd_upscale'].includes(tool.id)).map((tool, index) => <MotionPressable key={tool.id} style={styles.tool} onPress={() => router.push({ pathname: '/(tabs)/enhance', params: { mode: tool.id } })} accessibilityLabel={tool.label}>
              <GlassSurface style={{ padding: 8 }}>
                <View style={styles.toolImage}><Image source={index === 1 ? memory : portrait} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={index === 3 ? 'top' : 'center'} /><View style={[styles.toolTint, { backgroundColor: index === 2 ? 'rgba(76,120,112,0.24)' : 'rgba(16,17,22,0.12)' }]} /><View style={styles.toolIcon}><Ionicons name={tool.icon} color="#FFF" size={18} /></View></View>
                <ThemedText variant="bodyBold" style={{ paddingTop: 10, paddingHorizontal: 6 }}>{tool.label}</ThemedText><ThemedText color="secondary" variant="caption" style={{ paddingHorizontal: 6, paddingBottom: 8, paddingTop: 2 }}>{index === 0 ? 'Faces, back in focus' : index === 1 ? 'Memories, refreshed' : index === 2 ? 'Background, gone' : 'Details, made bigger'}</ThemedText>
              </GlassSurface>
            </MotionPressable>)}
          </View>
        </Reveal>
        <View style={styles.sectionHeader}><ThemedText variant="title2">Recently revived</ThemedText><MotionPressable onPress={() => router.push('/(tabs)/history')}><ThemedText color="secondary" variant="subheadBold">View all ↗</ThemedText></MotionPressable></View>
        {history.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{history.slice(0, 6).map(job => <MotionPressable key={job.id} onPress={() => { openHistoryJob(job.id); router.push('/result'); }}><Image source={{ uri: job.result?.resultImageUrl }} style={{ width: 112, height: 136, borderRadius: 20 }} contentFit="cover" /></MotionPressable>)}</ScrollView> : <GlassSurface style={styles.empty}><Ionicons name="images-outline" color={colors.textMuted} size={25} /><View style={{ flex: 1 }}><ThemedText variant="bodyBold">Your next favorite starts here.</ThemedText><ThemedText variant="subhead" color="secondary">Your finished photos will live in your library.</ThemedText></View></GlassSurface>}
      </ScrollView>
    </SafeAreaView>
  </ThemedView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { paddingHorizontal: 22, paddingBottom: 140, maxWidth: 640, width: '100%', alignSelf: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, mark: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, headline: { marginTop: 12, letterSpacing: -1.6 }, subtitle: { marginTop: 10, marginBottom: 24 }, hero: { overflow: 'hidden', borderRadius: 28 }, heroBadge: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22 }, previewNote: { textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: 9 }, helper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16, gap: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, tool: { width: '48%', flexGrow: 1 }, toolImage: { height: 120, overflow: 'hidden', borderRadius: 18 }, toolTint: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, toolIcon: { position: 'absolute', left: 10, bottom: 10, width: 32, height: 32, borderRadius: 12, backgroundColor: 'rgba(16,17,22,0.5)', alignItems: 'center', justifyContent: 'center' }, empty: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 } });
