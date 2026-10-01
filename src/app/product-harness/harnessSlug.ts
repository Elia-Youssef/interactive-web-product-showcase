// The slug query parameter of the product harness, as a pure parse: the
// page renders the product this names, and an absent parameter renders the
// harness's own alert instead of guessing a product.
export function harnessSlug(query: string): string | null {
  const value = new URLSearchParams(query).get('slug')
  return value === null || value === '' ? null : value
}
