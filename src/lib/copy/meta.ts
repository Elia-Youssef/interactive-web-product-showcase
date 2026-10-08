import { productName } from '../product'
import type { Product } from '../product'
import { collectionDocumentTitle, formatProductPath, productDocumentTitle } from '../routing'
import { activeFinish } from './productPanel'
import { siteCopy } from './site'

// The link-preview copy of the site and of each product: every string a head
// tag carries, derived from the site copy and the product manifests in one
// place. The prerender fills the route pages' tags from here, so the tags
// cannot drift from the words. The scheme joins the bare site domain here
// and nowhere else.

// The absolute URL of the site for one path. The domain is kept without its
// scheme in the site copy; this is the one place the scheme is added.
export function absoluteUrl(path: string): string {
  return `https://${siteCopy.siteUrl}${path}`
}

// The social image path of one product: the capture step writes one PNG per
// product at this path inside the public folder.
export function socialImagePath(slug: string): string {
  return `/social/${slug}.png`
}

// The social image of the bare domain: the first launch product's card
// stands in until a dedicated site card exists.
const SITE_SOCIAL_IMAGE_PATH = '/social/forma-one.png'

// The head set of one page: the document title, the description, the
// canonical URL, and the social card's title, description and image. The
// social description is the page description and the social title of the
// home page is its document title; the set exists so the head writer takes
// one value per slot and no tag composes its own words.
export type MetaHeadSet = {
  readonly title: string
  readonly description: string
  readonly canonicalUrl: string
  readonly socialTitle: string
  readonly socialDescription: string
  readonly socialImageUrl: string
}

// A product page's head set, plus the alt text of its social image: the
// product's name and kind, the finish the image shows, and the collection
// it belongs to.
export type ProductMetaSet = MetaHeadSet & { readonly socialImageAlt: string }

// The home page's head set, from the site copy alone.
export function siteMetaSet(): MetaHeadSet {
  const title = collectionDocumentTitle(siteCopy.collectionName, siteCopy.studioName)
  return {
    title,
    description: siteCopy.metaDescription,
    canonicalUrl: absoluteUrl('/'),
    socialTitle: title,
    socialDescription: siteCopy.metaDescription,
    socialImageUrl: absoluteUrl(SITE_SOCIAL_IMAGE_PATH),
  }
}

// A product page's head set. Returns null for a product that declares no
// meta block: that product has no link-preview words of its own, so nothing
// here invents them, and its route keeps the site-level set. The alt names
// the first finish because the social image shows the product as it loads,
// which is that finish.
export function productMetaSet(product: Product): ProductMetaSet | null {
  const meta = product.meta
  if (meta === undefined) {
    return null
  }
  const name = productName(product)
  return {
    title: productDocumentTitle(product, siteCopy.collectionName),
    description: meta.description,
    canonicalUrl: absoluteUrl(formatProductPath(product.slug)),
    socialTitle: `${name}, ${meta.kind}`,
    socialDescription: meta.description,
    socialImageUrl: absoluteUrl(socialImagePath(product.slug)),
    socialImageAlt: `${name} ${meta.kind} in ${activeFinish(product, null).label}, assembled on a dark stage with a blueprint grid, from ${siteCopy.collectionName} by ${siteCopy.studioName}.`,
  }
}
