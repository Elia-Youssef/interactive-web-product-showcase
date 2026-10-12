import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { Mesh } from 'three/webgpu'
import { MeshoptEncoder } from 'meshoptimizer'
import { createGltfModelSources, type GltfModelSourceParts } from './gltfModelSources'
import type { ProductMeshoptDecoder } from './decoders'
import { unwatchedProgress } from './stageModelLoads.fixtures'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../../../tooling/subprocess.fixtures'

// The wiring of the model sources over real three objects: the loader and
// its manager are three's, the decoder is three's own Meshopt decoder, the
// fetch is the one global a test replaces and the models are real glb files
// the test builds. Nothing here reaches a network.

const modelUrl = 'http://models.test/models/sample/model.glb'
const modelBase = 'http://models.test/models/sample/'

function paddedTo4(bytes: Uint8Array, fill: number): Uint8Array {
  const padded = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4).fill(fill)
  padded.set(bytes)
  return padded
}

// A glb container around a glTF document, with a binary chunk when the
// document has binary data.
function glb(document: object, binary: Uint8Array = new Uint8Array(0)): ArrayBuffer {
  const json = paddedTo4(new TextEncoder().encode(JSON.stringify(document)), 0x20)
  const bin = paddedTo4(binary, 0)
  const binChunk = bin.byteLength === 0 ? 0 : 8 + bin.byteLength
  const total = 12 + 8 + json.byteLength + binChunk
  const out = new ArrayBuffer(total)
  const view = new DataView(out)
  const bytes = new Uint8Array(out)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)
  view.setUint32(12, json.byteLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.set(json, 20)
  if (bin.byteLength > 0) {
    const at = 20 + json.byteLength
    view.setUint32(at, bin.byteLength, true)
    view.setUint32(at + 4, 0x004e4942, true)
    bytes.set(bin, at + 8)
  }
  return out
}

function emptyModelGlb(): ArrayBuffer {
  return glb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] })
}

const trianglePositions = [0, 0, 0, 1, 0, 0, 0, 1, 0]

// A glb whose one triangle is stored as an EXT_meshopt_compression buffer
// view: three's loader can read the positions only through a Meshopt decoder
// it holds when the parse starts. The encoder is the project's own
// development dependency.
async function compressedTriangleGlb(): Promise<ArrayBuffer> {
  await MeshoptEncoder.ready
  const stride = 12
  const positions = new Float32Array(trianglePositions)
  const encoded = MeshoptEncoder.encodeGltfBuffer(
    new Uint8Array(positions.buffer),
    3,
    stride,
    'ATTRIBUTES',
  )
  return glb(
    {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
      bufferViews: [
        {
          buffer: 0,
          byteLength: positions.byteLength,
          byteStride: stride,
          extensions: {
            EXT_meshopt_compression: {
              buffer: 0,
              byteLength: encoded.byteLength,
              byteStride: stride,
              count: 3,
              mode: 'ATTRIBUTES',
            },
          },
        },
      ],
      buffers: [{ byteLength: encoded.byteLength }],
      extensionsUsed: ['EXT_meshopt_compression'],
      extensionsRequired: ['EXT_meshopt_compression'],
    },
    encoded,
  )
}

// The fetch the test installs: it records every request it receives and
// answers each with the bytes it was given. A page fetch takes the URL and
// the request init, not a Request object.
function stubFetch(bytes: ArrayBuffer): {
  readonly requests: readonly { readonly url: string; readonly init: RequestInit }[]
} {
  const requests: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    requests.push({ url, init })
    return Promise.resolve(new Response(bytes.slice(0)))
  })
  return { requests }
}

function sources(parts: GltfModelSourceParts = {}) {
  return createGltfModelSources(new KTX2Loader(), parts)
}

// Another decoder value: distinct from three's own, with the same surface.
function anotherDecoder(): ProductMeshoptDecoder {
  return { ...MeshoptDecoder }
}

