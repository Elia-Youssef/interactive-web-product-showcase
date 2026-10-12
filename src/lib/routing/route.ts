// The route table of the app, as pure pathname logic. No browser access:
// the browser layer hands in location.pathname and resolves the product
// slug against the collection, so this table is unit-tested over a table
// of paths and stays total over any string.

// The one fixed first segment of a product path: '/p/<slug>'.
export const PRODUCT_PATH_ROOT = '/p/'

// What a pathname parses into. A product route carries the slug exactly as
// the path spells it; whether the collection has that product is the
// caller's resolution, never part of the parse.
export type Route =
  | { readonly kind: 'product'; readonly slug: string }
  | { readonly kind: 'root' }
  | { readonly kind: 'unknown'; readonly path: string }

// The pathname rules, stated once here:
//   Trailing slash: a path is canonical only without a trailing slash, and
//   the parse never rewrites what it reads, so '/p/<slug>/' is an unknown
//   path like any deeper one.
//   Encoding: the slug is the raw second segment, never decoded. Manifest
//   slugs are lowercase kebab case (SLUG_PATTERN in the product domain), so
//   an encoded path parses to a slug no manifest carries and resolves as
//   unknown, and a malformed escape cannot throw in the middle of a render.
export function parseRoute(pathname: string): Route {
  if (pathname === '/') {
    return { kind: 'root' }
  }
  if (pathname.startsWith(PRODUCT_PATH_ROOT)) {
    const slug = pathname.slice(PRODUCT_PATH_ROOT.length)
    if (slug !== '' && !slug.includes('/')) {
      return { kind: 'product', slug }
    }
  }
  return { kind: 'unknown', path: pathname }
}

// The canonical path of a product: '/p/<slug>', with the slug percent
// encoded into one path segment. On the schema's slugs the encoding is the
// identity, and the call stays total over any string so a slug from data
// can never produce a broken path.
export function formatProductPath(slug: string): string {
  return `${PRODUCT_PATH_ROOT}${encodeURIComponent(slug)}`
}

// The one in-app address: the route path plus the query string the app
// carries on every navigation. The link that renders the address and the
// navigation that pushes it both format through this function, so a
// copied href and the click on it land on the same URL.
export function formatAppHref(path: string, search: string): string {
  return `${path}${search}`
}
