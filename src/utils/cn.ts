import { twMerge, type ClassNameValue } from 'tailwind-merge'

/** Joins classes and resolves Tailwind conflicts so the last one wins: `cn('px-4', 'px-2')` is `'px-2'`. */
export function cn(...inputs: ClassNameValue[]): string {
  return twMerge(...inputs)
}
