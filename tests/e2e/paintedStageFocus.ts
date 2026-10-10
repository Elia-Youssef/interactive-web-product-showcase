import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'
import { chromeObstaclesOf } from './chromeObstacles'
import { decodePng, type DecodedImage } from './imageInk'
import { presentedStageCapture } from './stageCapture'
import { rectsMeet } from '../../src/lib/hotspots/chromeGeometry'
import type { StageRect } from '../../src/lib/hotspots/markerBox'

export async function expectPaintedStageFocus(page: Page, target: Locator): Promise<void> {
  const ring = await target.evaluate(readRing)
  expect(ring.outlineStyle).toBe('solid')
  expect(ring.width).toBeGreaterThan(0)
  const clips = await target.evaluate(readClips)
  const obstacles = await chromeObstaclesOf(page)
  expectRingGeometry(ring, clips, obstacles)
  const color = await target.evaluate((element) => {
    const context = document.createElement('canvas').getContext('2d')
    if (context === null) throw new Error('a focus paint read needs a color conversion context')
    context.fillStyle = getComputedStyle(element).outlineColor
    context.fillRect(0, 0, 1, 1)
    return [...context.getImageData(0, 0, 1, 1).data]
  })
  expect(color[3]).toBe(255)
  const image = decodePng(await presentedStageCapture(page))
  expect(image.width, 'the ring pixel coordinates use the viewport CSS width').toBe(
    page.viewportSize()?.width,
  )
  expectRingPixels(ring, image, color)
}

function readRing(element: Element) {
  const bounds = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const width = Number.parseFloat(style.outlineWidth)
  const offset = Number.parseFloat(style.outlineOffset)
  const outer = {
    left: bounds.left - offset - width,
    top: bounds.top - offset - width,
    right: bounds.right + offset + width,
    bottom: bounds.bottom + offset + width,
  }
  const strips = [
    { ...outer, bottom: outer.top + width },
    { ...outer, top: outer.bottom - width },
    { ...outer, right: outer.left + width },
    { ...outer, left: outer.right - width },
  ]
  return {
    strips,
    width,
    outlineStyle: style.outlineStyle,
    origin: { left: bounds.left, top: bounds.top },
  }
}

function readClips(element: Element) {
  const clips = [{ left: 0, top: 0, right: innerWidth, bottom: innerHeight }]
  for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const css = getComputedStyle(ancestor)
    if (css.overflowX !== 'visible' || css.overflowY !== 'visible') {
      const box = ancestor.getBoundingClientRect()
      clips.push({
        left: box.left + ancestor.clientLeft,
        top: box.top + ancestor.clientTop,
        right: box.left + ancestor.clientLeft + ancestor.clientWidth,
        bottom: box.top + ancestor.clientTop + ancestor.clientHeight,
      })
    }
  }
  return clips
}

function expectRingGeometry(
  ring: ReturnType<typeof readRing>,
  clips: readonly StageRect[],
  obstacles: readonly StageRect[],
): void {
  for (const strip of ring.strips) {
    for (const clip of clips) {
      expect(strip.left).toBeGreaterThanOrEqual(clip.left)
      expect(strip.top).toBeGreaterThanOrEqual(clip.top)
      expect(strip.right).toBeLessThanOrEqual(clip.right)
      expect(strip.bottom).toBeLessThanOrEqual(clip.bottom)
    }
    const relative = {
      left: strip.left - ring.origin.left,
      top: strip.top - ring.origin.top,
      right: strip.right - ring.origin.left,
      bottom: strip.bottom - ring.origin.top,
    }
    expect(
      obstacles.filter((obstacle) => rectsMeet(relative, obstacle)),
      'the ring clears all chrome slots',
    ).toEqual([])
  }
}

function expectRingPixels(
  ring: ReturnType<typeof readRing>,
  image: DecodedImage,
  color: readonly number[],
): void {
  const channels = image.data.length / (image.width * image.height)
  const missing: { x: number; y: number }[] = []
  for (const [index, strip] of ring.strips.entries()) {
    const horizontal = index < 2
    const start = Math.ceil((horizontal ? strip.left : strip.top) + 2 * ring.width)
    const end = Math.floor((horizontal ? strip.right : strip.bottom) - 2 * ring.width)
    for (let along = start; along < end; along += 1) {
      const x = horizontal ? along : Math.floor((strip.left + strip.right) / 2)
      const y = horizontal ? Math.floor((strip.top + strip.bottom) / 2) : along
      const at = (y * image.width + x) * channels
      if (color.slice(0, 3).some((value, channel) => image.data[at + channel] !== value))
        missing.push({ x, y })
    }
  }
  expect(missing, 'every straight ring segment is painted and unobscured').toEqual([])
}
