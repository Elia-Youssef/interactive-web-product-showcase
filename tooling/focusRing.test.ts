// The focus ring has one recipe: global.css draws it under :focus-visible
// from --focus-ring, and its offset reads the --focus-ring-offset custom
// property with the --focus-offset token as the fallback. A stylesheet that
// must force the state without a keyboard reuses exactly those two
// declarations, and a component moves the ring only by setting the custom
// property on itself. This scan pins that rule over every stylesheet in the
// repo, so no primitive can grow a second, diverging focus ring. It reads
// sources as text, so it lives with the tooling instead of a component.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const STYLE_DIRS = ['src/styles', 'src/ui', 'src/app/gallery']

const OUTLINE_RECIPE = 'outline: var(--focus-ring);'
const OFFSET_RECIPE = 'outline-offset: var(--focus-ring-offset, var(--focus-offset));'

function stylesheets(): { file: string; css: string }[] {
  const found: { file: string; css: string }[] = []
  for (const dir of STYLE_DIRS) {
    for (const entry of readdirSync(join(ROOT, dir), {
      recursive: true,
      encoding: 'utf8',
    })) {
      if (!entry.endsWith('.css')) {
        continue
      }
      found.push({
        file: `${dir}/${entry.replaceAll('\\', '/')}`,
        css: readFileSync(join(ROOT, dir, entry), 'utf8'),
      })
    }
  }
  return found
}

test('the tokens define the ring and global.css keeps the only :focus-visible rule', () => {
  const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8')
  const global = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8')

  expect(tokens).toContain('--focus-ring: var(--focus-width) solid var(--off);')
  expect(global.match(/:focus-visible/g)).toHaveLength(1)
  expect(global).toContain(OUTLINE_RECIPE)
  expect(global).toContain(OFFSET_RECIPE)
})

test('no stylesheet draws a focus ring outside the recipe', () => {
  const offenders: string[] = []
  for (const { file, css } of stylesheets()) {
    for (const line of css.split('\n')) {
      const declaration = line.trim()
      if (!declaration.startsWith('outline')) {
        continue
      }
      if (declaration !== OUTLINE_RECIPE && declaration !== OFFSET_RECIPE) {
        offenders.push(`${file}: ${declaration}`)
      }
    }
  }

  expect(offenders).toEqual([])
})
