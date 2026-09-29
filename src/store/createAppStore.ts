import { createStore } from 'zustand/vanilla'
import { createFinishSlice, type FinishSlice } from './slices/finish'
import { createRendererSlice, type RendererSlice } from './slices/renderer'

// The full state is the intersection of the slice types, never written by
// hand: adding a slice means importing it here, extending this
// intersection and spreading its creator in createAppStore below.
export type AppState = RendererSlice & FinishSlice

export function createAppStore() {
  return createStore<AppState>()((set) => ({
    ...createRendererSlice(set),
    ...createFinishSlice(set),
  }))
}
