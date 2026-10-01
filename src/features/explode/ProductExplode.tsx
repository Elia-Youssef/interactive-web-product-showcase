import { selectExplodeTarget, useAppStore } from '@store/index'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import { useExplodeDriver } from './useExplodeDriver'
import { useExplodeMotion } from './useExplodeMotion'
import { useExplodeReading } from './useExplodeReading'

// The exploded view of a loaded product. Mounted as a child of Product, it
// drives the product's one clip from the store's target through the
// driver: the driver owns the pose and the motion as one lifetime, and the
// hooks around it are the layout effect that presents it, the retarget,
// the frame step and the reading.
export function ProductExplode() {
  const slug = useLoadedProduct().manifest.slug
  const target = useAppStore((state) => selectExplodeTarget(state, slug))

  const driverRef = useExplodeDriver()
  useExplodeMotion(driverRef, target)
  useExplodeReading(driverRef, target)

  return null
}
