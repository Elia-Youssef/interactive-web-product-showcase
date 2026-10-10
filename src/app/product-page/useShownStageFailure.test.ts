import { beforeEach, expect, it, vi } from 'vitest'
import {
  applyProductSwitchEvent,
  initialProductSwitch,
  type ProductSwitchEvent,
} from '@lib/product-switch'
import { initFailureReason } from '@lib/renderer/initFailure'
import { frameFailureReason } from '@lib/renderer/frameFailure'
import type { RendererStatus } from '@store/index'
import { useShownStageFailure } from './useShownStageFailure'

const hooks = vi.hoisted(() => ({
  effects: [] as (() => void)[],
  reported: { current: null as number | null },
  status: { kind: 'initializing' } as RendererStatus,
}))
vi.mock('react', () => ({
  useRef: () => hooks.reported,
  useEffect: (setup: () => void) => hooks.effects.push(setup),
}))
vi.mock('@store/index', () => ({
  selectRendererStatus: vi.fn(),
  useAppStore: () => hooks.status,
}))

beforeEach(() => {
  hooks.effects = []
  hooks.reported.current = null
})

const navigate: ProductSwitchEvent = { kind: 'navigated', slug: 'b' }
const covered: ProductSwitchEvent = { kind: 'covered' }
const ready: ProductSwitchEvent = { kind: 'settled', life: 1, outcome: 'ready' }
const phases = [
  { name: 'before covering', events: [] },
  { name: 'covering', events: [navigate] },
  { name: 'covered', events: [navigate, covered] },
  { name: 'revealing', events: [navigate, covered, ready] },
] as const

for (const reasonOf of [initFailureReason, frameFailureReason]) {
  for (const { name, events } of phases) {
    it(`ends only pending lives ${name} for ${reasonOf.name}, even without Product`, () => {
      let state = events.reduce(applyProductSwitchEvent, initialProductSwitch('a'))
      const initial = state
      hooks.status = { kind: 'failed', reason: reasonOf(new Error('owned stage failure')) }
      const report = vi.fn(() => {
        state = applyProductSwitchEvent(state, { kind: 'stage-failed', life: initial.shown.life })
      })
      useShownStageFailure({ ...state.shown, onStageFailed: report })
      hooks.effects.forEach((setup) => {
        setup()
        setup()
      })
      expect(report).toHaveBeenCalledTimes(name === 'revealing' ? 0 : 1)
      expect(state.shown.outcome).toBe(name === 'revealing' ? 'ready' : 'stage-failed')
      expect(state.phase).toBe(name === 'covered' ? 'revealing' : initial.phase)
      expect(hooks.status).toEqual({
        kind: 'failed',
        reason: reasonOf(new Error('owned stage failure')),
      })

      // A new shown life needs its own end while the same stage stays failed.
      state = applyProductSwitchEvent(state, { kind: 'navigated', slug: 'c' })
      state = applyProductSwitchEvent(state, covered)
      const life = state.shown.life
      const nextReport = vi.fn(() => {
        state = applyProductSwitchEvent(state, { kind: 'stage-failed', life })
      })
      hooks.effects = []
      useShownStageFailure({ ...state.shown, onStageFailed: nextReport })
      hooks.effects.forEach((setup) => {
        setup()
        setup()
      })
      expect(nextReport).toHaveBeenCalledTimes(1)
      expect(state.phase).toBe('revealing')
      expect(state.shown.outcome).toBe('stage-failed')
      expect(
        applyProductSwitchEvent(state, { kind: 'stage-failed', life: initial.shown.life }),
      ).toBe(state)
    })
  }
}

for (const kind of ['initializing', 'ready'] as const) {
  it(`does not end a pending life on a ${kind} stage`, () => {
    hooks.status = kind === 'ready' ? { kind, backend: 'webgpu' } : { kind }
    const report = vi.fn()
    useShownStageFailure({ life: 0, outcome: 'pending', onStageFailed: report })
    hooks.effects.forEach((setup) => setup())
    expect(report).not.toHaveBeenCalled()
  })
}