// A loader whose parse still runs for real but records what the loader held
// when it started.
function recordingLoader() {
  const loader = new GLTFLoader()
  const parse = loader.parseAsync.bind(loader)
  const parses: Array<{
    readonly data: unknown
    readonly base: unknown
    readonly decoder: unknown
  }> = []
  vi.spyOn(loader, 'parseAsync').mockImplementation((data, base) => {
    parses.push({ data, base, decoder: loader.meshoptDecoder })
    return parse(data, base)
  })
  return { loader, parses }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the model bytes', () => {
  it('carries the request priority and signal to the fetch, and answers the bytes', async () => {
    const model = emptyModelGlb()
    const reads: Array<{ readonly url: string; readonly init: RequestInit }> = []
    const signal = new AbortController().signal
    const { fetchModel } = sources({
      fetch: (url, init) => {
        reads.push({ url, init })
        return Promise.resolve(new Response(model.slice(0)))
      },
    })

    const bytes = await fetchModel(modelUrl, {
      priority: 'low',
      signal,
      progress: unwatchedProgress,
    })

    expect(reads).toEqual([{ url: modelUrl, init: { priority: 'low', signal } }])
    expect(bytes).toBeInstanceOf(ArrayBuffer)
    expect(bytes.byteLength).toBe(model.byteLength)
  })

  it('reads at high priority with no cancel when the request carries none', async () => {
    const reads: Array<{ readonly url: string; readonly init: RequestInit }> = []
    const { fetchModel } = sources({
      fetch: (url, init) => {
        reads.push({ url, init })
        return Promise.resolve(new Response(emptyModelGlb().slice(0)))
      },
    })

    await fetchModel(modelUrl, { priority: 'high', progress: unwatchedProgress })

    expect(reads).toEqual([{ url: modelUrl, init: { priority: 'high' } }])
  })

  it('rejects with the status and the url when the server answers not ok', async () => {
    const { fetchModel } = sources({
      fetch: () => Promise.resolve(new Response('gone', { status: 404, statusText: 'Not Found' })),
    })

    await expect(
      fetchModel(modelUrl, { priority: 'high', progress: unwatchedProgress }),
    ).rejects.toThrow(`the server answered 404 Not Found for ${modelUrl}`)
  })
})

describe('the Meshopt decoder read', () => {
  it('is one import for every read until it fails, then starts again', async () => {
    const decoder = anotherDecoder()
    let calls = 0
    const importMeshoptDecoder = vi.fn(() => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(decoder)
    })
    const { decoder: read } = sources({ importMeshoptDecoder })

    const first = read()
    const second = read()
    expect(second).toBe(first)
    expect(importMeshoptDecoder).toHaveBeenCalledTimes(1)
    await expect(first).rejects.toThrow('offline')
    await expect(second).rejects.toThrow('offline')

    await expect(read()).resolves.toBe(decoder)
    expect(importMeshoptDecoder).toHaveBeenCalledTimes(2)
    await expect(read()).resolves.toBe(decoder)
    expect(importMeshoptDecoder).toHaveBeenCalledTimes(2)
  })
})

describe('the parse', { timeout: TOOL_FIXTURE_TIMEOUT_MS }, () => {
  it.each([
    ['an absolute model URL', modelUrl, modelBase],
    ['a root-relative model URL', '/models/sample/model.glb', '/models/sample/'],
  ])('resolves resources against the folder of %s', async (_name, url, base) => {
    const { loader, parses } = recordingLoader()
    const { parse } = sources({ loader })
    const data = emptyModelGlb()

    await parse(data, url, anotherDecoder())

    expect(parses).toHaveLength(1)
    expect(parses[0]?.data).toBe(data)
    expect(parses[0]?.base).toBe(base)
  })

  it('holds the decoder it was given on the loader when the parse starts, load after load', async () => {
    const { loader, parses } = recordingLoader()
    const { parse } = sources({ loader })
    const first = anotherDecoder()
    const second = anotherDecoder()

    await parse(emptyModelGlb(), modelUrl, first)
    await parse(emptyModelGlb(), modelUrl, second)

    expect(parses.map((entry) => entry.decoder)).toEqual([first, second])
  })

  describe('of a compressed model', () => {
    let compressedModel: ArrayBuffer
    beforeAll(async () => {
      await MeshoptDecoder.ready
      compressedModel = await compressedTriangleGlb()
    }, TOOL_FIXTURE_TIMEOUT_MS)

    it('reads the buffer view through the decoder of the load', async () => {
      const { requests } = stubFetch(compressedModel)
      const { fetchModel, decoder, parse } = sources({
        importMeshoptDecoder: () => Promise.resolve(MeshoptDecoder),
      })

      const [bytes, meshopt] = await Promise.all([
        fetchModel(modelUrl, { priority: 'high', progress: unwatchedProgress }),
        decoder(),
      ])
      const model = await parse(bytes, modelUrl, meshopt)

      expect(requests).toHaveLength(1)
      const mesh = model.scene.children[0]
      expect(mesh).toBeInstanceOf(Mesh)
      const positions = mesh instanceof Mesh ? mesh.geometry.getAttribute('position').array : []
      expect([...positions]).toEqual(trianglePositions)
    })
  })
})
