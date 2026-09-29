// The Basis transcoder the runtime KTX2 loader fetches from the transcoder
// path (src/lib/product/transcoderPath.ts, the one module that defines it).
// The installed three's package is the source of truth for the file
// contents; scripts/copyBasis.ts copies them into the folder the URL path
// maps to and scripts/basisAssets.test.ts fails when the served copies
// drift, so a three upgrade cannot leave a stale transcoder behind. Every
// reader of the paths and the file list derives from this module.
import path from 'node:path'
import { basisTranscoderPath } from '../src/lib/product/transcoderPath.ts'

// The files the KTX2 loader requests under the transcoder path: the worker
// wrapper and its WASM binary. The package README is documentation and
// ships nothing, so it is not copied.
export const BASIS_TRANSCODER_FILES = ['basis_transcoder.js', 'basis_transcoder.wasm'] as const

// Where the installed three ships the transcoder.
export function basisSourceDir(root: string): string {
  return path.join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis')
}

// Where the app serves it from: the URL path the runtime loader is pointed
// at, under public. '/basis/' is public/basis, so the folder derives from
// the constant rather than spelling the location a second time.
export function basisTargetDir(root: string): string {
  return path.join(root, 'public', basisTranscoderPath)
}

// The vendored prefix the tooling gates exclude, repo-relative with forward
// slashes, derived from the same URL path.
export const basisVendoredPrefix = `public${basisTranscoderPath}`
