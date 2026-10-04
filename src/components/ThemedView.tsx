import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../hooks/useThemeColor';

export interface ThemedViewProps extends ViewProps {
  variant?: 'background' | 'surface' | 'surfaceSubtle' | 'card';
}

export const ThemedView: React.FC<ThemedViewProps> = ({
  style,
  variant = 'background',
  children,
  ...props
}) => {
  const { colors } = useTheme();

  const bgMap = {
    background: 'transparent',
    surface: colors.surface,
    surfaceSubtle: colors.surfaceSubtle,
    card: colors.surface,
  };

  return (
    <View
      style={[
        { backgroundColor: bgMap[variant] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};