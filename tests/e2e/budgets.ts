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

// The allowance for one drag-driven camera drive to a target view: a
// calibration drag, then the correcting passes, each a drag and a frame
// settle. Measured over the eight matrix projects with the hotspot suites
// running at the matrix worker cap and nothing else beside them: 16 drive
// tests of four drives each, the worst drive 9.8 s (the software-rendered
// WebKit on its WebGL2 path, every hardware engine near 4 s). The allowance
// is twice that worst drive, the load budget's own rule.
export const cameraDriveBudgetMs = 20_000

// The per-test timeout of a test that loads a product the given number of
// times and drives the camera the given number of times: one load budget per
// load, one drive allowance per drive, plus the body allowance. Every spec
// derives its limit through this helper instead of typing a timeout; the
// config's own default is the single-load budget.
export function testBudgetMs({
  productLoads,
  cameraDrives = 0,
}: {
  readonly productLoads: number
  readonly cameraDrives?: number
}): number {
  return productLoads * productLoadBudgetMs + cameraDrives * cameraDriveBudgetMs + testBodyBudgetMs
}

// The drain of the dev HUD's rolling window: the HUD's fps value falls to
// its rest text about a second after the last frame, so the settle wait
// that freezes the HUD text carries this budget, an order of magnitude
// above the drain it waits for.
export const hudDrainBudgetMs = 10_000

// The allowance for one product switch motion to land its callback on the
// gallery page: the token move is 600ms at full pace, and the specs slow
// it to 3s to prove the callback waits for the animation's real end. Four
// times that slow move, with room for the matrix's slowest browser.
export const transitionMoveBudgetMs = 12_000

// The window a claim of "nothing more happens at rest" waits through
// between its two reads, whatever the reads compare: the stage's frame
// counts across a rest claim, or the gallery's fired callbacks once the
// move's two debts are paid. The stage renders only on invalidations, and
// the longest motion the specs leave running into such a window is the
// explode spring, whose full move ends within its settle time of 0.8 s (the
// explode feature's config), so a window several times that settle time
// cannot contain a frame the stage still owes.
export const restWindowBudgetMs = 2_000

// How long a held drag keeps waiting for a finish switch's settle to
// resolve mid-drag. The settle under test is two presented frames, the
// slowest build renders about every 31 ms, and the drag must hold past two
// settles (one per switch) with the clicks inside. An older settle design,
// which recompiled while any frame raced its compile, never finished inside
// a drag on that build at all; this budget is far above two settles and far
// below that design's own drag length, so a regression fails here on the
// budget instead of on the test's timeout.
export const midDragSettleBudgetMs = 9_000
