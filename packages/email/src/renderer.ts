/**
 * Turns a template name + props into `{ subject, html, text }`.
 *
 * This is the only place React Email's `render` is called, and the only place the plain-text conversion
 * is configured. Both matter:
 *
 *   • Every message ships BOTH parts. A transactional email with no text/plain alternative is scored as
 *     more spam-like, and some corporate gateways strip HTML outright — an html-only send then arrives
 *     blank.
 *   • The text part is generated from the same React tree as the HTML, so it can never drift. There is
 *     no hand-maintained text version to forget to update.
 *
 * `htmlToTextOptions` is tuned rather than left at defaults: without `dataTable`, every `InfoTable`
 * collapses into one unreadable run of concatenated labels and values ("1 · Knowledge BaseAdd your
 * roles…"), and without skipping the logo tile the text opens with a stray "O" above the wordmark.
 */

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
    // Decorative-only nodes (the logo tile) add noise to a plain-text reading.
    { selector: `.${TEXT_SKIP_CLASS}`, format: 'skip' as const },
    // `<img>` has no text value here — every image in these templates is decorative.
    { selector: 'img', format: 'skip' as const },
  ],
}

/** Builds the brand context handed to every template. Callers never assemble this by hand. */
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

/**
 * Renders one template. Generic over the template name, so passing props that don't match the named
 * template is a compile error rather than a broken email.
 */
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
    // `createElement` rather than JSX: this module stays a `.ts` file so it can be imported from
    // non-JSX contexts (the Edge Function handlers) without pulling in a JSX pragma.
    //
    // The cast is unavoidable and safe: with both the component and the props behind the generic `N`,
    // TypeScript can't prove they line up, but the `Registry` type in registry.ts already guarantees
    // that entry `N` accepts exactly `TemplateComponentProps<N>`.
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
