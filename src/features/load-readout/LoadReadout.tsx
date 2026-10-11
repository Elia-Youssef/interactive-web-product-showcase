import { useEffect } from 'react'
import { loadReadoutText } from '@lib/copy/stageReadouts'
import { siteCopy } from '@lib/copy/site'
import { loadReadoutWanted } from '@lib/loading/readoutVisibility'
import type { ProductTransitionPhase } from '@lib/transition'
import {
  selectLoadWaitPercent,
  selectProductStatus,
  selectRendererStatus,
  useAppStore,
} from '@store/index'
import styles from './LoadReadout.module.css'

// The fill of the readout's track, as the percentage the track's own sheet
// reads. The component writes it on the fill; this widening names the one
// custom property the stylesheet composes, so the style prop stays typed
// instead of cast.
declare module 'react' {
  export interface CSSProperties {
    '--load-readout-fill'?: string
  }
}

// The loading readout of the stage's own wait: the site's loading word over
// a hairline track, in the negative space of the stage, revealed by CSS
// after the delay the tokens own, so a load that ends inside the delay
// unmounts it before it ever paints. The wait is the readout's own rule
// over the renderer's and the product's statuses and the switch phase: it
// starts the wait in the store when it turns wanted and ends it when it
// does not, so the viewer's bridge mirrors the wait's figure and resets
// the ledger between waits. The readout itself is decorative: the live
// region announces its reveal once, and nothing here joins the focus order.
export function LoadReadout({ phase }: { readonly phase: ProductTransitionPhase }) {
  const rendererStatus = useAppStore(selectRendererStatus)
  const productStatus = useAppStore(selectProductStatus)
  const percent = useAppStore(selectLoadWaitPercent)
  const loadWaitStarted = useAppStore((state) => state.loadWaitStarted)
  const loadWaitEnded = useAppStore((state) => state.loadWaitEnded)
  const loadReadoutRevealed = useAppStore((state) => state.loadReadoutRevealed)
  const wanted = loadReadoutWanted({
    renderer: rendererStatus.kind,
    product: productStatus.kind,
    phase,
  })

  useEffect(() => {
    if (!wanted) {
      return
    }
    loadWaitStarted()
    return () => loadWaitEnded()
  }, [wanted, loadWaitStarted, loadWaitEnded])

  if (!wanted) {
    return null
  }
  return (
    <div
      className={styles.readout}
      data-load-readout=""
      aria-hidden="true"
      onAnimationStart={(event) => {
        // The reveal animation starting is the one timer-free moment the
        // delay has passed; the marching segment's own start bubbles from
        // below and is not this element's.
        if (event.target === event.currentTarget) {
          loadReadoutRevealed()
        }
      }}
    >
      <span className={styles.text}>{loadReadoutText(siteCopy.loadingLabel, percent)}</span>
      <span className={styles.track}>
        {percent === null ? (
          <span className={styles.march} />
        ) : (
          <span className={styles.fill} style={{ '--load-readout-fill': `${percent}%` }} />
        )}
      </span>
    </div>
  )
}
