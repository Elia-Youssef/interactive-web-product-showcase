import { stageCameraConfig } from '../../src/viewer/camera/config'
import { testBudgetMs } from './budgets'
import type { DockLayoutCandidates } from './dockFlowSelection'

const zoomSteps = Math.ceil(100 / stageCameraConfig.zoomStepPercent)

// A case that reveals a marker can drive every visitor zoom step in
// addition to its load and the ordinary open/close body allowance.
export function dockVisitorZoomBudgetMs(): number {
  return testBudgetMs({ productLoads: 1, cameraDrives: zoomSteps })
}

// Each native close-up opens and returns. A fallback source additionally
// loads its page and can traverse the full percentage range in zoom steps.
// These are bounds on actual work, not extra time added after a timeout.
export function dockProbeBudgetMs(layouts: readonly DockLayoutCandidates[]): number {
  const productLoads = layouts.reduce((n, layout) => n + layout.products.length, 0)
  const opens = layouts.reduce(
    (n, layout) =>
      n + layout.products.reduce((count, product) => count + product.openViews.length, 0),
    0,
  )
  return testBudgetMs({ productLoads: productLoads + opens, cameraDrives: opens * (4 + zoomSteps) })
}
