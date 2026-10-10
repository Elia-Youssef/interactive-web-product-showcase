import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { siteCopy } from '@lib/copy/site'
import type { LiveCameraReadout } from '@store/index'
import { StageAngleRow } from './StageAngleReadout'
import { StageControlsPill } from './StageZoomControls'

// The stage controls from plain values, at every limit state: each tilt and
// zoom button waits disabled exactly at the limit its step cannot pass, and
// every control renders. A static render reads no store, so the readout is
// the input; the phone's control set is the camera reset spec's, in a
// browser at a phone size.

const noOp = () => {}

const home: LiveCameraReadout = {
  kind: 'live',
  azimuth: 0.5,
  distance: 2,
  endDistance: 2,
  minDistance: 1,
  maxDistance: 4,
  endPolar: 1,
  minPolar: 0.25,
  maxPolar: 2.75,
}

function pill(readout: LiveCameraReadout): string {
  return renderToString(
    <StageControlsPill readout={readout} onTilt={noOp} onZoom={noOp} onReset={noOp} />,
  )
}

// Whether the button named by a label renders disabled.
function disabled(html: string, label: string): boolean {
  const button = new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(html)
  if (button === null) {
    throw new Error(`no button named ${label} rendered`)
  }
  return /\sdisabled=""/.test(button[0])
}

describe('the stage controls pill', () => {
  it('renders the tilt pair, the zoom cluster with its percentage, and Reset', () => {
    const html = pill(home)
    for (const label of [
      siteCopy.tiltUpLabel,
      siteCopy.tiltDownLabel,
      siteCopy.zoomOutLabel,
      siteCopy.zoomInLabel,
    ]) {
      expect(disabled(html, label), label).toBe(false)
    }
    expect(html).toContain('67%')
    expect(html).toContain(`>${siteCopy.resetLabel}<`)
  })

  it.each([
    ['the closest zoom', { endDistance: 1 }, siteCopy.zoomInLabel],
    ['the farthest zoom', { endDistance: 4 }, siteCopy.zoomOutLabel],
    ['the bottom view', { endPolar: 2.75 }, siteCopy.tiltUpLabel],
    ['the top view', { endPolar: 0.25 }, siteCopy.tiltDownLabel],
  ] as const)('waits at %s with only its own button disabled', (_name, at, label) => {
    const html = pill({ ...home, ...at })
    const waiting = [
      siteCopy.tiltUpLabel,
      siteCopy.tiltDownLabel,
      siteCopy.zoomOutLabel,
      siteCopy.zoomInLabel,
    ].filter((candidate) => disabled(html, candidate))
    expect(waiting).toEqual([label])
  })
})

describe('the stage angle row', () => {
  it('renders the readout between its rotate buttons, left first', () => {
    const html = renderToString(<StageAngleRow azimuth={0} onRotate={noOp} />)
    const left = html.indexOf(siteCopy.rotateLeftLabel)
    const readout = html.indexOf('0 / 360')
    const right = html.indexOf(siteCopy.rotateRightLabel)
    expect(left).toBeGreaterThan(-1)
    expect(readout).toBeGreaterThan(left)
    expect(right).toBeGreaterThan(readout)
  })
})
