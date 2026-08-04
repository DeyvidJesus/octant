/**
 * Typographic primitives.
 *
 * Thin wrappers over React Email's `Heading` / `Text` that bake in the brand tokens, so no template
 * ever writes a raw hex value or a font stack. Renamed (`EmailHeading`, `Paragraph`) to avoid shadowing
 * the upstream components they wrap.
 */

import { Heading, Text } from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import { colors, fonts, fontSizes, spacing } from '../../brand/tokens.ts'

export interface HeadingProps {
  children: ReactNode
  /** `1` for the single email title, `2` for section titles. */
  level?: 1 | 2
  style?: CSSProperties
}

const headingBase: CSSProperties = {
  fontFamily: fonts.sans,
  color: colors.ink,
  letterSpacing: '-0.02em',
  fontWeight: 600,
  margin: `0 0 ${spacing.md}`,
}

export function EmailHeading({ children, level = 1, style }: HeadingProps) {
  const sized: CSSProperties = {
    ...headingBase,
    fontSize: level === 1 ? fontSizes.xxl : fontSizes.xl,
    lineHeight: level === 1 ? '34px' : '28px',
    ...style,
  }
  return (
    <Heading as={level === 1 ? 'h1' : 'h2'} style={sized}>
      {children}
    </Heading>
  )
}

export interface ParagraphProps {
  children: ReactNode
  /** `muted` for supporting copy, `small` for fine print. */
  tone?: 'default' | 'muted' | 'small'
  style?: CSSProperties
}

const paragraphTones: Record<'default' | 'muted' | 'small', CSSProperties> = {
  default: { fontSize: fontSizes.base, lineHeight: '26px', color: colors.ink2 },
  muted: { fontSize: fontSizes.sm, lineHeight: '22px', color: colors.muted },
  small: { fontSize: fontSizes.xs, lineHeight: '20px', color: colors.faint },
}

export function Paragraph({ children, tone = 'default', style }: ParagraphProps) {
  return (
    <Text
      style={{
        fontFamily: fonts.sans,
        margin: `0 0 ${spacing.md}`,
        ...paragraphTones[tone],
        ...style,
      }}
    >
      {children}
    </Text>
  )
}

/** All-caps label used above metadata blocks. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: fonts.sans,
        fontSize: '11px',
        lineHeight: '16px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: colors.faint,
        margin: `0 0 ${spacing.sm}`,
      }}
    >
      {children}
    </Text>
  )
}
