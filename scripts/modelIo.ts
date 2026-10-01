// The one NodeIO configuration for every script that reads a product
// model: all extensions registered, and the Meshopt decoder installed, so
// an optimized (Meshopt + KTX2) file reads back completely.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

export async function createModelIO(): Promise<NodeIO> {
  await MeshoptDecoder.ready
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
  })
}
