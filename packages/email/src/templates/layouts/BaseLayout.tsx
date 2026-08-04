/**
 * The single document shell every template renders inside.
 *
 * Every template is `<BaseLayout preview="…" brand={brand}> …body… </BaseLayout>`, so the `<Html>`,
 * `<Head>`, dark-mode meta tags, width constraint, header and footer exist in exactly one place.
 *
 * Email-client notes baked in here:
 *   • `color-scheme` / `supported-color-schemes` tell iOS Mail and Apple Mail we've already handled
 *     dark mode, which stops them force-inverting our palette into mud.
 *   • Every container repeats its `backgroundColor`. Gmail's dark-mode transform only leaves a colour
 *     alone when it is stated explicitly on the element.
 *   • The outer table carries a literal `width` as well as `maxWidth`, because Outlook's Word engine
 *     ignores `max-width` entirely.
 *   • `<Preview>` is mandatory. Without it the client shows the first words of the body as the inbox
 *     snippet, which for an action email is usually the fallback-link boilerplate.
 */

import { Body, Container, Head, Html, Preview, Section } from '@react-email/components'
import type { ReactNode } from 'react'
import { colors, fonts, layout, radii, spacing } from '../../brand/tokens.ts'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'
import type { EmailBrandContext } from '../props.ts'

export interface BaseLayoutProps {
  /** Inbox preview snippet. Keep under ~90 characters or clients truncate it mid-word. */
  preview: string
  brand: EmailBrandContext
  children: ReactNode
}

const body = {
  backgroundColor: colors.base,
  color: colors.ink2,
  fontFamily: fonts.sans,
  margin: '0',
  padding: '0',
  WebkitFontSmoothing: 'antialiased' as const,
}

const container = {
  width: layout.contentWidth,
  maxWidth: layout.contentWidth,
  margin: '0 auto',
  padding: `0 ${spacing.lg}`,
  backgroundColor: colors.base,
}

const card = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.edge}`,
  borderRadius: radii.lg,
  padding: spacing.xl,
}

export function BaseLayout({ preview, brand, children }: BaseLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Header brand={brand} />
          <Section style={card}>{children}</Section>
          <Footer brand={brand} />
        </Container>
      </Body>
    </Html>
  )
}
