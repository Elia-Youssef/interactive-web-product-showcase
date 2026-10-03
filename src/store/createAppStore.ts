import { createStore } from 'zustand/vanilla'
import { createCameraSlice, type CameraSlice } from './slices/camera'
import { createExplodeSlice, type ExplodeSlice } from './slices/explode'
import { createFinishSlice, type FinishSlice } from './slices/finish'
import { createHotspotSlice, type HotspotSlice } from './slices/hotspot'
import { createProductSlice, type ProductSlice } from './slices/product'
import { createRendererSlice, type RendererSlice } from './slices/renderer'

// The full state is the intersection of the slice types, never written by
// hand: adding a slice means importing it here, extending this
// intersection and spreading its creator in createAppStore below.
export type AppState = RendererSlice &
  FinishSlice &
  ProductSlice &
  CameraSlice &
  HotspotSlice &
  ExplodeSlice

export function createAppStore() {
  return createStore<AppState>()((set) => ({
    ...createRendererSlice(set),
    ...createFinishSlice(set),
    ...createProductSlice(set),
    ...createCameraSlice(set),
    ...createHotspotSlice(set),
    ...createExplodeSlice(set),
  }))
}
