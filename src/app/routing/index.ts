// Public API of the app's routing. Components read the address bar and
// navigate only through this file; the browser router is the one writer
// of history behind it.

export { navigate } from './browserRouter'
export type { NavigationOptions } from './browserRouter'
export { RouteLink } from './RouteLink'
export type { RouteLinkProps } from './RouteLink'
export { useDocumentTitle } from './useDocumentTitle'
export { useRoutePath } from './useRoutePath'
export { useRouteSearch } from './useRouteSearch'
