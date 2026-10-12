import { useId, useRef } from 'react'
import type { SyntheticEvent } from 'react'
import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { CloseIcon, IconButton, useEscapeLayer } from '@ui/index'
import type { LinkComponent } from '@ui/index'
import { CollectionIndexEntries } from './CollectionIndexEntries'
import { useModalDialog } from './useModalDialog'
import styles from './CollectionIndexDialog.module.css'

export type CollectionIndexDialogProps = {
  readonly open: boolean
  // The one close of the dialog: every close path, the header button and
  // the escape owner included, goes through it, and the row's focus return
  // puts focus back on the counter with it.
  readonly onClose: () => void
  readonly products: readonly Product[]
  readonly currentSlug: string
  // The app's link, handed down from the row: the entries navigate
  // through it.
  readonly link: LinkComponent
}

// The collection index overlay: a native modal dialog, so the top layer,
// the inert background and the focus containment are the platform's own
// on every engine, with no hand-written focus trap. Escape is not the
// dialog's alone: the surface registers as a layer with the escape owner
// while it is open, so the key closes the topmost open surface only,
// wherever focus rests, and the open hotspot card below waits its turn.
// The platform cancel never closes the dialog on its own authority: it is
// suppressed, and the owner's dispatch closes it through the one close.
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
  useEscapeLayer(open, onClose)

  const suppressCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      onCancel={suppressCancel}
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
