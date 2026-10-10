// The stage's keyboard target draws its focus ring inside the stage, which
// clips its edges, and the stage chrome's corners sit at their own inset
// from the same edges. The ring is never covered only while its inset is
// smaller than the chrome's at every breakpoint, so this reads every
// --inset-stage-chrome declaration the token source holds, at the root and
// in any media block, resolves each to pixels, and holds the ring's inset
// below each. It also pins that the target draws its ring from that token,
// so the two cannot drift apart.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { parseStylesheet } from './styleParse.ts'
import { tokenSourcePath } from './tokenSource.ts'

const ROOT = join(import.meta.dirname, '..')
const TARGET_SHEET = 'src/viewer/camera/StageKeyTarget.module.css'
const RING_TOKEN = '--inset-stage-target-focus-ring'
const CHROME_TOKEN = '--inset-stage-chrome'

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

// The root-level custom properties of the token source.
function rootTokens(css: string): ReadonlyMap<string, string> {
  const declared = new Map<string, string>()
  parseStylesheet(css, tokenSourcePath).each((node) => {
    if (node.type === 'rule' && node.selector === ':root') {
      node.walkDecls((decl) => {
        if (decl.prop.startsWith('--')) {
          declared.set(decl.prop, decl.value.trim())
        }
      })
    }
  })
  return declared
}

// A length token in pixels: a px literal, or a whole var() of another
// token followed to its root declaration. Any other shape is a token that
// changed shape, and fails here rather than passing unread.
function pixels(
  value: string,
  tokens: ReadonlyMap<string, string>,
  seen: readonly string[],
): number {
  const literal = /^(\d+(?:\.\d+)?)px$/.exec(value)
  if (literal?.[1] !== undefined) {
    return Number(literal[1])
  }
  const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
  if (reference === undefined || seen.includes(reference)) {
    throw new Error(`the length '${value}' is neither px nor a token reference`)
  }
  const next = tokens.get(reference)
  if (next === undefined) {
    throw new Error(`the token source declares no root-level ${reference}`)
  }
  return pixels(next, tokens, [...seen, reference])
}

test('the stage target ring sits inside every chrome inset the tokens declare', () => {
  const css = read(tokenSourcePath)
  const tokens = rootTokens(css)
  const chromeInsets: number[] = []
  parseStylesheet(css, tokenSourcePath).walkDecls(CHROME_TOKEN, (decl) => {
    chromeInsets.push(pixels(decl.value.trim(), tokens, []))
  })
  const ring = tokens.get(RING_TOKEN)
  if (ring === undefined) {
    throw new Error(`the token source declares no root-level ${RING_TOKEN}`)
  }
  const ringInset = pixels(ring, tokens, [])

  expect(chromeInsets.length, 'the tokens declare the chrome inset').toBeGreaterThan(0)
  for (const chromeInset of chromeInsets) {
    expect(ringInset, `the ring inset under the chrome inset ${chromeInset}px`).toBeLessThan(
      chromeInset,
    )
  }
})

test('the stage target draws its ring inward by the ring inset token', () => {
  const offsets: string[] = []
  parseStylesheet(read(TARGET_SHEET), TARGET_SHEET).walkDecls('--focus-ring-offset', (decl) => {
    offsets.push(decl.value.trim())
  })
  expect(offsets).toEqual([`calc(-1 * var(${RING_TOKEN}))`])
})
