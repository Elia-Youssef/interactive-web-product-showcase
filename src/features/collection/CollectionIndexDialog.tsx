import { useId, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { CloseIcon, IconButton } from '@ui/index'
import type { LinkComponent } from '@ui/index'
import { CollectionIndexEntries } from './CollectionIndexEntries'
import { useModalDialog } from './useModalDialog'
import styles from './CollectionIndexDialog.module.css'

export type CollectionIndexDialogProps = {
  readonly open: boolean
  // The one close of the dialog: the row's own close, which returns focus
  // to the counter with it.
  readonly onClose: () => void
  readonly products: readonly Product[]
  readonly currentSlug: string
  // The app's link, handed down from the row: the entries navigate
  // through it.
  readonly link: LinkComponent
}

// The collection index overlay: a native modal dialog, so the top layer,
// the inert background, the focus containment and Escape are the
// platform's own on every engine, with no hand-written focus trap. The
// Escape it handles stays its own: the keydown stops at the dialog, so a
// listener further out (an open hotspot card's) never acts on it, while
// the cancel that keydown is the default action of still closes the
// dialog.
export function CollectionIndexDialog({
  open,
  onClose,
  products,
  currentSlug,
  link,
}: CollectionIndexDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  useModalDialog(dialogRef, open)

  const consumeEscape = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      onKeyDown={consumeEscape}
    >
      <div className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          {siteCopy.indexLabel}
        </h2>
        <IconButton aria-label={siteCopy.closeIndexLabel} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
      <CollectionIndexEntries
        products={products}
        currentSlug={currentSlug}
        link={link}
        onChoose={onClose}
      />
    </dialog>
  )
}
