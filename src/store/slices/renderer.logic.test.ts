import { expect, test } from 'vitest'
import { rendererBackends, type RendererBackend } from '@lib/renderer/backend'
import { applyRendererEvent, type RendererEvent, type RendererStatus } from './renderer.logic'

// The transition table as test data: one row per cell, so a change to any
// cell fails exactly its own rows.
type TransitionCase = {
  name: string
  from: RendererStatus
  event: RendererEvent
  expected: RendererStatus
}

const failed = (reason: string): RendererStatus => ({ kind: 'failed', reason })

function readyCase(
  from: RendererStatus,
  backend: RendererBackend,
  expected: RendererStatus,
): TransitionCase {
  return {
    name: `${from.kind} + ready(${backend}) becomes ${expected.kind}`,
    from,
    event: { kind: 'ready', backend },
    expected,
  }
}

const table: TransitionCase[] = [
  ...rendererBackends.map((backend) =>
    readyCase({ kind: 'initializing' }, backend, { kind: 'ready', backend }),
  ),
  {
    name: 'initializing + failed(reason) becomes failed(reason)',
    from: { kind: 'initializing' },
    event: { kind: 'failed', reason: 'context creation failed' },
    expected: { kind: 'failed', reason: 'context creation failed' },
  },
  {
    name: 'initializing + reset stays initializing',
    from: { kind: 'initializing' },
    event: { kind: 'reset' },
    expected: { kind: 'initializing' },
  },
  ...rendererBackends.map((backend) =>
    readyCase({ kind: 'ready', backend: 'webgpu' }, backend, { kind: 'ready', backend }),
  ),
  {
    name: 'ready + failed(reason) becomes failed(reason)',
    from: { kind: 'ready', backend: 'webgl2' },
    event: { kind: 'failed', reason: 'device lost' },
    expected: { kind: 'failed', reason: 'device lost' },
  },
  {
    name: 'ready + reset becomes initializing',
    from: { kind: 'ready', backend: 'webgpu' },
    event: { kind: 'reset' },
    expected: { kind: 'initializing' },
  },
  ...rendererBackends.map((backend) =>
    readyCase(failed('first cause'), backend, failed('first cause')),
  ),
  {
    name: 'failed + failed(other reason) keeps the first reason',
    from: failed('first cause'),
    event: { kind: 'failed', reason: 'second cause' },
    expected: failed('first cause'),
  },
  {
    name: 'failed + reset becomes initializing',
    from: failed('first cause'),
    event: { kind: 'reset' },
    expected: { kind: 'initializing' },
  },
]

test.each(table)('$name', ({ from, event, expected }) => {
  expect(applyRendererEvent(from, event)).toEqual(expected)
})

test('a failed status stays the same object on a later ready event', () => {
  const current = failed('first cause')

  expect(applyRendererEvent(current, { kind: 'ready', backend: 'webgpu' })).toBe(current)
})

test('a failed status stays the same object on a later failed event', () => {
  const current = failed('first cause')

  expect(applyRendererEvent(current, { kind: 'failed', reason: 'second cause' })).toBe(current)
})
