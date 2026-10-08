import { useEffect, useRef, useState } from 'react'
import type { Product } from '@lib/product'
import { productName } from '@lib/product'
import { activeFinish } from '@lib/copy/productPanel'
import { nextAnnouncement, type AnnouncedState } from '@lib/copy/announcements'
import { selectSelectedVariant, useAppStore } from '@store/index'
import styles from './LiveAnnouncements.module.css'

// The app shell's one polite live region, visually hidden. It announces
// the two changes a visitor makes that the page itself does not speak: a
// product switch, by the new product's name, and a finish selection, by
// the new finish's name. One module owns the region and its words, so no
// component scatters aria-live of its own; what to announce is the pure
// derivation of the copy module, fed the page's last announced state.
export function LiveAnnouncements({ product }: { readonly product: Product }) {
  const selectedVariant = useAppStore((state) => selectSelectedVariant(state, product.slug))
  const [message, setMessage] = useState({ text: '', sequence: 0 })
  const announcedRef = useRef<AnnouncedState | null>(null)

  useEffect(() => {
    const announced: AnnouncedState = {
      product: product.slug,
      productName: productName(product),
      finishLabel: activeFinish(product, selectedVariant).label,
    }
    const announcement = nextAnnouncement(announcedRef.current, announced)
    announcedRef.current = announced
    if (announcement !== null) {
      // Each change inserts a message node, including consecutive products
      // whose display names match. Equal words still owe an announcement.
      setMessage((previous) => ({ text: announcement, sequence: previous.sequence + 1 }))
    }
  }, [product, selectedVariant])

  return (
    <div className={styles.region} aria-live="polite" aria-atomic="true" data-live-announcement>
      <span key={message.sequence}>{message.text}</span>
    </div>
  )
}
