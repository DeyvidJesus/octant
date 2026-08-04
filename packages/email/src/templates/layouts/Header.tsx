/**
 * Email header: the brand lockup, above the content card.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { Logo } from '../components/Logo.tsx'
import type { EmailBrandContext } from '../props.ts'

export function Header({ brand }: { brand: EmailBrandContext }) {
  return (
    <Section style={{ padding: `${spacing.lg} 0 ${spacing.md}` }}>
      <Logo appName={brand.appName} />
    </Section>
  )
}
