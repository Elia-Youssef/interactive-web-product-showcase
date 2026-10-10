import { BufferGeometry, Material, Texture } from 'three/webgpu'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { createGltfModelSources } from '../../src/viewer/product/gltfModelSources'
import type { createStageEnvironmentLoads } from '../../src/viewer/stageEnvironmentLoads'
import type { LoadedModel } from '../../src/viewer/product/productModelLoads'
import { readFinishResolution } from '../../src/viewer/product/finishMaterials'

type ModelOwner = {
  readonly events: string[]
  readonly geometryDisposals: number[]
  readonly textureDisposals: number[]
}

declare global {
  interface Window {
    __assetModelOwners?: ModelOwner[]
    __assetEnvironments?: { readonly events: string[] }[]
  }
}

// Instrument the installed loaders and the resources they actually return.
// Each record belongs to one committed decoder owner, replay runs included.
export function observeModelSources(original: typeof createGltfModelSources, ktx2: KTX2Loader) {
  const owner: ModelOwner = { events: [], geometryDisposals: [], textureDisposals: [] }
  window.__assetModelOwners ??= []
  window.__assetModelOwners.push(owner)
  observeDecoder(owner, ktx2)
  const sources = original(ktx2)
  return {
    ...sources,
    fetchModel: (...args: Parameters<typeof sources.fetchModel>) => {
      owner.events.push('bytes started')
      return sources.fetchModel(...args)
    },
    parse: (...args: Parameters<typeof sources.parse>) => {
      owner.events.push('parse started')
      return sources.parse(...args).then((model) => {
        owner.events.push('parse finished')
        observeModelResult(owner, model)
        return model
      })
    },
  }
}

function observeDecoder(owner: ModelOwner, ktx2: KTX2Loader) {
  const disposeDecoder = ktx2.dispose.bind(ktx2)
  ktx2.dispose = () => {
    owner.events.push('decoder disposed')
    return disposeDecoder()
  }
  const decode = ktx2.parse.bind(ktx2)
  ktx2.parse = (buffer, loaded, failed) => {
    owner.events.push('decode started')
    return decode(
      buffer,
      (texture) => {
        owner.events.push('decode finished')
        loaded?.(texture)
      },
      failed,
    )
  }
}

function observeModelResult(owner: ModelOwner, model: LoadedModel) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  model.scene.traverse((node) => {
    if ('geometry' in node && node.geometry instanceof BufferGeometry) {
      geometries.add(node.geometry)
    }
    if ('material' in node) {
      const carried = Array.isArray(node.material) ? node.material : [node.material]
      for (const material of carried) {
        if (material instanceof Material) materials.add(material)
      }
    }
  })
  for (const geometry of geometries) {
    const index = owner.geometryDisposals.push(0) - 1
    geometry.addEventListener('dispose', () => {
      owner.events.push('geometry disposed')
      owner.geometryDisposals[index] = (owner.geometryDisposals[index] ?? 0) + 1
    })
  }
  const finish = readFinishResolution(model.userData)
  if (finish.kind === 'resolved') {
    for (const material of finish.finishes.materials.values()) materials.add(material)
    for (const material of finish.finishes.rawMaterials.values()) materials.add(material)
    for (const material of finish.finishes.sceneMaterials) materials.add(material)
  }
  observeTextures(owner, materials)
}

function observeTextures(owner: ModelOwner, materials: ReadonlySet<Material>) {
  // Observe the textures the parsed result owns. KTX2's returned prototype
  // textures may be cloned by GLTFLoader and are not the material slots.
  const textures = new Set<Texture>()
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value)
    }
  }
  for (const texture of textures) {
    const index = owner.textureDisposals.push(0) - 1
    texture.addEventListener('dispose', () => {
      owner.textureDisposals[index] = (owner.textureDisposals[index] ?? 0) + 1
    })
  }
}

export function observeEnvironmentLoads(original: typeof createStageEnvironmentLoads) {
  const loads = original()
  const read = loads.read.bind(loads)
  const recorded = new WeakSet<object>()
  loads.read = (url) => {
    const entry = read(url)
    if (!recorded.has(entry)) {
      recorded.add(entry)
      const owner = { events: ['started'] }
      window.__assetEnvironments ??= []
      window.__assetEnvironments.push(owner)
      void entry.value.then(
        (texture) => {
          owner.events.push('loaded')
          texture.addEventListener('dispose', () => owner.events.push('disposed'))
        },
        () => owner.events.push('failed'),
      )
    }
    return entry
  }
  return loads
}
