/** Chart palette for the app's dark surface. */
export const CHART = {
  surface: '#111111',
  grid: '#222222',
  axis: '#333333',
  tickMuted: '#888888',
  ink: '#cccccc',
  /** Primary single-series hue (data-viz dark series-1, blue). */
  series: '#3987e5',
  seriesSoft: 'rgba(57, 135, 229, 0.18)',
} as const

/** Status hues (fixed, never themed) for mutually-exclusive outcomes. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  neutral: '#3987e5',
  muted: '#666666',
} as const
