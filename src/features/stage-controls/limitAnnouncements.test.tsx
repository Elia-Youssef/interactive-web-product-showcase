import { expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { tiltDirectionAtLimit, tiltStepMoves } from '@lib/camera/orbitStep'
import { zoomDirectionAtLimit, zoomStepMoves } from '@lib/camera/zoom'
import { nextAnnouncement, type AnnouncedState } from '@lib/copy/announcements'
import type { LiveCameraReadout } from '@store/index'
import { StageControlsPill } from './StageZoomControls'

const home: LiveCameraReadout = {
  kind: 'live',
  azimuth: 0,
  distance: 2,
  endDistance: 2,
  minDistance: 1,
  maxDistance: 4,
  endPolar: 1,
  minPolar: 0.25,
  maxPolar: 2.75,
}

const previous: AnnouncedState = {
  product: 'sample',
  productName: 'Sample',
  finishLabel: 'Sample finish',
  cameraLimits: { zoom: null, tilt: null },
  homeArrival: null,
  card: null,
  loadingReveal: 0,
  loadingWait: false,
}

const noOp = () => {}

// The label oracle is the real control that waits at the physical endpoint,
// independent of both the direction owner and the announcement composer.
test.each([
  { kind: 'tilt', limit: 'top', end: home.minPolar },
  { kind: 'tilt', limit: 'bottom', end: home.maxPolar },
  { kind: 'zoom', limit: 'closest', end: home.minDistance },
  { kind: 'zoom', limit: 'farthest', end: home.maxDistance },
] as const)('$kind $limit announces the control whose step runs out', (subject) => {
  let readout: LiveCameraReadout
  let cameraLimits: AnnouncedState['cameraLimits']
  if (subject.kind === 'tilt') {
    const direction = tiltDirectionAtLimit[subject.limit]
    const range = { min: home.minPolar, max: home.maxPolar }
    expect.soft(tiltStepMoves(subject.end, range, direction)).toBe(false)
    expect.soft(tiltStepMoves(subject.end, range, direction === 'up' ? 'down' : 'up')).toBe(true)
    readout = { ...home, endPolar: subject.end }
    cameraLimits = { zoom: null, tilt: subject.limit }
  } else {
    const direction = zoomDirectionAtLimit[subject.limit]
    const range = { min: home.minDistance, max: home.maxDistance }
    expect.soft(zoomStepMoves(subject.end, range, direction)).toBe(false)
    expect.soft(zoomStepMoves(subject.end, range, direction === 1 ? -1 : 1)).toBe(true)
    readout = { ...home, distance: subject.end, endDistance: subject.end }
    cameraLimits = { zoom: subject.limit, tilt: null }
  }
  const html = renderToStaticMarkup(
    <StageControlsPill readout={readout} onTilt={noOp} onZoom={noOp} onReset={noOp} />,
  )
  const waiting = [...html.matchAll(/<button\b[^>]*>/g)].filter((button) =>
    button[0].includes('aria-disabled="true"'),
  )
  expect(waiting).toHaveLength(1)
  const label = waiting[0]?.[0].match(/\baria-label="([^"]+)"/)?.[1]
  expect(label).toBeDefined()
  const words = nextAnnouncement(previous, { ...previous, cameraLimits }, '')
  expect(renderToStaticMarkup(<>{words}</>)).toBe(`${label} limit`)
})
