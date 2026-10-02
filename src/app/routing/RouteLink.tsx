import type { ComponentProps } from 'react'
import { navigate } from './browserRouter'
import { isInAppNavigationClick } from './routeLink.logic'

export type RouteLinkProps = Omit<ComponentProps<'a'>, 'href' | 'target'> & {
  // The app path the link goes to.
  readonly to: string
}

// The one in-app link of the app. It is a real anchor, so the address works
// copied, opened in a new tab or loaded cold; a plain click takes the
// router's path instead of a full reload, and every other click is the
// browser's. A target is not offered: a link that leaves the page is not
// an in-app link.
export function RouteLink({ to, onClick, ...rest }: RouteLinkProps) {
  return (
    <a
      {...rest}
      href={to}
      onClick={(event) => {
        onClick?.(event)
        if (!isInAppNavigationClick(event)) {
          return
        }
        event.preventDefault()
        navigate(to)
      }}
    />
  )
}
