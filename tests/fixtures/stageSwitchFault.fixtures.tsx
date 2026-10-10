import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { useAppStore, selectProductStatus } from '../../src/store'
import { useThree } from '@react-three/fiber'
import type { ProductStage } from '../../src/app/product-page/ProductStage'
import type { Stage, StageProps } from '../../src/viewer/Stage'
import { HarnessFrameFault } from '../../src/app/product-harness/HarnessFrameFault'

declare global {
  interface Window {
    __stageSwitchOutcomes?: { life: number; outcome: string }[]
    __failStageFrame?: () => void
    __resumeStageReveal?: () => void
  }
}

export function renderWithStageFrameFault(
  component: typeof Stage,
  props: StageProps,
  faultSlug: string | null,
) {
  const Component = component
  return (
    <Component
      {...props}
      content={<StageFaultContent content={props.content} faultSlug={faultSlug} />}
    />
  )
}

function StageFaultContent({
  content,
  faultSlug,
}: {
  content: ReactNode
  faultSlug: string | null
}) {
  // The wrapper mounts outside Product, so this callback belongs to the stage.
  const status = useAppStore(selectProductStatus)
  const slug = status.kind === 'idle' ? null : status.slug
  const [armed, setArmed] = useState(false)
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    window.__failStageFrame = () => setArmed(true)
    return () => {
      delete window.__failStageFrame
    }
  }, [])
  useEffect(() => {
    if (armed) {
      invalidate()
    }
  }, [armed, invalidate])
  return (
    <>
      {content}
      {(armed || (faultSlug !== null && slug === faultSlug)) && (
        <HarnessFrameFault fault={{ place: 'callback', scope: 'stage' }} />
      )}
    </>
  )
}

export function renderRecordingSwitch(
  component: typeof ProductStage,
  props: ComponentProps<typeof ProductStage>,
  holdReveal = false,
) {
  const { shown } = props.productSwitch
  const recorded = useRef<string | null>(null)
  useEffect(() => {
    const signature = `${shown.life}:${shown.outcome}`
    if (shown.outcome !== 'pending' && recorded.current !== signature) {
      recorded.current = signature
      const outcomes = (window.__stageSwitchOutcomes ??= [])
      outcomes.push({ life: shown.life, outcome: shown.outcome })
    }
  }, [shown.life, shown.outcome])
  useLayoutEffect(() => {
    if (holdReveal && props.productSwitch.phase === 'revealing') {
      const animations =
        document.querySelector('[data-product-transition]')?.getAnimations({ subtree: true }) ?? []
      animations.forEach((animation) => animation.pause())
      window.__resumeStageReveal = () =>
        animations.forEach((animation) => {
          if (animation.effect?.getComputedTiming().iterations !== Infinity) {
            animation.finish()
          }
        })
    }
    return () => {
      delete window.__resumeStageReveal
    }
  }, [holdReveal, props.productSwitch.phase])
  return createElement(component, props)
}
