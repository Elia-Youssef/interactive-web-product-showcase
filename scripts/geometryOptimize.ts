import type { Transform } from '@gltf-transform/core'
import {
  dedup,
  flatten,
  instance,
  join,
  meshopt,
  palette,
  prune,
  simplify,
  sparse,
  weld,
} from '@gltf-transform/functions'
import { verifiedResample } from './verifiedResample.ts'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import type { OptimizeSettings } from './settings.ts'

type GeometrySettings = Pick<
  OptimizeSettings,
  'flatten' | 'join' | 'simplify' | 'palette' | 'prune'
> & {
  resampleTolerance: number
}

// Match the installed optimize command's transform order and defaults.
// Its bundled action exposes no tolerance option; owning this stage lets
// resampling consume the same declared budget as preservation.
export function geometryTransforms(settings: GeometrySettings): Transform[] {
  const transforms: Transform[] = [dedup(), instance()]
  if (settings.palette) transforms.push(palette())
  if (settings.flatten) transforms.push(flatten())
  if (settings.join) transforms.push(join())
  transforms.push(weld())
  if (settings.simplify) transforms.push(simplify({ simplifier: MeshoptSimplifier }))
  transforms.push(verifiedResample(settings.resampleTolerance))
  if (settings.prune) {
    transforms.push(
      prune({
        keepAttributes: true,
        keepIndices: false,
        keepLeaves: false,
        keepSolidTextures: true,
      }),
    )
  }
  transforms.push(sparse(), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
  return transforms
}
