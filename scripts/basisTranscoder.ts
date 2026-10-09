// The installed renderer owns the transcoder. Evaluate its UMD wrapper in
// a Node context because three is ESM while the wrapper uses CommonJS.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { runInNewContext } from 'node:vm'

export type BasisFile = {
  isValid(): boolean
  isETC1S(): boolean
  getHasAlpha(): boolean
  startTranscoding(): boolean
  getImageTranscodedSizeInBytes(mip: number, layer: number, face: number, format: number): number
  transcodeImage(
    output: Uint8Array,
    mip: number,
    layer: number,
    face: number,
    format: number,
    flags: number,
    channel0: number,
    channel1: number,
  ): boolean
  close(): void
  delete(): void
}
type BasisModule = { initializeBasis(): void; KTX2File: new (bytes: Uint8Array) => BasisFile }
type BasisFactory = (options: { wasmBinary: Uint8Array }) => Promise<BasisModule>

export async function loadBasisTranscoder(): Promise<BasisModule> {
  const require = createRequire(import.meta.url)
  const js = require.resolve('three/examples/jsm/libs/basis/basis_transcoder.js')
  const factory: BasisFactory = runInNewContext(`${await readFile(js, 'utf8')}\nBASIS;`, {
    require,
    process,
    __dirname: dirname(js),
    console,
    Buffer,
    TextDecoder,
    TextEncoder,
    setTimeout,
    clearTimeout,
  })
  const basis = await factory({ wasmBinary: await readFile(js.replace(/\.js$/, '.wasm')) })
  basis.initializeBasis()
  return basis
}
