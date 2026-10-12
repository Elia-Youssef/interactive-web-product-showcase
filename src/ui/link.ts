import type { AriaAttributes, ComponentType, MouseEventHandler, ReactNode } from 'react'

// The link contract of the ui layer: what a router must offer for the ui
// pieces and the features below the app layer to render an in-app
// address. The app hands its routed link down as this component, so
// nothing below the app layer imports the app layer, and the pieces stay
// routable in every composition.

export type LinkProps = {
  // The app path the link goes to.
  readonly to: string
  readonly children: ReactNode
  readonly className?: string
  // The accessible name for an icon link, or the name that adds the
  // target's name to the link's own word.
  readonly 'aria-label'?: string
  // Marks the link of the page that is open, 'page' for an app route.
  readonly 'aria-current'?: AriaAttributes['aria-current']
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>
}

export type LinkComponent = ComponentType<LinkProps>
