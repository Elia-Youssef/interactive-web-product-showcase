// The viewport every e2e page opens at unless a spec sets its own. It is
// stated here rather than left to the runner's default because the dev
// harness's stage fills the viewport, and the hotspot facts that choose the
// harness specs' subjects are computed for that stage's size in pixels: a
// marker shows only while its keep-out box fits the stage.
export const e2eViewport = { width: 1280, height: 720 } as const

// The harness page's stage box: the whole viewport, which its frame fills.
export const harnessStageBox = e2eViewport
