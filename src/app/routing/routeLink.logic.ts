// The clicks an in-app link takes over: a plain primary-button click that
// nothing has handled yet. A click with a modifier key or another button
// asks the browser for one of its own behaviors (a new tab, a new window,
// a download), so the link leaves it to the browser and the page stays.
export type LinkClick = {
  readonly button: number
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly defaultPrevented: boolean
}

// The primary button, as the DOM numbers mouse buttons.
const PRIMARY_BUTTON = 0

export function isInAppNavigationClick(click: LinkClick): boolean {
  return (
    click.button === PRIMARY_BUTTON &&
    !click.ctrlKey &&
    !click.metaKey &&
    !click.shiftKey &&
    !click.altKey &&
    !click.defaultPrevented
  )
}
