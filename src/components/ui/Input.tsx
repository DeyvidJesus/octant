import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const FIELD_CLASSES =
  'w-full bg-base border border-edge-2 rounded px-3 py-2 text-sm text-ink-2 placeholder:text-faint focus:outline-none focus:border-edge-3'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASSES} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} ${className}`} {...props} />
}
