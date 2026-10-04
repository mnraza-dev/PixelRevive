import React from 'react';
import { Pressable, type ViewProps, type ViewStyle } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { useTheme } from '../hooks/useThemeColor';
export interface CardProps extends ViewProps { onPress?: () => void; active?: boolean; bordered?: boolean; glow?: boolean; style?: ViewStyle }
export function Card({ children, onPress, active, bordered = true, glow, style, ...props }: CardProps) {
  const { colors } = useTheme();
  const content = <GlassSurface {...props} style={[{ padding: 20, borderWidth: bordered ? 1 : 0, borderColor: active || glow ? colors.accent : colors.surfaceBorder }, style]}>{children}</GlassSurface>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{content}</Pressable> : content;
}
