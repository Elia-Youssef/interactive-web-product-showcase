import { expect, test } from 'vitest'
import { detectRendererBackend } from './detect'
import type { BackendCarrier } from './detect'

test('a renderer with a WebGPU backend detects as webgpu', () => {
  const renderer: BackendCarrier = { backend: { isWebGPUBackend: true } }

  expect(detectRendererBackend(renderer)).toBe('webgpu')
})

test('a renderer with a WebGL fallback backend detects as webgl2', () => {
  const renderer: BackendCarrier = { backend: { isWebGLBackend: true } }

  expect(detectRendererBackend(renderer)).toBe('webgl2')
})

test('a renderer claiming both backends at once is malformed and throws', () => {
  const renderer: BackendCarrier = {
    backend: { isWebGPUBackend: true, isWebGLBackend: true },
  }

  expect(() => detectRendererBackend(renderer)).toThrow(/claims both/)
})

test.each([
  ['no backend at all', {}],
  ['an undefined backend', { backend: undefined }],
  ['a backend with no flags', { backend: {} }],
  [
    'a backend with every flag false',
    { backend: { isWebGPUBackend: false, isWebGLBackend: false } },
  ],
])('malformed input (%s) throws instead of guessing', (_name, renderer) => {
  expect(() => detectRendererBackend(renderer)).toThrow(/no recognizable backend/)
})
