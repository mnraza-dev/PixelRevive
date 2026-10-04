import React, { useEffect } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming, withDelay, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export function MotionPressable({ children, style, onPress, onPressIn, onPressOut, disabled, ...props }: Omit<PressableProps, 'style' | 'children'> & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const spring = { damping: 20, stiffness: 300, reduceMotion: ReduceMotion.System };
  return (
    <Animated.View style={[style, motion]}>
      <Pressable accessibilityRole="button" {...props} disabled={disabled} onPress={onPress}
        onPressIn={(event) => { scale.set(withSpring(0.975, spring)); if (!disabled) Haptics.selectionAsync().catch(() => {}); onPressIn?.(event); }}
        onPressOut={(event) => { scale.set(withSpring(1, spring)); onPressOut?.(event); }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
export function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const offset = useSharedValue(16);
  useEffect(() => { offset.set(withDelay(delay, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }), ReduceMotion.System)); }, [offset, delay]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  // Keep glass fully opaque: iOS Liquid Glass can fail when mounted at opacity 0.
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}
