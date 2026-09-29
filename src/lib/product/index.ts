// Public API of the product domain module. Everything else in this folder is
// internal and may only be reached through this file.

export { productManifestSchema } from './schema'
export type { Product, ProductInput } from './schema'
export { HOTSPOT_BULLETS_MAX } from './rules'
export { parseProduct } from './parse'
export { CollectionError, ManifestError } from './errors'
export type { CollectionProblem, ProductIssue } from './errors'
export { createCollection } from './collection'
export type { ProductCollection, ProductNeighbors } from './collection'
