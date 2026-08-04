/**
 * Octant's email design tokens.
 *
 * Mirrors the app theme in `src/styles/index.css` (dark, minimal, terminal-inspired) so an email looks
 * like the product it came from. The accent is `#863bff`, the purple already in `public/favicon.svg` —
 * previously the only brand-coloured asset and disconnected from everything else.
 *
 * Email-specific constraints these values respect:
 *   • Hex only. `oklch()`, `color-mix()` and CSS variables are unsupported in Outlook and stripped by
 *     Gmail, so the semantic names live here in TypeScript and resolve to literal hex at render time.
 *   • Every surface declares an explicit background. Gmail's and Outlook's dark-mode transforms only
 *     leave a colour alone if it was stated outright — omitting it produces unreadable grey-on-grey.
 *   • System font stack, matching `body` in the app. Webfonts in email are unreliable and slow.
 */

/**
 * Marks nodes that carry no meaning once styling is stripped, so the plain-text renderer drops them.
 * Lives here — at the bottom of the dependency graph — rather than in `renderer.ts`, because the
 * components that apply it would otherwise import the renderer that imports them.
 */
export const TEXT_SKIP_CLASS = 'octant-text-skip'

export const colors = {
  /** Outermost page background. */
  base: '#0a0a0a',
  /** Card / content background. */
  surface: '#111111',
  /** Nested surfaces: code blocks, info rows, callouts. */
  surface2: '#1a1a1a',
  /** Default hairline border. */
  edge: '#222222',
  /** Emphasised border. */
  edge2: '#333333',
  /** Primary text. */
  ink: '#ededed',
  /** Body copy. */
  ink2: '#cccccc',
  /** Secondary copy. */
  ink3: '#aaaaaa',
  /** Labels and metadata. */
  muted: '#888888',
  /** Footer / legal text. */
  faint: '#666666',
  /** Brand accent (from favicon.svg). */
  accent: '#863bff',
  /** Accent, pressed/darker variant. */
  accentDeep: '#7e14ff',
  /** Text on top of the accent. */
  accentInk: '#ffffff',
  /** Status colours, taken from `src/modules/metrics/chartTheme.ts` so charts and email agree. */
  success: '#0ca30c',
  warning: '#fab219',
  danger: '#d03b3b',
  info: '#3987e5',
} as const

export const fonts = {
  /** Identical to `body { font-family }` in src/styles/index.css. */
  sans:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  /** For tokens and one-time codes. */
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
} as const

export const fontSizes = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '22px',
  xxl: '28px',
} as const

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const

export const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  pill: '999px',
} as const

/** Constrains the content column. 600px is the widest safe value across desktop clients. */
export const layout = {
  contentWidth: '600px',
  /** Outlook ignores `max-width`, so tables also carry this as an explicit `width`. */
  contentWidthPx: 600,
} as const

/**
 * Semantic tone for callouts and status accents. An `as const` object rather than an enum, because the
 * tsconfig sets `erasableSyntaxOnly` (enums emit runtime code and are therefore banned).
 */
export const Tone = {
  Neutral: 'neutral',
  Success: 'success',
  Warning: 'warning',
  Danger: 'danger',
  Info: 'info',
} as const

export type ToneValue = (typeof Tone)[keyof typeof Tone]

/** Border/text/background triplet for each tone. Backgrounds are opaque — email has no alpha support
 *  worth relying on, so these are pre-blended against `surface`. */
export const toneStyles: Record<ToneValue, { border: string; text: string; background: string }> = {
  neutral: { border: colors.edge2, text: colors.ink2, background: colors.surface2 },
  success: { border: '#1c4a1c', text: '#7ee07e', background: '#0e1f0e' },
  warning: { border: '#5a4410', text: '#f5cd6a', background: '#211a08' },
  danger: { border: '#5a1f1f', text: '#f08a8a', background: '#210e0e' },
  info: { border: '#1d3a5c', text: '#8ec1f5', background: '#0c1724' },
}
