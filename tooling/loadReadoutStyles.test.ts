// The loading readout's own pins, read from the token sheet and the readout
// module itself: the reveal delay is a plain unscaled value (a delay
// multiplied by the motion scale would vanish under reduced motion and
// flash the readout on every fast load), the fade and the fill scale, the
// marching segment's reduction is the module's own query and never the
// scale, and the phone breakpoint flips the placement pair.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { parseStylesheet } from './styleParse.ts'
import { tokenSourcePath } from './tokenSource.ts'

const ROOT = join(import.meta.dirname, '..')

function rootToken(name: string): string {
  const css = readFileSync(join(ROOT, tokenSourcePath), 'utf8')
  const found: string[] = []
  parseStylesheet(css, tokenSourcePath).walkRules(':root', (rule) => {
    if (rule.parent?.type !== 'root') {
      return
    }
    rule.walkDecls((decl) => {
      if (decl.prop === name) {
        found.push(decl.value.trim())
      }
    })
  })
  if (found.length !== 1) {
    throw new Error(`token ${name} is declared ${found.length} times in :root, expected one`)
  }
  return found[0] ?? ''
}

// Every declaration of the token sheet's media blocks of one prelude.
function mediaDecls(prelude: string): Map<string, string> {
  const css = readFileSync(join(ROOT, tokenSourcePath), 'utf8')
  const found = new Map<string, string>()
  parseStylesheet(css, tokenSourcePath).walkAtRules('media', (atrule) => {
    if (!atrule.params.includes(prelude)) {
      return
    }
    atrule.walkDecls((decl) => {
      found.set(decl.prop, decl.value.trim())
    })
  })
  return found
}

test('the reveal delay is a plain value the motion scale never multiplies', () => {
  expect(rootToken('--delay-load-readout')).toBe('800ms')
  expect(rootToken('--delay-load-readout')).not.toContain('motion-scale')
})

test('the fade and the fill scale with the motion scale, and the march does not', () => {
  for (const name of ['--duration-load-reveal', '--duration-load-fill']) {
    expect(rootToken(name), name).toContain('var(--motion-scale)')
  }
  // The marching segment has one reduced-motion mechanism, the module's
  // own query; a scaled duration beside it would be a second one.
  expect(rootToken('--duration-load-march')).toBe('1400ms')
})

// The readout module's reduced-motion block: the marching segment rests.
function moduleDecls(className: string, prelude: string): Map<string, string> {
  const css = readFileSync(join(ROOT, 'src/features/load-readout/LoadReadout.module.css'), 'utf8')
  const found = new Map<string, string>()
  parseStylesheet(css, 'src/features/load-readout/LoadReadout.module.css').walkAtRules(
    'media',
    (atrule) => {
      if (!atrule.params.includes(prelude)) {
        return
      }
      atrule.walkRules((rule) => {
        if (!rule.selector.includes(className)) {
          return
        }
        rule.walkDecls((decl) => {
          found.set(decl.prop, decl.value.trim())
        })
      })
    },
  )
  return found
}

test('the readout module rests the marching segment under reduced motion', () => {
  const march = moduleDecls('.march', 'prefers-reduced-motion')

  expect(march.get('animation')).toBe('none')
  expect(march.get('opacity')).toBe('var(--load-march-rest-alpha)')
})

test('the phone breakpoint flips the placement pair to center the readout', () => {
  const phone = mediaDecls('--vp-phone')

  expect(phone.get('--offset-load-readout-block-end')).toBe('50%')
  expect(phone.get('--offset-load-readout-block-shift')).toBe('50%')
  expect(rootToken('--offset-load-readout-block-end')).toBe('96px')
  expect(rootToken('--offset-load-readout-block-shift')).toBe('0%')
})
