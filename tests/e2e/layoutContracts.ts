// The responsive layout contract per viewport: the panel width, where the
// stage sits and how its height is set, which stage chrome corners show,
// where an open hotspot card goes, and the visual baseline a viewport is
// captured under, when it has one. The layout and card specs read it for
// every check they run at each size.

export type CornerName = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

// The width breakpoint a viewport falls under: the layout mode its tokens
// switch to (--vp-desktop, --vp-tablet, --vp-phone).
export type Breakpoint = 'desktop' | 'tablet' | 'phone'

export type ViewportContract = {
  readonly width: number
  readonly height: number
  readonly breakpoint: Breakpoint
  readonly panelWidth:
    { readonly kind: 'fixed'; readonly expected: number } | { readonly kind: 'full' }
  readonly stagePosition: 'right' | 'top'
  readonly visibleCorners: readonly CornerName[]
  readonly hiddenCorners: readonly CornerName[]
  // Where an open hotspot card goes: beside its marker on the stage, docked
  // in the panel only when no side has room, or always docked in the
  // panel's sheet.
  readonly hotspotCard: 'floats' | 'docks'
  // The committed visual baseline of the viewport. A contract without one
  // is checked by the geometry specs only: it is no visual case.
  readonly snapshotName?: string
}

const desktopCorners = {
  visibleCorners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  hiddenCorners: [],
} as const

// A phone drops the rotation hint.
const phoneCorners = {
  visibleCorners: ['top-left', 'top-right', 'bottom-right'],
  hiddenCorners: ['bottom-left'],
} as const

// A phone: the panel is the full-width sheet under the stage, where every
// hotspot card docks.
function phone(width: number, height: number, snapshotName?: string): ViewportContract {
  return {
    width,
    height,
    breakpoint: 'phone',
    panelWidth: { kind: 'full' },
    stagePosition: 'top',
    ...phoneCorners,
    hotspotCard: 'docks',
    ...(snapshotName === undefined ? {} : { snapshotName }),
  }
}

// The reference layout of each layout mode: the wide and the narrow
// desktop, the tablet and the phone. Every layout spec runs at these, the
// hotspot card flows included, since a card's placement, docking and
// closing depend on the layout mode, and each mode has its reference here.
export const referenceLayouts: readonly ViewportContract[] = [
  {
    width: 1440,
    height: 900,
    breakpoint: 'desktop',
    panelWidth: { kind: 'fixed', expected: 1440 * 0.34 },
    stagePosition: 'right',
    ...desktopCorners,
    hotspotCard: 'floats',
    snapshotName: 'desktop-layout-1440x900.png',
  },
  {
    width: 1024,
    height: 768,
    breakpoint: 'desktop',
    panelWidth: { kind: 'fixed', expected: 380 },
    stagePosition: 'right',
    ...desktopCorners,
    hotspotCard: 'floats',
    snapshotName: 'layout-1024x768.png',
  },
  {
    width: 768,
    height: 1024,
    breakpoint: 'tablet',
    panelWidth: { kind: 'full' },
    stagePosition: 'top',
    ...desktopCorners,
    hotspotCard: 'floats',
    snapshotName: 'layout-768x1024.png',
  },
  phone(390, 844, 'layout-390x844.png'),
]

// The reflow sizes: the short phones, where the resting sheet must still
// show the product's name and its finishes, the 320 px wide phone, and the
// 320 x 256 window of a 1280 px screen at 400 percent zoom, where the
// layout scrolls as one document. The geometry specs run at these (the
// frame, the reflow, the eyebrow, the top layer placement and the index
// scroll); the card flows run at their mode's reference layout.
export const reflowViewports: readonly ViewportContract[] = [
  phone(375, 667),
  phone(360, 640),
  phone(320, 568),
  phone(320, 256),
]

// Every layout viewport: the reference layouts, then the reflow sizes.
export const viewportContracts: readonly ViewportContract[] = [
  ...referenceLayouts,
  ...reflowViewports,
]

// A phone held sideways: wide enough for the tablet layout, so its card
// floats, but with a stage so short that a card can find no side clear of
// the stage chrome and docks for lack of room. The card specs run it; the
// layout spec does not hold a baseline for it.
export const phoneLandscape = { width: 844, height: 390, hotspotCard: 'floats' } as const

// The layout tokens the stage box follows, in CSS pixels and viewport
// shares. The layout spec measures every contract's stage slot against the
// box derived from them, so a drift of a token fails there.
// --height-top-bar
const topBarPx = 56
// --height-stage-tablet, a share of the viewport height
const tabletStageShare = 0.6
// --height-stage-phone, a share of the viewport height
const phoneStageShare = 0.62
// --height-sheet-rest: the phone's resting sheet, which the stage gives way to
const sheetRestPx = 304
// --vp-page-scroll: below this height the layout scrolls as one document
const pageScrollBelowPx = 480
// --height-stage-min: the stage's floor in the scrolling document
const stageMinPx = 240

// Whether the layout at a viewport is the scrolling document: the panel is
// no longer its own scroll container, and the stage keeps its floor.
export function scrollsAsDocument(viewport: { readonly height: number }): boolean {
  return viewport.height < pageScrollBelowPx
}

// The stage height at a viewport: under the top bar beside the panel, the
// tablet's share on top, or on a phone its share, given way to the resting
// sheet. The scrolling document keeps the stage at its floor at least.
function stageHeightOf(contract: ViewportContract): number {
  const shared = (() => {
    switch (contract.breakpoint) {
      case 'desktop':
        return contract.height - topBarPx
      case 'tablet':
        return contract.height * tabletStageShare
      case 'phone':
        return Math.min(contract.height * phoneStageShare, contract.height - topBarPx - sheetRestPx)
    }
  })()
  return scrollsAsDocument(contract) ? Math.max(stageMinPx, shared) : shared
}

// The stage box the layout gives the canvas at a viewport, in CSS pixels:
// beside a fixed-width panel under the top bar, or the full width on top.
// It is the box the hotspot facts measure a marker's keep-out box against.
export function stageBoxOf(contract: ViewportContract): {
  readonly width: number
  readonly height: number
} {
  if (contract.stagePosition === 'top') {
    return { width: contract.width, height: stageHeightOf(contract) }
  }
  if (contract.panelWidth.kind !== 'fixed') {
    throw new Error(`the ${contract.width}x${contract.height} contract names no panel width`)
  }
  return { width: contract.width - contract.panelWidth.expected, height: stageHeightOf(contract) }
}
