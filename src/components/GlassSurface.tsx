import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import { useTheme } from '../hooks/useThemeColor';

const blurAvailable = Platform.OS === 'web' || !!requireOptionalNativeModule('ExpoBlur');
export const StudioBlurTarget = blurAvailable ? BlurTargetView : View;
const GlassContext = createContext<{ target: React.RefObject<View | null> | null; reduced: boolean }>({ target: null, reduced: false });

export function GlassEnvironment({ children }: { children: React.ReactNode }) {
  const target = useRef<View | null>(null);
  const { colors, isDark } = useTheme();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduced).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => subscription.remove();
  }, []);
  return (
    <GlassContext.Provider value={{ target, reduced }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StudioBlurTarget ref={target} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient colors={isDark ? ['#242630', '#101116', '#16171D'] : ['#FAFAFB', '#EEF0F4', '#E2E5EC']} style={StyleSheet.absoluteFill} />
          <View style={[styles.reflection, { backgroundColor: isDark ? '#3B3E4C' : '#FFFFFF' }]} />
        </StudioBlurTarget>
        {children}
      </View>
    </GlassContext.Provider>
  );
}
export interface GlassSurfaceProps extends ViewProps { target?: React.RefObject<View | null>; subtle?: boolean; appearance?: 'dark' | 'light' }
export function GlassSurface({ children, style, target, subtle = false, appearance, ...props }: GlassSurfaceProps) {
  const context = useContext(GlassContext);
  const theme = useTheme();
  const isDark = appearance ? appearance === 'dark' : theme.isDark;
  const colors = appearance ? Colors[appearance] : theme.colors;
  const liquid = Platform.OS === 'ios' && !context.reduced && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  return (
    <View {...props} style={[styles.surface, { borderColor: colors.surfaceBorder, backgroundColor: context.reduced ? colors.surface : 'transparent' }, style]}>
      {!context.reduced && (liquid
        ? <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        : blurAvailable ? <BlurView pointerEvents="none" intensity={subtle ? 30 : 65} tint={isDark ? 'dark' : 'light'} blurTarget={target ?? context.target ?? undefined} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} /> : null)}
      {!context.reduced && <LinearGradient pointerEvents="none" colors={isDark ? ['rgba(255,255,255,0.085)', 'rgba(30,31,38,0.76)'] : ['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.5)']} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderRadius: 24, borderWidth: 1 },
  reflection: { position: 'absolute', top: -150, left: '40%', height: 420, width: 100, transform: [{ rotate: '-35deg' }], opacity: 0.2 },
});
