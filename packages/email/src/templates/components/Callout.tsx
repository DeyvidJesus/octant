/**
 * A bordered notice block for warnings, confirmations and "wasn't you?" advice.
 *
 * Colours come from `toneStyles`, whose backgrounds are pre-blended opaque hex — email clients don't
 * reliably support alpha compositing, so `rgba()` over a dark surface is not an option.
 */

import { Section } from '@react-email/components'
import type { ReactNode } from 'react'
import { fonts, fontSizes, radii, spacing, toneStyles, type ToneValue } from '../../brand/tokens.ts'

export interface CalloutProps {
  children: ReactNode
  tone?: ToneValue
  title?: string
}

export function Callout({ children, tone = 'neutral', title }: CalloutProps) {
  const palette = toneStyles[tone]
  return (
    <Section
      style={{
        backgroundColor: palette.background,
        border: `1px solid ${palette.border}`,
        borderRadius: radii.md,
        padding: spacing.md,
        margin: `0 0 ${spacing.md}`,
      }}
    >
      {title !== undefined && (
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: fontSizes.sm,
            fontWeight: 600,
            lineHeight: '20px',
            color: palette.text,
            margin: `0 0 ${spacing.xs}`,
          }}
        >
          {title}
        </p>
      )}
      <div
        style={{
          fontFamily: fonts.sans,
          fontSize: fontSizes.sm,
          lineHeight: '22px',
          color: palette.text,
        }}
      >
        {children}
      </div>
    </Section>
  )
}
