// Text-only lockup (initial tile + wordmark) in table cells: Outlook ignores flexbox and images are often blocked.

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
        {/* Decorative; skipped in plain text so emails don't open with a stray letter. */}
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
