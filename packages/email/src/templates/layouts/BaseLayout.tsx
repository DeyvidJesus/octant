// Document shell for every template. The color-scheme meta stops Apple Mail force-inverting the palette,
// and the explicit width covers Outlook, which ignores max-width.

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
