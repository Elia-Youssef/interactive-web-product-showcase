import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { measureShadowFootprint } from './shadowFootprint.ts'
import { SHADOW_SETTINGS } from './shadowSettings.ts'

const bounds = z.object({
  x: z.tuple([z.number(), z.number()]),
  y: z.tuple([z.number(), z.number()]),
})
const vectorSchema = z.object({
  name: z.string(),
  grid: z.object({ width: z.number(), height: z.number(), alpha: z.array(z.number()) }),
  plane: z.object({ boundsM: bounds, uvBoundsM: bounds }),
  settings: z.object({
    alphaThreshold: z.number(),
    padM: z.number(),
    fitToleranceTexels: z.number(),
  }),
  expected: z.object({
    regionPx: bounds,
    alphaBoundsM: bounds,
    fittedBoundsM: bounds,
    sideDifferencesM: bounds,
    texelM: z.object({ x: z.number(), y: z.number() }),
    fits: z.boolean(),
    unclipped: z.boolean(),
    edgeAlpha: z.number(),
  }),
})
const vectors = z
  .array(vectorSchema)
  .parse(
    JSON.parse(
      readFileSync(new URL('./fixtures/shadow-footprint-vectors.json', import.meta.url), 'utf8'),
    ),
  )

describe('recorded authoring image math agreement', () => {
  it.each(vectors)(
    '$name agrees with the recorded library verdict',
    ({ grid, plane, settings, expected }) => {
      expect(settings.alphaThreshold).toBe(SHADOW_SETTINGS.alphaThreshold)
      expect(settings.fitToleranceTexels).toBe(SHADOW_SETTINGS.fitToleranceTexels)
      expect(measureShadowFootprint(grid, plane, settings)).toEqual(expected)
    },
  )
})
