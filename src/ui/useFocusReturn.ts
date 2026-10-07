import { useCallback, useEffect, useRef } from 'react'

// Focus return for the page's transient surfaces, such as an open hotspot
// card or a modal dialog: the surface's opener hands the hook the control
// that activated it, and when the surface closes, focus goes back there.
// One shared hook serves every surface, so no component keeps a trigger
// ref of its own or repeats the restore beside its close action.
//
// The return respects the visitor's own move: focus comes back only when
// it was lost, which is the state a removed focus holder leaves behind,
// and only while the trigger still stands. A trigger the page has left
// (the marker of a product that switched) is skipped, and focus the
// visitor placed somewhere else stays there.

// Whether focus was lost: nothing holds it. A removed focused element
// lands on the body, the page's rest, or nothing at all.
export function focusWasLost(activeElement: Element | null): boolean {
  return (
    activeElement === null ||
    activeElement === document.body ||
    activeElement === document.documentElement
  )
}

// The opener calls what the hook returns with the activating element,
// usually the event's currentTarget, while the surface opens. When the
// hook's active flag falls back to false, the captured trigger receives
// focus under the rule above. The flag is watched, not the unmount: a
// surface whose whole component goes away, a product switch among them,
// closes nothing that focus could return into.
export function useFocusReturn(active: boolean): (trigger: HTMLElement) => void {
  const triggerRef = useRef<HTMLElement | null>(null)
  const wasActiveRef = useRef(false)

  useEffect(() => {
    if (wasActiveRef.current && !active) {
      const trigger = triggerRef.current
      triggerRef.current = null
      if (trigger !== null && trigger.isConnected && focusWasLost(document.activeElement)) {
        trigger.focus()
      }
    }
    wasActiveRef.current = active
  }, [active])

  return useCallback((trigger: HTMLElement) => {
    triggerRef.current = trigger
  }, [])
}
