export const colors = {
  bg: '#070F1E',
  bgElevated: '#0A1727',
  panel: '#0E1B2C',
  panel2: '#152439',
  border: '#172A3A',
  accentBorder: '#1E668F',
  accent: '#62CCFF',
  accentSoft: '#0D2A3D',
  text: '#F7FAFC',
  muted: '#9AABBA',
  subtle: '#91A4B7',
  success: '#63D6A3',
  warning: '#F4BE73',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 40,
} as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const type = {
  hero: 32,
  title: 28,
  card: 18,
  body: 15,
  detail: 12,
  eyebrow: 10,
  section: 11,
  metric: 26,
} as const;

// Explicit leading keeps wrapped copy readable on native and web. Text continues
// to follow the device's font scale; layouts must make room instead of clipping it.
export const typography = {
  pageTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  hero: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: 0,
  },
  body: { fontSize: 15, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
  detail: { fontSize: 13, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0,
  },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  button: { fontSize: 15, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
  compactButton: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },
  input: { fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  metric: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
} as const;

// Shared layout rules keep text, card edges and tap targets consistent across tabs.
export const layout = {
  pageInset: 20,
  pageBottom: 148,
  cardInset: 16,
  sectionGap: 14,
  minTapHeight: 44,
} as const;
