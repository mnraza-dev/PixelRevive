import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, ReduceMotion } from 'react-native-reanimated';
import { GlassSurface } from './GlassSurface';
import { MotionPressable } from './Motion';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useThemeColor';
const icons = ['albums-outline', 'add-circle-outline', 'images-outline', 'person-outline'] as const;
const labels = ['Studio', 'Enhance', 'Library', 'You'];
export function StudioTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets(); const { width } = useWindowDimensions(); const { colors } = useTheme();
  const barWidth = Math.min(width - 40, 480); const itemWidth = (barWidth - 16) / state.routes.length;
  const x = useSharedValue(0);
  useEffect(() => { x.set(withSpring(state.index * itemWidth, { damping: 24, stiffness: 260, reduceMotion: ReduceMotion.System })); }, [state.index, itemWidth, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <View pointerEvents="box-none" style={[styles.position, { bottom: insets.bottom + 10 }]}>
    <GlassSurface style={{ width: barWidth, borderRadius: 28, padding: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
      <Animated.View pointerEvents="none" style={[styles.indicator, { width: itemWidth, backgroundColor: colors.surfaceSubtle }, indicator]} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return <MotionPressable key={route.key} style={{ flex: 1 }} accessibilityLabel={labels[index]} accessibilityState={{ selected: focused }} onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}>
            <View style={styles.item}><Ionicons name={icons[index]} size={23} color={focused ? colors.text : colors.textMuted} /><ThemedText style={{ fontSize: 10, lineHeight: 14, fontWeight: '600', color: focused ? colors.text : colors.textMuted }}>{labels[index]}</ThemedText></View>
          </MotionPressable>;
        })}
      </View>
    </GlassSurface>
  </View>;
}
const styles = StyleSheet.create({ position: { position: 'absolute', left: 0, right: 0, alignItems: 'center' }, row: { flexDirection: 'row' }, item: { minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3 }, indicator: { position: 'absolute', left: 8, top: 8, height: 54, borderRadius: 21 } });
