// The words the app's one live region announces, derived from what changed
// between two snapshots of the page: a product change announces the new
// product's name, a finish change on the presented product announces the
// new finish, and a page that only re-rendered announces nothing. A
// product change announces the product alone, never both: the finish name
// it lands on is the state it arrives in, not a change the visitor made.
// Pure, so the component that holds the region stays render-only.

// What the page presented the last time the region spoke, or null before
// the first snapshot: a page that mounts announces nothing.
export type AnnouncedState = {
  // The slug of the presented product.
  readonly product: string
  // The product's display name, the words a product change announces.
  readonly productName: string
  // The active finish's label, the words a finish change announces.
  readonly finishLabel: string
}

// The announcement the change from previous to current owes, or null when
// it owes none.
export function nextAnnouncement(
  previous: AnnouncedState | null,
  current: AnnouncedState,
): string | null {
  if (previous === null) {
    return null
  }
  if (current.product !== previous.product) {
    return current.productName
  }
  if (current.finishLabel !== previous.finishLabel) {
    return current.finishLabel
  }
  return null
}
