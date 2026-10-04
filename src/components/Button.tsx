import React from 'react';
import { ActivityIndicator, View, StyleSheet, type TouchableOpacityProps, type ViewStyle, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useThemeColor';
import { ThemedText } from './ThemedText';
import { GlassSurface } from './GlassSurface';
import { MotionPressable } from './Motion';
export interface ButtonProps extends TouchableOpacityProps {
  title: string; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'text' | 'amber' | 'gradient';
  size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: React.ReactNode; iconPosition?: 'left' | 'right'; style?: ViewStyle; textStyle?: TextStyle;
}
export function Button({ title, variant = 'primary', size = 'md', loading, disabled, icon, iconPosition = 'left', style, textStyle, onPress, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const primary = ['primary', 'amber', 'gradient'].includes(variant);
  const ghost = variant === 'ghost' || variant === 'text';
  const content = <View style={[styles.content, { minHeight: size === 'sm' ? 44 : size === 'lg' ? 60 : 52, paddingHorizontal: size === 'sm' ? 16 : 24 }]}>
    {loading ? <ActivityIndicator color={primary ? '#FFF' : colors.text} /> : <>
      {iconPosition === 'left' && icon}
      <ThemedText variant={size === 'sm' ? 'subheadBold' : 'bodyBold'} style={[{ color: primary ? '#FFF' : colors.text, fontSize: size === 'lg' ? 17 : 14 }, textStyle]}>{title}</ThemedText>
      {iconPosition === 'right' && icon}
    </>}
  </View>;
  return <MotionPressable {...props} disabled={disabled || loading} onPress={onPress} accessibilityLabel={props.accessibilityLabel || title} accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }} style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
    {primary ? <LinearGradient colors={colors.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shell}>{content}</LinearGradient> : ghost ? content : <GlassSurface style={styles.shell}>{content}</GlassSurface>}
  </MotionPressable>;
}
const styles = StyleSheet.create({ shell: { borderRadius: 20, overflow: 'hidden' }, content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 } });
