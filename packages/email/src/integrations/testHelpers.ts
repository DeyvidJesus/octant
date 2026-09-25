/** Narrows a mapping result to its props, failing loudly on null instead of letting `result?.props` hide it. */
export function propsOf<T>(result: { props: unknown } | null): T {
  if (result === null) throw new Error('Expected the mapping to produce an email, got null.')
  return result.props as T
}
