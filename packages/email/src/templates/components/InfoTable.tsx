/**
 * Label/value rows — invoice details, sign-in metadata, subscription facts.
 *
 * Rendered as a real `<table>` because that is the only layout primitive every email client agrees on.
 * Rows with an `undefined` value are dropped here rather than at each call site, which is what keeps
 * templates free of `{x !== undefined && ...}` noise and stops "undefined" ever reaching a recipient.
 */

import { Section } from '@react-email/components'
import { colors, fonts, fontSizes, radii, spacing } from '../../brand/tokens.ts'

export interface InfoRow {
  label: string
  value?: string | number
}

export interface InfoTableProps {
  rows: InfoRow[]
}

const cellBase = {
  fontFamily: fonts.sans,
  fontSize: fontSizes.sm,
  lineHeight: '22px',
  padding: '7px 0',
  verticalAlign: 'top' as const,
}

export function InfoTable({ rows }: InfoTableProps) {
  const visible = rows.filter(
    (row): row is InfoRow & { value: string | number } => row.value !== undefined && row.value !== '',
  )
  if (visible.length === 0) return null

  return (
    <Section
      style={{
        backgroundColor: colors.surface2,
        border: `1px solid ${colors.edge}`,
        borderRadius: radii.md,
        padding: `${spacing.sm} ${spacing.md}`,
        margin: `0 0 ${spacing.md}`,
      }}
    >
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
        <tbody>
          {visible.map((row) => (
            <tr key={row.label}>
              <td style={{ ...cellBase, color: colors.muted, width: '42%' }}>{row.label}</td>
              <td style={{ ...cellBase, color: colors.ink2, fontWeight: 500 }}>{String(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}
