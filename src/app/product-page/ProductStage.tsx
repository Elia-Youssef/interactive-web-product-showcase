import { ProductExplode } from '@features/explode'
import { HotspotMarkers, ProductHotspots } from '@features/hotspots'
import { ProductFinishes } from '@features/variants'
import { Product } from '@viewer/product/Product'
import { ProductPreload } from '@viewer/product/ProductPreload'
import { Stage } from '@viewer/Stage'
import { ProductSwitchLayer } from './ProductSwitchLayer'
import type { ProductSwitch } from './useProductSwitch'
import { useReducedMotion } from './useReducedMotion'

export type ProductStageProps = {
  // The page's product switch: the life the stage shows, the model files to
  // read ahead, and the transition's phase and reports.
  readonly productSwitch: ProductSwitch
  // The panel's dock, where an open card docks (the sheet on phone).
  readonly dock: HTMLElement | null
  // The stage chrome, which a floating card keeps clear of.
  readonly chrome: HTMLElement | null
}

// The one stage of the product page, alive across every product switch: the
// renderer, the environment and the decoders stay, and the products swap
// inside it. The shown product mounts keyed by its life, so every swap is a
// clean mount of the product and every feature extending it (the finishes
// and the exploded view inside the product, the hotspots as the canvas
// child plus the markers in the stage's overlay), and nothing built for one
// life can outlive it. Beside it, the model files of the neighbors are read
// ahead; over everything, the switch transition's layer.
export function ProductStage({ productSwitch, dock, chrome }: ProductStageProps) {
  const { shown, preload, phase, onCovered, onRevealed } = productSwitch
  const reducedMotion = useReducedMotion()
  return (
    <>
      <Stage
        content={
          <>
            <Product key={shown.life} manifest={shown.manifest} onSettled={shown.onSettled}>
              <ProductFinishes />
              <ProductHotspots />
              <ProductExplode />
            </Product>
            <ProductPreload slugs={preload} />
          </>
        }
        overlay={
          <HotspotMarkers product={shown.manifest} dock={dock} chrome={chrome} listHost={null} />
        }
      />
      <ProductSwitchLayer
        shown={shown.manifest.slug}
        phase={phase}
        reducedMotion={reducedMotion}
        onCovered={onCovered}
        onRevealed={onRevealed}
      />
    </>
  )
}
