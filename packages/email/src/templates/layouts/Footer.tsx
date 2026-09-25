// Footer with support contact, optional preferences link and a transactional-only note that reduces spam reports.

import { Link, Section, Text } from '@react-email/components'
import { colors, fonts, fontSizes, spacing } from '../../brand/tokens.ts'
import { Divider } from '../components/Divider.tsx'
import type { EmailBrandContext } from '../props.ts'

const line = {
  fontFamily: fonts.sans,
  fontSize: fontSizes.xs,
  lineHeight: '20px',
  color: colors.faint,
  margin: `0 0 ${spacing.xs}`,
}

const link = {
  color: colors.muted,
  textDecoration: 'underline',
}

export function Footer({ brand }: { brand: EmailBrandContext }) {
  return (
    <Section style={{ padding: `0 0 ${spacing.xl}` }}>
      <Divider />
      <Text style={line}>
        Questions? Reach us at{' '}
        <Link href={`mailto:${brand.supportEmail}`} style={link}>
          {brand.supportEmail}
        </Link>
        .
      </Text>
      <Text style={line}>
        You received this because it relates to your {brand.appName} account. We only send
        transactional email — never marketing.
        {brand.preferencesUrl !== undefined && (
          <>
            {' '}
            <Link href={brand.preferencesUrl} style={link}>
              Manage notification preferences
            </Link>
            .
          </>
        )}
      </Text>
      {/* No year: a literal goes stale and `new Date()` would make output non-deterministic. */}
      <Text style={line}>© {brand.appName}</Text>
    </Section>
  )
}
