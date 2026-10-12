import { createContext, useContext } from 'react'
import type { Object3D } from 'three/webgpu'
import type { Product } from '@lib/product'
import type { ProductFinishMaterials } from './finishMaterials'
import type { GltfAssociation } from './mappedSceneNodes'
import type { ProductRig } from '../rig/productRig'

// The surface of the loader's parser a product extension may read, kept
// structural, so an extension depends on what it reads and not on the
// loader's whole parser type.
export interface ProductGltfParser {
  readonly json: unknown
  readonly associations: ReadonlyMap<object, GltfAssociation>
  getDependency(type: string, index: number): Promise<unknown>
}

// One loaded product as the features that extend it read it: the validated
// manifest, the loaded scene, the rig parsed from it, the parser that
// built both, and the finish materials the load resolved with the model.
// The product owns every resource the loader created and releases them
// with the scene; an extension releases only what it creates itself, and
// mutates the scene only through the stage settle.
export type LoadedProduct = {
  readonly manifest: Product
  readonly scene: Object3D
  readonly rig: ProductRig
  readonly parser: ProductGltfParser
  readonly finishes: ProductFinishMaterials
}

export const LoadedProductContext = createContext<LoadedProduct | null>(null)

// The loaded product around the calling component. An extension rendered
// anywhere else is a composition error, so it fails loudly instead of
// rendering against no product.
export function useLoadedProduct(): LoadedProduct {
  const loaded = useContext(LoadedProductContext)
  if (loaded === null) {
    throw new Error('a product extension renders outside a loaded product')
  }
  return loaded
}
