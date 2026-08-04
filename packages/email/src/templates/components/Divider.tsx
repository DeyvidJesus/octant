/**
 * Hairline rule. Wraps React Email's `Hr` so the border colour and vertical rhythm are defined once.
 */

import { Hr } from '@react-email/components'
import { colors, spacing } from '../../brand/tokens.ts'

export function Divider({ compact = false }: { compact?: boolean }) {
  return (
    <Hr
      style={{
        border: 'none',
        borderTop: `1px solid ${colors.edge}`,
        margin: `${compact ? spacing.md : spacing.lg} 0`,
        width: '100%',
      }}
    />
  )
}
