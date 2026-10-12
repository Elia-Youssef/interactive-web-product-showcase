import { useEffect } from 'react'
import type { RefObject } from 'react'

// Keeps a native dialog element in step with React state: showModal opens
// it in the top layer, close closes it, and both guard on the element's
// own open flag, so a repeated render or a close the platform already
// performed (the cancel on Escape) never acts twice.
export function useModalDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean): void {
  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    }
    if (!open && dialog.open) {
      dialog.close()
    }
  }, [ref, open])
}
