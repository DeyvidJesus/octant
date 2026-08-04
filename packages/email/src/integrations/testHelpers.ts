/**
 * Shared assertion helper for the integration-mapping tests.
 *
 * `mapAuthEmail` and `mapBillingEmail` both return `T | null`, so reading `result?.props.x` in a test
 * silently short-circuits to `undefined` when the mapping unexpectedly returned null — the assertion
 * then passes or fails for the wrong reason. This narrows once, loudly.
 */

/** Returns the mapped props, failing with a clear message if the mapping produced nothing. */
export function propsOf<T>(result: { props: unknown } | null): T {
  if (result === null) throw new Error('Expected the mapping to produce an email, got null.')
  return result.props as T
}
