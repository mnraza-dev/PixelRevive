import React, { useState } from 'react';
import { Alert, View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useThemeColor';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { BeforeAfterSlider } from '../../components/BeforeAfterSlider';
import { Button } from '../../components/Button';
import { Reveal } from '../../components/Motion';
export default function LoginScreen() {
  const { loginAsGuest } = useAuth(); const { colors } = useTheme(); const { height } = useWindowDimensions(); const [loading, setLoading] = useState(false);
  const enter = async () => {
    setLoading(true);
    try { await loginAsGuest(); }
    catch (error) { Alert.alert('Could not start your studio', error instanceof Error ? error.message : 'Please try again.'); setLoading(false); }
  };
  return <ThemedView style={{ flex: 1 }}><SafeAreaView style={{ flex: 1 }}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={styles.brand}><Ionicons name="aperture" size={26} color={colors.text} /><ThemedText variant="title3">PixelRevive</ThemedText></View>
    <Reveal><BeforeAfterSlider sample height={Math.min(height * 0.44, 380)} /></Reveal>
    <Reveal delay={100}><ThemedText variant="hero" style={styles.title}>Some moments{ '\n' }deserve a second look.</ThemedText><ThemedText color="secondary" style={styles.description}>Clearer portraits. Refreshed memories.{ '\n' }Your photos, beautifully brought back.</ThemedText></Reveal>
    <Reveal delay={180} style={{ marginTop: 'auto', paddingTop: 24 }}><Button title="Let’s bring one back" size="lg" loading={loading} onPress={enter} iconPosition="right" icon={<Ionicons name="arrow-forward" size={21} color="#FFF" />} /><ThemedText variant="caption" color="muted" style={styles.note}>3 free edits every day. No sign-up needed.</ThemedText><ThemedText variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 6 }}>Preview is illustrative. Your results depend on your photo.</ThemedText></Reveal>
  </ScrollView></SafeAreaView></ThemedView>;
}
const styles = StyleSheet.create({ content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24, maxWidth: 640, width: '100%', alignSelf: 'center' }, brand: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }, title: { fontSize: 34, lineHeight: 40, letterSpacing: -1.3, marginTop: 28 }, description: { marginTop: 12, lineHeight: 24 }, note: { textAlign: 'center', marginTop: 16 } });
