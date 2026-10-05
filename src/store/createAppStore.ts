import { createStore } from 'zustand/vanilla'
import { transitionHotspotFlow, type HotspotFlowEvent } from '@lib/hotspots/flow'
import { closeUpHotspotIds } from '@lib/product'
import { nextCameraRequest } from './slices/camera.logic'
import { createCameraSlice, type CameraSlice } from './slices/camera'
import { applyExplodeEvent, explodeTargetOf, type ExplodeEvent } from './slices/explode.logic'
import { createExplodeSlice, selectExplodeTarget, type ExplodeSlice } from './slices/explode'
import { createFinishSlice, type FinishSlice } from './slices/finish'
import { createHotspotSlice, type HotspotSlice } from './slices/hotspot'
import { createProductSlice, type ProductSlice } from './slices/product'
import { createRendererSlice, type RendererSlice } from './slices/renderer'

// The actions that span slices: each event of the hotspot flow, and each
// change of the explode target, which can be one. Each applies its whole
// change in one update, the flow's next status together with the camera
// request it owes, so a subscriber never sees half of an event.
export type FlowActions = {
  // A marker press: opens the hotspot, or closes it when it is the active
  // one. The close-up set and the assembled pose are read from the store
  // at the press.
  hotspotPressed: (product: string, hotspot: string) => void
  // Escape or the card's close button.
  hotspotClosed: (product: string) => void
  // The product stops being presented: its selection clears with no move.
  hotspotLeft: (product: string) => void
  // The stage's Reset: closes any card and returns home.
  stageReset: () => void
  explodeToggle: (product: string) => void
  explodeScrub: (product: string, target: number) => void
}

// The full state is the intersection of the slice types and the composed
// actions, never written by hand: adding a slice means importing it here,
// extending this intersection and spreading its creator in createAppStore
// below.
export type AppState = RendererSlice &
  FinishSlice &
  ProductSlice &
  CameraSlice &
  HotspotSlice &
  ExplodeSlice &
  FlowActions

type SetAppState = (updater: (state: AppState) => AppState | Partial<AppState>) => void

export function createAppStore() {
  return createStore<AppState>()((set) => ({
    ...createRendererSlice(set),
    ...createFinishSlice(set),
    ...createProductSlice(set),
    ...createCameraSlice(set),
    ...createHotspotSlice(),
    ...createExplodeSlice(set),
    ...createFlowActions(set),
  }))
}

function createFlowActions(set: SetAppState): FlowActions {
  const applyFlow = (event: HotspotFlowEvent) => set((state) => flowChange(state, event) ?? state)
  return {
    hotspotPressed: (product, hotspot) =>
      set(
        (state) =>
          flowChange(state, {
            kind: 'pressed',
            product,
            hotspot,
            hasCloseUp: closeUpsOf(state, product).has(hotspot),
            assembled: selectExplodeTarget(state, product) === 0,
          }) ?? state,
      ),
    hotspotClosed: (product) => applyFlow({ kind: 'closed', product }),
    hotspotLeft: (product) => applyFlow({ kind: 'left', product }),
    stageReset: () => applyFlow({ kind: 'reset' }),
    explodeToggle: (product) =>
      set((state) => explodeChange(state, product, { kind: 'toggled', product }) ?? state),
    explodeScrub: (product, target) =>
      set((state) => explodeChange(state, product, { kind: 'scrubbed', product, target }) ?? state),
  }
}

// The change one flow event makes: the next hotspot status and, when the
// step owes a view, the next camera request through the camera slice's own
// channel rule, so the sequence advances exactly as a direct request
// advances it. Null when the event changes nothing, so the store notifies
// no one.
function flowChange(state: AppState, event: HotspotFlowEvent): Partial<AppState> | null {
  const step = transitionHotspotFlow(state.hotspotStatus, event)
  if (step.view === null) {
    return step.status === state.hotspotStatus ? null : { hotspotStatus: step.status }
  }
  return {
    hotspotStatus: step.status,
    cameraRequestChannel: nextCameraRequest(state.cameraRequestChannel, {
      kind: 'view',
      viewId: step.view,
    }),
  }
}

// The change one explode event makes, and when it moves the product's
// target off 0, the flow's event for leaving the assembled pose, in the
// same update. A target that returns to 0 owes the flow nothing: the camera
// moves only on hotspot actions and Reset.
function explodeChange(
  state: AppState,
  product: string,
  event: ExplodeEvent,
): Partial<AppState> | null {
  const explodeStatus = applyExplodeEvent(state.explodeStatus, event)
  if (explodeStatus === state.explodeStatus) {
    return null
  }
  const leftAssembled =
    explodeTargetOf(state.explodeStatus, product) === 0 &&
    explodeTargetOf(explodeStatus, product) > 0
  const flow = leftAssembled ? flowChange(state, { kind: 'disassembled', product }) : null
  return { explodeStatus, ...flow }
}

// The hotspots of the product that carry a close-up, from the ready
// status's rig summary; a product that is not the ready one has none to
// enter.
function closeUpsOf(state: AppState, product: string): ReadonlySet<string> {
  const status = state.productStatus
  return status.kind === 'ready' && status.slug === product
    ? closeUpHotspotIds(status.rig)
    : new Set()
}
