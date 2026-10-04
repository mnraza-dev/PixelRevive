import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../hooks/useThemeColor';
import { Typography } from '../constants/theme';

export interface ThemedTextProps extends TextProps {
  variant?: keyof typeof Typography;
  color?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'error' | 'warning';
}

export const ThemedText: React.FC<ThemedTextProps> = ({
  style,
  variant = 'body',
  color = 'primary',
  children,
  ...props
}) => {
  const { colors } = useTheme();

  const colorMap = {
    primary: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.accent,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
  };

  return (
    <Text
      style={[
        Typography[variant],
        { color: colorMap[color] },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};