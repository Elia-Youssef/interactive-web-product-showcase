import { siteCopy } from '@lib/copy/site'
import { RouteLink } from '../routing'
import styles from './NotFoundScreen.module.css'

export type NotFoundScreenProps = {
  // The canonical path of the collection's first product: the screen's one
  // way out, through the app's in-app link.
  readonly collectionPath: string
}

// The screen for a route that names no product of the collection. It sits
// in the app layout's panel slot, so the site's frame stays and the stage
// slot stays empty: no renderer starts for a page that has no product.
export function NotFoundScreen({ collectionPath }: NotFoundScreenProps) {
  return (
    <div className={styles.screen} data-screen="not-found">
      <h1 className={styles.heading}>{siteCopy.notFoundHeading}</h1>
      <p className={styles.line}>{siteCopy.notFoundLine}</p>
      <RouteLink className={styles.link} to={collectionPath}>
        {siteCopy.notFoundLink}
      </RouteLink>
    </div>
  )
}
