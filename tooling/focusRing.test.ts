// The focus ring has one recipe: global.css draws it under :focus-visible
// from --focus-ring, and its offset reads the --focus-ring-offset custom
// property with the --focus-offset token as the fallback. A stylesheet that
// must force the state without a keyboard reuses exactly those two
// declarations, and a component moves the ring only by setting the custom
// property on itself. This scan pins that rule over every owned stylesheet
// through the shared owned-stylesheet list and the shared parser, and
// checks declarations, not text lines: a hand-kept folder list misses new
// folders, and line matching misreads any line that is not a plain
// declaration.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, expect, test } from 'vitest'
import { declarationValueSource, lineColumnOf, parseStylesheet } from './styleParse.ts'
import { gatedStyleSheets } from './styleSheets.ts'
import { tokenSourcePath } from './tokenSource.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const ROOT = join(import.meta.dirname, '..')

const RING_VALUE = 'var(--focus-ring)'
const RING_OFFSET_VALUE = 'var(--focus-ring-offset, var(--focus-offset))'
const RING_OWNER = 'src/styles/global.css'

let ringToken: string | undefined
const focusVisibleRules: { file: string; declarations: Map<string, string> }[] = []
const offenders: string[] = []
beforeAll(() => {
  for (const file of gatedStyleSheets(ROOT)) {
    const css = readFileSync(join(ROOT, file), 'utf8')
    const root = parseStylesheet(css, file)
    if (file === tokenSourcePath) {
      root.walkDecls((decl) => {
        if (decl.prop === '--focus-ring') {
          ringToken = decl.value
        }
      })
    }
    root.walkRules((rule) => {
      if (!rule.selectors.some((selector) => selector.includes(':focus-visible'))) {
        return
      }
      const declarations = new Map<string, string>()
      rule.walkDecls((decl) => {
        declarations.set(decl.prop, decl.value)
      })
      focusVisibleRules.push({ file, declarations })
    })
    root.walkDecls((decl) => {
      if (!decl.prop.startsWith('outline')) {
        return
      }
      const matchesRecipe =
        (decl.prop === 'outline' && decl.value === RING_VALUE) ||
        (decl.prop === 'outline-offset' && decl.value === RING_OFFSET_VALUE)
      if (matchesRecipe) {
        return
      }
      const source = declarationValueSource(decl)
      const { line, column } = lineColumnOf(css, source.start)
      offenders.push(`${file}:${line}:${column} ${decl.prop}: ${decl.value}`)
    })
  }
}, TOOL_FIXTURE_TIMEOUT_MS)

test('the tokens define the ring and global.css keeps the only :focus-visible rule', () => {
  expect(ringToken).toBe('var(--focus-width) solid var(--off)')
  expect(focusVisibleRules).toHaveLength(1)
  const owner = focusVisibleRules[0]
  expect(owner?.file).toBe(RING_OWNER)
  expect(owner?.declarations.get('outline')).toBe(RING_VALUE)
  expect(owner?.declarations.get('outline-offset')).toBe(RING_OFFSET_VALUE)
})

test('no stylesheet draws a focus ring outside the recipe', () => {
  expect(offenders).toEqual([])
})
