import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

export function useTheme() {
  const systemScheme = useColorScheme();
  // Default to dark theme for premium AI feel, or respect user preference
  const isDark = systemScheme !== 'light';
  const colors = isDark ? Colors.dark : Colors.light;

  return {
    isDark,
    colors,
    scheme: isDark ? ('dark' as const) : ('light' as const),
  };
}

export function useThemeColor(colorName: keyof typeof Colors.dark) {
  const { colors } = useTheme();
  return colors[colorName];
}
