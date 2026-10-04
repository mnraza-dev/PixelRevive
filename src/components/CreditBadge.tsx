import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { MotionPressable } from './Motion';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useThemeColor';
export interface CreditBadgeProps { credits: number; onPress?: () => void; size?: 'sm' | 'md' }
export function CreditBadge({ credits, onPress, size = 'md' }: CreditBadgeProps) {
  const { colors } = useTheme();
  const content = <GlassSurface style={{ borderRadius: 30, paddingHorizontal: size === 'sm' ? 12 : 16, paddingVertical: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="flash-outline" size={14} color={colors.accent} /><ThemedText variant="subheadBold">{credits} free</ThemedText></View></GlassSurface>;
  return onPress ? <MotionPressable onPress={onPress} accessibilityLabel={`${credits} free edits remaining. View your account`}>{content}</MotionPressable> : content;
}
