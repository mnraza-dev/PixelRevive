// Photography first: neutral glass surfaces and one vivid coral accent.
export const Colors = {
  dark: {
    background: '#101116', backgroundSecondary: '#181A21', surface: '#22242C',
    surfaceSubtle: '#2C2E38', surfaceHover: '#343743',
    surfaceBorder: 'rgba(255,255,255,0.12)', surfaceBorderActive: 'rgba(255,94,103,0.6)',
    text: '#F7F7FA', textSecondary: '#B8BBC7', textMuted: '#8B90A1', textInverse: '#101116',
    accent: '#FF5E67', accentLight: '#FF9399', accentDark: '#E64650', accentGlow: 'rgba(255,94,103,0.12)',
    accentGradient: ['#FF7D85', '#FF5E67', '#EE4C58'] as const,
    cyanAccent: '#97C9C6', pinkAccent: '#DAB5A0',
    success: '#9BD5B3', successBg: 'rgba(155,213,179,0.12)',
    error: '#FF8086', errorBg: 'rgba(255,128,134,0.12)',
    warning: '#E5C793', warningBg: 'rgba(229,199,147,0.12)', info: '#97C9C6',
    cardBorder: 'rgba(255,255,255,0.1)', cardShadow: 'rgba(0,0,0,0.3)', divider: 'rgba(255,255,255,0.08)',
  },
  light: {
    background: '#F4F5F8', backgroundSecondary: '#EBEDF2', surface: '#FFFFFF',
    surfaceSubtle: '#E8EBF1', surfaceHover: '#DFE3EB',
    surfaceBorder: 'rgba(28,30,40,0.1)', surfaceBorderActive: 'rgba(233,67,80,0.5)',
    text: '#191C26', textSecondary: '#5C6374', textMuted: '#747C8D', textInverse: '#FFFFFF',
    accent: '#E94350', accentLight: '#E94350', accentDark: '#C52B38', accentGlow: 'rgba(233,67,80,0.09)',
    accentGradient: ['#FF7079', '#F34F5D', '#DF3543'] as const,
    cyanAccent: '#3B7774', pinkAccent: '#946652',
    success: '#35754E', successBg: 'rgba(53,117,78,0.09)',
    error: '#C52B38', errorBg: 'rgba(197,43,56,0.09)',
    warning: '#91713A', warningBg: 'rgba(145,113,58,0.09)', info: '#3B7774',
    cardBorder: 'rgba(28,30,40,0.08)', cardShadow: 'rgba(25,28,38,0.08)', divider: 'rgba(28,30,40,0.08)',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 38,
    fontWeight: '700' as const,
    lineHeight: 44,
    letterSpacing: -1.0,
  },
  title1: {
    fontSize: 26,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  title2: {
    fontSize: 21,
    fontWeight: '700' as const,
    lineHeight: 27,
    letterSpacing: -0.4,
  },
  title3: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 23,
    letterSpacing: 0.1,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 23,
    letterSpacing: 0.1,
  },
  subhead: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: 0.15,
  },
  subheadBold: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    letterSpacing: 0.15,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  // Unique: mono label for technical readouts (resolution, mode, time)
  mono: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'] as any,
  },
};
