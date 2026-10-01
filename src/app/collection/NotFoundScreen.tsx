import { siteCopy } from '@lib/copy/site'
import { navigate } from '../routing'
import styles from './NotFoundScreen.module.css'

export type NotFoundScreenProps = {
  // The canonical path of the collection's first product: the screen's one
  // way out, reached through the router's navigate.
  readonly collectionPath: string
}

// The screen for a route that names no product of the collection. It sits
// in the app layout's panel slot, so the site's frame stays and the stage
// slot stays empty: no renderer starts for a page that has no product.
// The link is a real anchor, so the address works copied or opened cold,
// and a click takes the router's path instead of a full reload.
export function NotFoundScreen({ collectionPath }: NotFoundScreenProps) {
  return (
    <div className={styles.screen} data-screen="not-found">
      <h1 className={styles.heading}>{siteCopy.notFoundHeading}</h1>
      <p className={styles.line}>{siteCopy.notFoundLine}</p>
      <a
        className={styles.link}
        href={collectionPath}
        onClick={(event) => {
          event.preventDefault()
          navigate(collectionPath)
        }}
      >
        {siteCopy.notFoundLink}
      </a>
    </div>
  )
}
