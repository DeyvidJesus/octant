// Primary call to action; React Email's `Button` emits the table/VML scaffolding Outlook needs.

import { Button } from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import { colors, fonts, fontSizes, radii } from '../../brand/tokens.ts'

export interface ActionButtonProps {
  href: string
  children: ReactNode
  /** `primary` = brand accent, `neutral` = outlined, `danger` = destructive/urgent. */
  variant?: 'primary' | 'neutral' | 'danger'
}

const base: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: fontSizes.sm,
  fontWeight: 600,
  lineHeight: '20px',
  textDecoration: 'none',
  textAlign: 'center',
  borderRadius: radii.sm,
  // React Email handles Outlook's padding quirks; this padding is for every other client.
  padding: '12px 22px',
  display: 'inline-block',
}

const variants: Record<'primary' | 'neutral' | 'danger', CSSProperties> = {
  primary: {
    backgroundColor: colors.accent,
    color: colors.accentInk,
    border: `1px solid ${colors.accent}`,
  },
  neutral: {
    backgroundColor: colors.surface2,
    color: colors.ink,
    border: `1px solid ${colors.edge2}`,
  },
  danger: {
    backgroundColor: colors.danger,
    color: '#ffffff',
    border: `1px solid ${colors.danger}`,
  },
}

export function ActionButton({ href, children, variant = 'primary' }: ActionButtonProps) {
  return (
    <Button href={href} style={{ ...base, ...variants[variant] }}>
      {children}
    </Button>
  )
}
