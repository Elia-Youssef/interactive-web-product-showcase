import type { Product, ProductCollection } from '@lib/product'
import type { Route } from '@lib/routing'

// The route resolved against the collection: the page the app shows.
export type RoutePage =
  { readonly kind: 'product'; readonly product: Product } | { readonly kind: 'notFound' }

// One resolution rule for every route kind, so the page a route shows is
// decided in one place. The root resolves to the first product: its page
// is on screen while the route's own replace lands, so the rendered tree
// keeps its shape across the redirect and nothing remounts under it.
export function resolveRoutePage(
  route: Route,
  collection: Pick<ProductCollection, 'first' | 'bySlug'>,
): RoutePage {
  switch (route.kind) {
    case 'root':
      return { kind: 'product', product: collection.first }
    case 'product': {
      const product = collection.bySlug(route.slug)
      return product === undefined ? { kind: 'notFound' } : { kind: 'product', product }
    }
    case 'unknown':
      return { kind: 'notFound' }
  }
}
