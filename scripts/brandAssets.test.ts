import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, expect, test } from 'vitest'
import { buildBrandAssets } from './brandAssets.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
let generated: Map<string, Buffer>
beforeAll(async () => {
  generated = await buildBrandAssets()
}, TOOL_FIXTURE_TIMEOUT_MS)

test('the committed SVG is exactly the output of the geometry and token source', async () => {
  expect(await readFile(path.join(ROOT, 'public/favicon.svg'))).toEqual(
    generated.get('public/favicon.svg'),
  )
})

test.each([
  ['public/brand/ra-ring.png', 128],
  ['public/apple-touch-icon.png', 180],
] as const)('%s has its required square raster dimensions', async (file, size) => {
  const bytes = await readFile(path.join(ROOT, file))
  expect(bytes.subarray(1, 4).toString()).toBe('PNG')
  expect(bytes.readUInt32BE(16)).toBe(size)
  expect(bytes.readUInt32BE(20)).toBe(size)
})

test('the ICO directory contains one 32 pixel PNG entry', async () => {
  const bytes = await readFile(path.join(ROOT, 'public/favicon.ico'))
  expect(bytes.readUInt16LE(2)).toBe(1)
  expect(bytes.readUInt16LE(4)).toBe(1)
  expect([bytes[6], bytes[7]]).toEqual([32, 32])
  const offset = bytes.readUInt32LE(18)
  expect(bytes.readUInt32LE(14)).toBe(bytes.length - offset)
  expect(bytes.subarray(offset + 1, offset + 4).toString()).toBe('PNG')
  expect(bytes.readUInt32BE(offset + 16)).toBe(32)
  expect(bytes.readUInt32BE(offset + 20)).toBe(32)
})
