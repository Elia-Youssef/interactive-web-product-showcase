import { expect, test } from 'vitest'
import { Scene } from 'three/webgpu'
import { assertStageRenderer, assertStageScene } from './stageIdentity'

// The positive renderer check runs in every e2e project (ready implies it);
// the WebGPURenderer constructor needs a DOM, which the unit environment
// has no business providing.

test.each([
  ['a plain object', {}],
  ['a foreign renderer-like object', { isWebGPURenderer: true, init: () => undefined }],
])('a malformed renderer (%s) fails the renderer check with the named reason', (_name, gl) => {
  expect(() => assertStageRenderer(gl)).toThrow(/WebGPURenderer its factory built/)
})

test('a scene from the same three instance passes the scene check', () => {
  expect(() => assertStageScene(new Scene())).not.toThrow()
})

test.each([
  ['a plain object', {}],
  ['a foreign scene-like object', { isScene: true, children: [] as never[] }],
])('a malformed scene (%s) fails the scene check with the named reason', (_name, scene) => {
  expect(() => assertStageScene(scene)).toThrow(/one copy of three is expected/)
})
