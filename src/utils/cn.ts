import { twMerge, type ClassNameValue } from 'tailwind-merge'

/**
 * Joins class lists and resolves Tailwind conflicts so the LAST class wins: `cn('px-4', 'px-2')` is
 * `'px-2'`. UI primitives pass the caller's `className` last, so overrides are predictable instead of
 * depending on CSS source order. Falsy values are dropped, which keeps conditional classes terse.
 */
export function cn(...inputs: ClassNameValue[]): string {
  return twMerge(...inputs)
}
