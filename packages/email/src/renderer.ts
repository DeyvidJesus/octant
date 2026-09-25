// Renders a template to `{ subject, html, text }`. The text part comes from the same React tree, and
// html-to-text is tuned so InfoTables stay readable and the logo tile is skipped.

import { render } from '@react-email/render'
import { createElement, type ComponentType } from 'react'
import { TEXT_SKIP_CLASS } from './brand/tokens.ts'
import { EmailRenderError } from './errors.ts'
import { templateRegistry } from './registry.ts'
import type { RenderedEmail } from './types.ts'
import type { EmailBrandContext, TemplateDefinitions, TemplateName } from './templates/props.ts'

const HTML_TO_TEXT_OPTIONS = {
  wordwrap: 78,
  selectors: [
    // Render label/value tables as aligned rows instead of one concatenated string.
    { selector: 'table', format: 'dataTable' as const },
    // Decorative nodes such as the logo tile.
    { selector: `.${TEXT_SKIP_CLASS}`, format: 'skip' as const },
    // Every image in these templates is decorative.
    { selector: 'img', format: 'skip' as const },
  ],
}

/** Brand context handed to every template. */
export function createBrandContext(input: {
  appName: string
  appUrl: string
  supportEmail: string
  preferencesUrl?: string
}): EmailBrandContext {
  return {
    appName: input.appName,
    appUrl: input.appUrl,
    supportEmail: input.supportEmail,
    preferencesUrl: input.preferencesUrl,
  }
}

/** Renders one template; props that don't match the named template are a compile error. */
export async function renderTemplate<N extends TemplateName>(
  name: N,
  props: TemplateDefinitions[N],
  brand: EmailBrandContext,
): Promise<RenderedEmail> {
  const definition = templateRegistry[name]
  if (definition === undefined) {
    throw new EmailRenderError(`No template is registered under "${String(name)}".`)
  }

  const subject = definition.subject(props, brand)
  if (subject.trim() === '') {
    throw new EmailRenderError(`Template "${String(name)}" produced an empty subject.`)
  }

  try {
    // TypeScript can't correlate component and props through `N`; the `Registry` type guarantees they match.
    const component = definition.component as unknown as ComponentType<Record<string, unknown>>
    const element = createElement(component, { ...props, brand } as unknown as Record<string, unknown>)
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true, htmlToTextOptions: HTML_TO_TEXT_OPTIONS }),
    ])

    if (html.trim() === '') throw new EmailRenderError(`Template "${String(name)}" produced empty HTML.`)
    return { subject, html, text }
  } catch (cause) {
    if (cause instanceof EmailRenderError) throw cause
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new EmailRenderError(`Could not render the "${String(name)}" email. ${detail}`.trim(), { cause })
  }
}
