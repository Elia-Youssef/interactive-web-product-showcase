import { createElement, useCallback, type ComponentProps } from 'react'
import type { StageEnvironment } from '../../src/viewer/StageEnvironment'
import { StageRetiredError } from '../../src/viewer/StageRetiredError'

export type EnvironmentSettleFailure = {
  readonly name: string
  readonly message: string
  readonly reason: StageRetiredError['reason'] | null
}

declare global {
  interface Window {
    __environmentSettleFailures?: EnvironmentSettleFailure[]
  }
}

// Observe the environment owner's failure channel, independently of the
// console gate. Every report still reaches its original owner or console.
export function renderWithEnvironmentFailures(
  component: typeof StageEnvironment,
  props: ComponentProps<typeof StageEnvironment>,
) {
  return createElement(ObservedEnvironment, { component, props })
}

function ObservedEnvironment({
  component,
  props,
}: {
  readonly component: typeof StageEnvironment
  readonly props: ComponentProps<typeof StageEnvironment>
}) {
  const report = props.onFailure
  const onFailure = useCallback(
    (error: Error) => {
      const failures = window.__environmentSettleFailures
      if (failures === undefined) {
        throw new Error('the environment failure recorder was not installed')
      }
      failures.push({
        name: error.name,
        message: error.message,
        reason: error instanceof StageRetiredError ? error.reason : null,
      })
      if (report === undefined) {
        console.error(error)
      } else {
        report(error)
      }
    },
    [report],
  )
  return createElement(component, { ...props, onFailure })
}
