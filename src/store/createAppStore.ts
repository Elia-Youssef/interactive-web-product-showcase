import { createStore } from 'zustand/vanilla'
import { createProductSlice, type ProductSlice } from './slices/product'
import { createRendererSlice, type RendererSlice } from './slices/renderer'

// The full state is the intersection of the slice types, never written by
// hand: adding a slice means importing it here, extending this
// intersection and spreading its creator in createAppStore below.
export type AppState = RendererSlice & ProductSlice

export function createAppStore() {
  return createStore<AppState>()((set) => ({
    ...createRendererSlice(set),
    ...createProductSlice(set),
  }))
}
