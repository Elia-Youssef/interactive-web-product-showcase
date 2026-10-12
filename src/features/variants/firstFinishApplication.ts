import { Group, Mesh, type Material } from 'three/webgpu'
import { precompilePairs } from '@lib/product'
import type { LoadedProduct } from '@viewer/product/loadedProduct'
import type { MappedSceneNode } from '@viewer/product/mappedSceneNodes'
import { mappedSceneMeshes } from './mappedMeshes'
import { applyFinish, resolvedMaterial } from './applyFinish'

// The first application of a finish, which carries the load-time
// precompile: it swaps every mapped mesh's material to the selected
// variant and, in the same settle, draws the finishes the scene does not
// carry yet on zero-scale proxies, so their pipelines build and their
// textures upload with the load. A later application then only sets
// materials and settles. The applier runs it as its first step, once per
// load, so every load precompiles with its own first application.
//
// The proxies ride the product's own first settle, whose presents build
// every pipeline they draw on the frame path, and they cover only the
// materials the scene does not carry: the load's own frames build and
// upload the carried ones. Pipelines built outside the frame path leaked
// instead: on the WebGPU backend, the textures a detached compile
// initialized stopped clearing the renderer's accounting from the second
// load on (a load cycle reads 5, 7, 7 textures at teardown instead of
// 5, 5, 5), which breaks the product's exact teardown baseline.
//
// The timing of the first swap is not load-bearing for that baseline: a
// frame that draws the load's own materials before the swap initializes
// their textures too, but the load's parse-time record of its scene's
// materials has the teardown dispose them with everything else, so no
// texture of a released load survives to be re-created by the next one.
//
// The proxies are added before the settle and removed after it, so the
// scene holds nothing but the product's own nodes by the time the
// presentation's settle reports ready. Zero scale collapses them to no
// fragments, so the precompile draw produces no pixel and costs no draw
// call on the recorded frame.

export type FirstFinishApplication = {
  readonly loaded: LoadedProduct
  readonly variant: string
  // The stage's settle call: the application and its precompile ride it.
  readonly settle: () => Promise<void>
}

// Applies the first finish with its precompile. It resolves when the
// settle has presented the swap and the proxies are gone from the scene.
export async function applyFirstFinish(target: FirstFinishApplication): Promise<void> {
  const { loaded, variant, settle } = target
  let group: Group | null = null
  try {
    // The wrapper runs after applyFinish has set the materials, so the
    // pending pairs are read from the scene as the application left it.
    const settleWithProxies = async (): Promise<void> => {
      group = buildProxyGroup(loaded, mappedSceneMeshes(loaded))
      if (group.children.length > 0) {
        loaded.scene.add(group)
      }
      await settle()
    }
    await applyFinish({ loaded, variant, settle: settleWithProxies })
  } finally {
    if (group !== null) {
      loaded.scene.remove(group)
    }
  }
}

// One proxy per precompile pair: the pair's derived material on the
// geometry of the mesh the plan maps it to. A pipeline is keyed by the
// geometry's attributes as well as the material, so a material compiled on
// one mesh's geometry is not the pipeline another mesh's switch uses. The
// proxies reference the product's own geometry and derived materials, so
// the group owns nothing and nothing is disposed with it. Pairs whose
// derived material the scene already carries are skipped: the load's own
// render compiled and uploaded those.
function buildProxyGroup(loaded: LoadedProduct, mapped: readonly MappedSceneNode[]): Group {
  const group = new Group()
  group.name = 'FINISH_precompile'
  for (const pair of precompilePairs(loaded.finishes.plan)) {
    for (const mappedMesh of mapped.filter(
      (candidate) =>
        candidate.entry.mesh === pair.mesh && candidate.entry.primitive === pair.primitive,
    )) {
      const material = resolvedMaterial(loaded, mappedMesh.entry, pair.materialIndex)
      if (mappedMesh.mesh.material === material) {
        continue
      }
      group.add(buildProxy(mappedMesh.mesh.geometry, material))
    }
  }
  return group
}

function buildProxy(geometry: MappedSceneNode['mesh']['geometry'], material: Material): Mesh {
  const proxy = new Mesh(geometry, material)
  proxy.visible = true
  proxy.frustumCulled = false
  proxy.scale.setScalar(0)
  return proxy
}
