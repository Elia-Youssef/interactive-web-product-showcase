// Public API of the routing domain: the pure pathname and title rules.
// Everything else in this folder is internal and reached only through
// this file.

export { PRODUCT_PATH_ROOT, formatAppHref, formatProductPath, parseRoute } from './route'
export type { Route } from './route'
export { collectionDocumentTitle, notFoundDocumentTitle, productDocumentTitle } from './title'
