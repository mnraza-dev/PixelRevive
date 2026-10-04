import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { ThemedText } from './ThemedText';

export interface BeforeAfterSliderProps { originalUri?: string; enhancedUri?: string; height?: number; sample?: boolean; contentFit?: 'cover' | 'contain' }
export function BeforeAfterSlider({ originalUri, enhancedUri, height = 420, sample = false, contentFit = 'cover' }: BeforeAfterSliderProps) {
  const [width, setWidth] = useState(320);
  const layoutWidth = useSharedValue(320);
  const position = useSharedValue(0.5);
  const start = useSharedValue(0.5);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) position.set(withTiming(0.5, { duration: 650, reduceMotion: ReduceMotion.System }));
  }, [originalUri, enhancedUri, reduced, position]);
  const gesture = Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-18, 18])
    .onBegin(() => { start.set(position.get()); })
    .onUpdate(event => { position.set(Math.max(0.02, Math.min(0.98, start.get() + event.translationX / layoutWidth.get()))); });
  const clip = useAnimatedStyle(() => ({ width: position.get() * layoutWidth.get() }));
  const handle = useAnimatedStyle(() => ({ left: position.get() * layoutWidth.get() - 22 }));
  const line = useAnimatedStyle(() => ({ left: position.get() * layoutWidth.get() - 1 }));
  const original = sample ? require('../../assets/photos/natural-portrait.jpg') : { uri: originalUri };
  const enhanced = sample ? require('../../assets/photos/natural-portrait.jpg') : { uri: enhancedUri };
  return <GestureDetector gesture={gesture}>
    <View style={[styles.container, { height }]} onLayout={event => { setWidth(event.nativeEvent.layout.width); layoutWidth.set(event.nativeEvent.layout.width); }}>
      <Image source={enhanced} style={StyleSheet.absoluteFill} contentFit={contentFit} transition={180} />
      <Animated.View style={[styles.clip, clip]} pointerEvents="none">
        <Image source={original} style={{ width, height }} contentFit={contentFit} blurRadius={sample ? 4 : 0} />
      </Animated.View>
      <Animated.View style={[styles.line, line]} pointerEvents="none" />
      <Animated.View style={[styles.handle, handle]} accessible accessibilityRole="adjustable" accessibilityLabel="Before and after comparison" accessibilityHint="Swipe horizontally to compare your images" accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => { position.set(withTiming(Math.max(0.02, Math.min(0.98, position.get() + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))), { duration: 150, reduceMotion: ReduceMotion.System })); }}>
        <Ionicons name="chevron-back" size={16} color="#242630" /><Ionicons name="chevron-forward" size={16} color="#242630" />
      </Animated.View>
      <View style={[styles.label, { left: 16 }]} pointerEvents="none"><ThemedText style={styles.labelText}>Before</ThemedText></View>
      <View style={[styles.label, { right: 16 }]} pointerEvents="none"><ThemedText style={styles.labelText}>After</ThemedText></View>
    </View>
  </GestureDetector>;
}
const styles = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: 28, backgroundColor: '#242630' },
  clip: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  line: { position: 'absolute', width: 2, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)' },
  handle: { position: 'absolute', top: '48%', height: 44, width: 44, borderRadius: 22, backgroundColor: '#FAFAFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  label: { position: 'absolute', top: 16, backgroundColor: 'rgba(16,17,22,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  labelText: { color: '#FFF', fontSize: 11, fontWeight: '600', lineHeight: 16 },
});
