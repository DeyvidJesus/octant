/**
 * Email footer: support contact, an optional preferences link, and the transactional-mail disclosure.
 *
 * The disclosure line matters legally and for deliverability: these are transactional messages tied to
 * an account action, so they carry no unsubscribe obligation — but saying so plainly reduces spam
 * reports, which is what actually protects the sending domain's reputation. When the caller has an
 * unsubscribe token we still surface a preferences link, because being able to find the setting is
 * better than guessing.
 */

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
      {/* No year: a hardcoded one goes stale, and `new Date()` would make rendered output
          non-deterministic and every snapshot test time-dependent. */}
      <Text style={line}>© {brand.appName}</Text>
    </Section>
  )
}
