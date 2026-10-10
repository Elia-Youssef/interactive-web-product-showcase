import { beforeEach, expect, it, vi } from 'vitest'
import {
  applyProductSwitchEvent,
  initialProductSwitch,
  type ProductSwitchEvent,
  type ProductSwitchState,
} from '@lib/product-switch'
import { initFailureReason } from '@lib/renderer/initFailure'
import { frameFailureReason } from '@lib/renderer/frameFailure'
import type { RendererStatus } from '@store/index'
import { useShownStageFailure } from './useShownStageFailure'

const hooks = vi.hoisted(() => ({
  effects: [] as { setup: () => void; deps: unknown[] }[],
  status: { kind: 'initializing' } as RendererStatus,
}))
vi.mock('react', () => ({
  useEffect: (setup: () => void, deps: unknown[]) => {
    hooks.effects.push({ setup, deps })
  },
}))
vi.mock('@store/index', () => ({
  selectRendererStatus: vi.fn(),
  useAppStore: () => hooks.status,
}))

beforeEach(() => {
  hooks.effects = []
})

const navigate = (slug: string): ProductSwitchEvent => ({ kind: 'navigated', slug })
const covered: ProductSwitchEvent = { kind: 'covered' }
const ready = (life: number): ProductSwitchEvent => ({ kind: 'settled', life, outcome: 'ready' })
const stageFailed = (life: number): ProductSwitchEvent => ({ kind: 'stage-failed', life })

const phases = [
  { name: 'before covering', events: [] as readonly ProductSwitchEvent[], reported: true },
  { name: 'while covering', events: [navigate('b')], reported: true },
  { name: 'covered', events: [navigate('b'), covered], reported: true },
  {
    name: 'while revealing a ready life',
    events: [navigate('b'), covered, ready(1)],
    reported: false,
  },
] as const

// The page around the hook: the shown life and its report come from the
// real switch sequence, and a report counts only when the sequence accepts
// it, which is what the owner of the once per life rule sees. The commit
// model is React's: a mount runs its effect setup twice (the StrictMode
// replay), a changed effect runs once, an equal one is skipped, and a
// commit that changed the sequence rerenders the page.
function createPage(slug: string, events: readonly ProductSwitchEvent[]) {
  let state = events.reduce(applyProductSwitchEvent, initialProductSwitch(slug))
  let reports: number[] = []
  let boundLife = -1
  let onStageFailed = () => {}
  let committed: readonly unknown[] | null = null

  // One render and commit of the page, named as a component is, so the
  // hook call inside reads as the hook's own render.
  function Render() {
    const shownLife = state.shown.life
    if (boundLife !== shownLife) {
      boundLife = shownLife
      onStageFailed = () => {
        const next = applyProductSwitchEvent(state, stageFailed(shownLife))
        if (next !== state) {
          reports = [...reports, shownLife]
        }
        state = next
      }
    }
    hooks.effects = []
    useShownStageFailure({ ...state.shown, onStageFailed })
    const [effect] = hooks.effects
    if (effect === undefined) {
      throw new Error('the hook registered no effect')
    }
    const mounted = committed === null
    const changed = !sameDeps(committed, effect.deps)
    committed = effect.deps
    if (mounted) {
      effect.setup()
    }
    if (mounted || changed) {
      effect.setup()
    }
  }

  const page = {
    get state(): ProductSwitchState {
      return state
    },
    get reports(): readonly number[] {
      return reports
    },
    // The route, the transition and the stage all reach the sequence as
    // events, and the page rerenders whatever the sequence changed.
    send(event: ProductSwitchEvent) {
      state = applyProductSwitchEvent(state, event)
      page.settle()
    },
    settle() {
      for (let passes = 0; ; passes += 1) {
        const before = state
        Render()
        if (state === before) {
          return
        }
        if (passes > 8) {
          throw new Error('the page did not settle')
        }
      }
    },
  }
  return page
}

function sameDeps(a: readonly unknown[] | null, b: readonly unknown[]): boolean {
  return a !== null && a.length === b.length && a.every((dep, index) => Object.is(dep, b[index]))
}

for (const reasonOf of [initFailureReason, frameFailureReason]) {
  for (const { name, events, reported } of phases) {
    it(`reports the shown life once ${name} for ${reasonOf.name}, and the next life once`, () => {
      hooks.status = { kind: 'failed', reason: reasonOf(new Error('owned stage failure')) }
      const page = createPage('a', events)
      page.settle()
      const life = page.state.shown.life
      const ended = reported ? [life] : []

      // The StrictMode replay of the mount reports the pending life once;
      // a life already ended ready reports nothing at all.
      if (reported) {
        expect(page.reports).toEqual([life])
        expect(page.state.shown.outcome).toBe('stage-failed')
      } else {
        expect(page.reports).toEqual([])
        expect(page.state.shown.outcome).toBe('ready')
      }
      // Rerenders of the same failed stage add no report.
      page.settle()
      page.settle()
      expect(page.reports).toEqual(ended)

      // On the same failed stage the next life reports its own end once,
      // and a stale or repeated report changes nothing.
      page.send(navigate('c'))
      page.send(covered)
      const next = page.state.shown.life
      expect(page.reports).toEqual([...ended, next])
      expect(page.state.shown.outcome).toBe('stage-failed')
      expect(page.state.phase).toBe('revealing')
      page.send(stageFailed(life))
      page.send(stageFailed(next))
      expect(page.reports).toEqual([...ended, next])
      expect(hooks.status).toEqual({
        kind: 'failed',
        reason: reasonOf(new Error('owned stage failure')),
      })
    })
  }
}

for (const kind of ['initializing', 'ready'] as const) {
  it(`reports nothing while the stage is ${kind}`, () => {
    hooks.status = kind === 'ready' ? { kind, backend: 'webgpu' } : { kind }
    const page = createPage('a', [])
    page.settle()
    page.settle()
    expect(page.reports).toEqual([])
    expect(page.state.shown.outcome).toBe('pending')
  })
}
