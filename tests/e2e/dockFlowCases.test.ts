import { expect, it } from 'vitest'
import { requiredDockBehaviors, requireDockBehaviors } from './dockFlowCases'

it.each(requiredDockBehaviors)('names the layout and missing completed behavior: %s', (missing) => {
  const completed = new Set<string>(requiredDockBehaviors)
  completed.delete(missing)
  expect(() => requireDockBehaviors('375x667', completed)).toThrow(
    `dock flow 375x667: no runnable ${missing} case completed`,
  )
})

it('accepts a layout only after all required behaviors complete', () => {
  expect(() => requireDockBehaviors('360x640', new Set(requiredDockBehaviors))).not.toThrow()
})
