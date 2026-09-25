// Monospaced block for codes and fallback links; `break-all` stops long URLs widening the layout past 600px.

import { Link, Section, Text } from '@react-email/components'
import { colors, fonts, fontSizes, radii, spacing } from '../../brand/tokens.ts'

export interface TokenBlockProps {
  /** The code or URL to display. */
  value: string
  /** When set, the value renders as a clickable link (used for fallback URLs). */
  href?: string
  /** Letter-spaced presentation for short numeric codes. */
  emphasis?: 'code' | 'url'
}

export function TokenBlock({ value, href, emphasis = 'url' }: TokenBlockProps) {
  const isCode = emphasis === 'code'
  const inner = {
    fontFamily: fonts.mono,
    fontSize: isCode ? fontSizes.xl : fontSizes.xs,
    lineHeight: isCode ? '30px' : '20px',
    letterSpacing: isCode ? '0.22em' : 'normal',
    color: isCode ? colors.ink : colors.ink3,
    textAlign: isCode ? ('center' as const) : ('left' as const),
    wordBreak: 'break-all' as const,
    margin: '0',
    textDecoration: 'none',
  }

  return (
    <Section
      style={{
        backgroundColor: colors.surface2,
        border: `1px solid ${colors.edge2}`,
        borderRadius: radii.md,
        padding: isCode ? spacing.md : '12px',
        margin: `0 0 ${spacing.md}`,
      }}
    >
      {href === undefined ? (
        <Text style={inner}>{value}</Text>
      ) : (
        <Link href={href} style={inner}>
          {value}
        </Link>
      )}
    </Section>
  )
}
