import type { Product } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { Card } from '@ui/index'

export function HotspotCardContent({
  hotspot,
  listed,
  onClose,
}: {
  readonly hotspot: Product['hotspots'][number]
  readonly listed: boolean
  readonly onClose: () => void
}) {
  return (
    <Card
      eyebrow={hotspot.eyebrow}
      title={hotspot.title}
      bullets={hotspot.bullets}
      onClose={onClose}
      closeLabel={siteCopy.closeLabel}
      headingLevel={listed ? 3 : 2}
    />
  )
}
