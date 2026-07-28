// DESIGN.md 기반 디자인 토큰 (단일 원천)
export const colors = {
  ink: '#111318', canvas: '#ffffff', muted: '#5b6270', line: '#e4e7ee',
  accent: '#2f6df6',
  blockLime: '#dceeb1', blockLilac: '#e7e3fb', blockCream: '#f5edd8',
  blockMint: '#cdeacf', blockCoral: '#f4d2c1',
} as const

export const typography = {
  displayXl: { fontSize: 86, fontWeight: 340, lineHeight: 1.0, letterSpacing: -1.72 },
  displayLg: { fontSize: 64, fontWeight: 340, lineHeight: 1.1, letterSpacing: -0.96 },
  headline:  { fontSize: 26, fontWeight: 540, lineHeight: 1.35, letterSpacing: -0.26 },
  body:      { fontSize: 18, fontWeight: 320, lineHeight: 1.45, letterSpacing: -0.26 },
  eyebrow:   { fontSize: 12, fontWeight: 700, lineHeight: 1.3, letterSpacing: 1.4 },
} as const

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, section: 96 } as const
export const radius = { sm: 6, md: 8, lg: 24, xl: 32, pill: 9999 } as const

export const fontStack = "-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', Inter, system-ui, sans-serif"
export const monoStack = "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace"
