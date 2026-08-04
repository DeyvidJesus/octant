/**
 * The Octant lockup: an accent-filled tile with the brand initial, next to the wordmark.
 *
 * Built from `Row`/`Column` (which render as `<table>/<tr>/<td>`) rather than flexbox, because Outlook
 * desktop uses the Word rendering engine and ignores `display: flex` entirely. Deliberately
 * asset-free — an `<Img>` would need a publicly hosted file, and images are blocked by default in most
 * clients, so a text lockup is the only mark guaranteed to render.
 */

import { Column, Row, Text } from '@react-email/components'
import { colors, fonts, fontSizes, radii, TEXT_SKIP_CLASS } from '../../brand/tokens.ts'

export interface LogoProps {
  appName: string
}

const tileCell = {
  width: '32px',
  verticalAlign: 'middle' as const,
}

const tile = {
  margin: '0',
  width: '32px',
  height: '32px',
  lineHeight: '32px',
  textAlign: 'center' as const,
  backgroundColor: colors.accent,
  color: colors.accentInk,
  borderRadius: radii.sm,
  fontFamily: fonts.sans,
  fontSize: fontSizes.lg,
  fontWeight: 600,
}

const wordmarkCell = {
  paddingLeft: '10px',
  verticalAlign: 'middle' as const,
}

const wordmark = {
  margin: '0',
  fontFamily: fonts.sans,
  fontSize: fontSizes.lg,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: colors.ink,
}

export function Logo({ appName }: LogoProps) {
  return (
    <Row>
      <Column style={tileCell}>
        {/* Purely decorative: the wordmark beside it already says the name, so the plain-text
            renderer skips this to avoid opening every email with a stray letter. */}
        <Text className={TEXT_SKIP_CLASS} style={tile}>
          {appName.charAt(0).toUpperCase()}
        </Text>
      </Column>
      <Column style={wordmarkCell}>
        <Text style={wordmark}>{appName}</Text>
      </Column>
    </Row>
  )
}
