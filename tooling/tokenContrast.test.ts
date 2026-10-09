// The non-text parts of the UI keep a 3:1 contrast against what they sit on
// (WCAG 1.4.11). The pairs are computed from the values in the token sheet
// itself: custom properties are resolved through var() references, rgb()
// channel lists and alpha, and a translucent color is composited over the
// background it is named against. A surface is a token, or a color the
// product data puts under the UI: the hotspot marker sits on the product,
// so its light-surface pair is read from the shipped manifests' finishes.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadParseProduct, readManifestFile } from '../scripts/manifestIo.ts'
import { productPaths } from '../scripts/productPaths.ts'
import { listManifestSlugs } from '../scripts/shippedProducts.ts'
import { compositeOver, contrastRatio, relativeLuminance } from './contrast.ts'
import type { Rgb, Rgba } from './contrast.ts'
import { parseStylesheet } from './styleParse.ts'
import { tokenSourcePath } from './tokenSource.ts'

const ROOT = join(import.meta.dirname, '..')

function rootTokens(): Map<string, string> {
  const css = readFileSync(join(ROOT, tokenSourcePath), 'utf8')
  const found = new Map<string, string>()
  parseStylesheet(css, tokenSourcePath).walkRules(':root', (rule) => {
    if (rule.parent?.type !== 'root') {
      return
    }
    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) {
        found.set(decl.prop, decl.value)
      }
    })
  })
  return found
}

const tokens = rootTokens()

// Replaces every var(--name) with the token's own text, until none is left.
function expand(value: string): string {
  let text = value
  for (let depth = 0; depth < 16 && text.includes('var('); depth += 1) {
    text = text.replace(/var\((--[\w-]+)\)/g, (_match, name: string) => {
      const replacement = tokens.get(name)
      if (replacement === undefined) {
        throw new Error(`token ${name} is not defined`)
      }
      return replacement
    })
  }
  if (text.includes('var(')) {
    throw new Error(`"${value}" does not resolve`)
  }
  return text
}

function parseColor(value: string): Rgba {
  const text = expand(value).trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(text)
  if (hex?.[1] !== undefined) {
    const digits = hex[1]
    const channel = (at: number): number => Number.parseInt(digits.slice(at, at + 2), 16)
    return { rgb: [channel(0), channel(2), channel(4)], alpha: 1 }
  }
  const functional = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(text)
  if (functional !== null) {
    return {
      rgb: [Number(functional[1]), Number(functional[2]), Number(functional[3])],
      alpha: functional[4] === undefined ? 1 : Number(functional[4]),
    }
  }
  throw new Error(`cannot read a color from "${value}" (${text})`)
}

function token(name: string): Rgba {
  const value = tokens.get(name)
  if (value === undefined) {
    throw new Error(`token ${name} is not defined`)
  }
  return parseColor(value)
}

function opaque(name: string): Rgb {
  const color = token(name)
  if (color.alpha !== 1) {
    throw new Error(`${name} is translucent; name what it sits on`)
  }
  return color.rgb
}

// An opaque color a part of the UI is painted over: a token, or a color
// from the product data.
type Surface = {
  readonly name: string
  readonly rgb: Rgb
}

function tokenSurface(name: string): Surface {
  return { name, rgb: opaque(name) }
}

// The lightest finish of the shipped collection, by relative luminance,
// from the manifests as the site parses them: the lightest surface a
// product can put under a marker.
async function lightestShippedFinish(): Promise<Surface> {
  const parseProduct = await loadParseProduct()
  const finishes = []
  for (const slug of await listManifestSlugs(ROOT)) {
    const load = await readManifestFile(productPaths(ROOT, slug).manifestFile)
    if (load.kind !== 'loaded') {
      throw new Error(`the manifest of '${slug}' did not load (${load.kind})`)
    }
    finishes.push(...parseProduct(load.manifest, slug).finishes)
  }
  const surfaces = finishes.map((finish) => ({
    name: `the lightest shipped finish (${finish.label}, ${finish.swatch})`,
    rgb: parseColor(finish.swatch).rgb,
  }))
  const [lightest] = surfaces.sort((a, b) => relativeLuminance(b.rgb) - relativeLuminance(a.rgb))
  if (lightest === undefined) {
    throw new Error('the shipped collection carries no finish')
  }
  return lightest
}

const MIN_NON_TEXT = 3
// The disabled label is exempt from contrast, but it must still read as a
// different state from the rest label.
const MIN_STATE_STEP = 2

// One row per pair: the foreground token painted over the surface, compared
// with `against` painted over the same surface (the surface itself when
// absent).
type Pair = {
  readonly name: string
  readonly foreground: string
  readonly on: Surface
  readonly against?: string
  readonly floor: number
}

const surfaces = [tokenSurface('--bg'), tokenSurface('--surface')]
const stage = tokenSurface('--bg')
const sheet = tokenSurface('--surface')

const pairs: Pair[] = [
  ...surfaces.map((on) => ({
    name: `slider track on ${on.name}`,
    foreground: '--boundary',
    on,
    floor: MIN_NON_TEXT,
  })),
  ...surfaces.map((on) => ({
    name: `slider fill against its track on ${on.name}`,
    foreground: '--off',
    on,
    against: '--boundary',
    floor: MIN_NON_TEXT,
  })),
  {
    name: 'stage controls pill border on the stage',
    foreground: '--boundary',
    on: stage,
    floor: MIN_NON_TEXT,
  },
  {
    name: 'phone sheet handle on the sheet',
    foreground: '--boundary',
    on: sheet,
    floor: MIN_NON_TEXT,
  },
  {
    name: 'disabled label on the stage',
    foreground: '--disabled',
    on: stage,
    floor: MIN_NON_TEXT,
  },
  {
    name: 'disabled label against the rest label',
    foreground: '--disabled',
    on: stage,
    against: '--label',
    floor: MIN_STATE_STEP,
  },
  // The two-tone hotspot marker: the dot stands off its own dark rim, the
  // ring stands off the stage, and the ring's dark rim stands off the
  // lightest surface a product can put under it.
  {
    name: 'marker dot against its rim',
    foreground: '--marker-dot',
    on: tokenSurface('--marker-dot-rim'),
    floor: MIN_NON_TEXT,
  },
  {
    name: 'marker ring on the stage',
    foreground: '--marker-ring',
    on: stage,
    floor: MIN_NON_TEXT,
  },
  {
    name: 'marker ring rim on the lightest shipped finish',
    foreground: '--marker-ring-rim',
    on: await lightestShippedFinish(),
    floor: MIN_NON_TEXT,
  },
]

test.each(pairs)('$name keeps its contrast floor', (pair) => {
  const foreground = compositeOver(token(pair.foreground), pair.on.rgb)
  const reference =
    pair.against === undefined ? pair.on.rgb : compositeOver(token(pair.against), pair.on.rgb)
  expect(contrastRatio(foreground, reference), pair.on.name).toBeGreaterThanOrEqual(pair.floor)
})
