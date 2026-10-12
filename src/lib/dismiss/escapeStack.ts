// The pure side of the escape owner: one stack of the page's dismissable
// layers, ordered by open time. Two open surfaces (a card and an overlay)
// must never answer one Escape together, so the owner dispatches the key
// to the topmost layer only and the layer below takes it after the one
// above has closed. No DOM here: the DOM side is the hook that holds the
// page's one instance and its one document listener.

// The layer one dismissable surface registers while it is open. The
// surface closes itself in dismiss; the stack only decides who is asked.
export type EscapeLayer = {
  readonly dismiss: () => void
}

export type EscapeStack = {
  // Adds the layer above every registered one and returns its
  // unregister, which is idempotent. Registering a layer that is already
  // on the stack moves it back to the top.
  register(layer: EscapeLayer): () => void
  // Asks the topmost layer to dismiss and reports whether there was one.
  dismissTopmost(): boolean
  // How many layers are open: the rule a listener's presence derives from.
  size(): number
}

export function createEscapeStack(): EscapeStack {
  const layers: EscapeLayer[] = []
  return {
    register(layer) {
      const at = layers.indexOf(layer)
      if (at !== -1) {
        layers.splice(at, 1)
      }
      layers.push(layer)
      let unregistered = false
      return () => {
        if (unregistered) {
          return
        }
        unregistered = true
        const remaining = layers.indexOf(layer)
        if (remaining !== -1) {
          layers.splice(remaining, 1)
        }
      }
    },
    dismissTopmost() {
      const topmost = layers[layers.length - 1]
      if (topmost === undefined) {
        return false
      }
      topmost.dismiss()
      return true
    },
    size() {
      return layers.length
    },
  }
}
