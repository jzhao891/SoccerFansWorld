import { StyleSheet } from 'react-native';

export const colors = {
  // Grays
  black: '#111827',
  textPrimary: '#1F2937',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  bgSubtle: '#F9FAFB',
  white: '#fff',

  // Semantic
  open: '#16A34A',
  closed: '#DC2626',

  // Source badge — google
  googleBg: '#DBEAFE',
  googleText: '#1D4ED8',
  // Source badge — custom
  customBg: '#FFEDD5',
  customText: '#C2410C',
  // Source badge — merged
  mergedBg: '#DCFCE7',
  mergedText: '#15803D',

  // Marker pins
  pinGoogle: '#3B82F6',
  pinCustom: '#F97316',
  pinMerged: '#22C55E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 16,
  },
} as const;

export const pill = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
});
