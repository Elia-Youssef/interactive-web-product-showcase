// The one budget module of the e2e suite: every wait limit and every
// per-test timeout derives from the constants here, named and justified
// where they are defined, so no spec carries a literal timeout and a
// budget change is one edit.

// The one load budget for a product or a model to reach ready. Measured on
// the dev server with all eight matrix projects loading at once (one more
// than the matrix worker cap of six): 40 loads, min 6.3 s, median 11.1 s,
// max 14.6 s, with nothing but this session running beside them. The
// budget is twice that worst load: the stress the measurement cannot model
// is the machine the matrix really runs on, where sibling dev servers,
// background CPU work and six GPU contexts (one software-rendered) stretch
// every load, and the audited waits at this value have never timed out
// waiting for a load. It also bounds a genuinely broken load at half a
// minute instead of minutes.
export const productLoadBudgetMs = 30_000

// The named allowance for a test body beyond its product loads: the eased
// camera moves and their damping tails on the software-rendered backends,
// the stage and memory settles, and the screenshot decodes, on the
// slowest backend under the matrix. Twice the load budget, measured
// against the camera suite, whose tests carry one load and the heaviest
// bodies and passed with this much room.
export const testBodyBudgetMs = 60_000

// The per-test timeout of a test that loads a product the given number of
// times: one load budget per load, plus the body allowance. Every spec
// derives its limit through this helper instead of typing a timeout; the
// config's own default is the single-load budget.
export function testBudgetMs({ productLoads }: { readonly productLoads: number }): number {
  return productLoads * productLoadBudgetMs + testBodyBudgetMs
}

// The drain of the dev HUD's rolling window: the HUD's fps value falls to
// its rest text about a second after the last frame, so the settle wait
// that freezes the HUD text carries this budget, an order of magnitude
// above the drain it waits for.
export const hudDrainBudgetMs = 10_000

// The window a claim of "nothing renders at rest" waits through between its
// two frame-count reads. The stage renders only on invalidations, and the
// longest motion the specs leave running into such a window is the explode
// spring, whose full move ends within its settle time of 0.8 s (the explode
// feature's config), so a window several times that settle time cannot
// contain a frame the stage still owes.
export const restWindowBudgetMs = 2_000
