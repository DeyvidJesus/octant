import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * Keeps keyboard focus inside a modal while `active`: Tab and Shift+Tab wrap around its focusable
 * elements instead of escaping to the page behind the backdrop. On activation, focus moves into the
 * modal unless something inside already has it (an `autoFocus` button keeps its focus). On deactivation,
 * focus returns to whatever had it before the modal opened, so keyboard users are not dropped at the top
 * of the page.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const root = ref.current
    if (!active || !root) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!root.contains(document.activeElement)) (focusableWithin(root)[0] ?? root).focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusableWithin(root)
      if (items.length === 0) {
        event.preventDefault()
        root.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    root.addEventListener('keydown', onKeyDown)
    return () => {
      root.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [ref, active])
}
