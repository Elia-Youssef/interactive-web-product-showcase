// The responsive layout contract per viewport: the panel width, where the
// stage sits and how tall it is, which stage chrome corners show, and the
// visual baseline each viewport is captured under. The layout spec reads it
// for every check it runs at each size.

export type CornerName = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export type ViewportContract = {
  readonly width: number
  readonly height: number
  readonly panelWidth:
    { readonly kind: 'fixed'; readonly expected: number } | { readonly kind: 'full' }
  readonly stagePosition: 'right' | 'top'
  readonly stageHeightRatio?: number
  readonly visibleCorners: readonly CornerName[]
  readonly hiddenCorners: readonly CornerName[]
  readonly snapshotName: string
}

export const viewportContracts: readonly ViewportContract[] = [
  {
    width: 1440,
    height: 900,
    panelWidth: { kind: 'fixed', expected: 1440 * 0.34 },
    stagePosition: 'right',
    visibleCorners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    hiddenCorners: [],
    snapshotName: 'desktop-layout-1440x900.png',
  },
  {
    width: 1024,
    height: 768,
    panelWidth: { kind: 'fixed', expected: 380 },
    stagePosition: 'right',
    visibleCorners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    hiddenCorners: [],
    snapshotName: 'layout-1024x768.png',
  },
  {
    width: 768,
    height: 1024,
    panelWidth: { kind: 'full' },
    stagePosition: 'top',
    stageHeightRatio: 0.6,
    visibleCorners: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    hiddenCorners: [],
    snapshotName: 'layout-768x1024.png',
  },
  {
    width: 390,
    height: 844,
    panelWidth: { kind: 'full' },
    stagePosition: 'top',
    stageHeightRatio: 0.62,
    visibleCorners: ['top-left', 'top-right', 'bottom-right'],
    hiddenCorners: ['bottom-left'],
    snapshotName: 'layout-390x844.png',
  },
]
