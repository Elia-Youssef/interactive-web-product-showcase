// The non-text parts of the UI keep a 3:1 contrast against what they sit on
// (WCAG 1.4.11). The pairs are computed from the values in the token sheet
// itself: custom properties are resolved through var() references, rgb()
// channel lists and alpha, and a translucent color is composited over the
// background it is named against.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { compositeOver, contrastRatio } from './contrast.ts'
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

// The color a token shows when painted over a named opaque background token.
function shown(name: string, over: string): Rgb {
  return compositeOver(token(name), opaque(over))
}

const MIN_NON_TEXT = 3
// The disabled label is exempt from contrast, but it must still read as a
// different state from the rest label.
const MIN_STATE_STEP = 2

// One row per pair: the foreground token painted over `on`, compared with
// `against` painted over the same `on` (the surface itself when absent).
type Pair = {
  readonly name: string
  readonly foreground: string
  readonly on: string
  readonly against?: string
  readonly floor: number
}

const surfaces = ['--bg', '--surface']

const pairs: Pair[] = [
  ...surfaces.map((on) => ({
    name: `slider track on ${on}`,
    foreground: '--boundary',
    on,
    floor: MIN_NON_TEXT,
  })),
  ...surfaces.map((on) => ({
    name: `slider fill against its track on ${on}`,
    foreground: '--off',
    on,
    against: '--boundary',
    floor: MIN_NON_TEXT,
  })),
  {
    name: 'stage controls pill border on the stage',
    foreground: '--boundary',
    on: '--bg',
    floor: MIN_NON_TEXT,
  },
  {
    name: 'phone sheet handle on the sheet',
    foreground: '--boundary',
    on: '--surface',
    floor: MIN_NON_TEXT,
  },
  {
    name: 'disabled label on the stage',
    foreground: '--disabled',
    on: '--bg',
    floor: MIN_NON_TEXT,
  },
  {
    name: 'disabled label against the rest label',
    foreground: '--disabled',
    on: '--bg',
    against: '--label',
    floor: MIN_STATE_STEP,
  },
]

test.each(pairs)('$name keeps its contrast floor', (pair) => {
  const foreground = shown(pair.foreground, pair.on)
  const reference = pair.against === undefined ? opaque(pair.on) : shown(pair.against, pair.on)
  expect(contrastRatio(foreground, reference)).toBeGreaterThanOrEqual(pair.floor)
})
