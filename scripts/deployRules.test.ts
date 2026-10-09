// The deploy check's contract, over in-memory file lists and rule text (no
// build output is read): a clean site passes, and each finding kind has its
// own case. The hash shape comes from the build's own name pattern, so the
// fixtures build their hashed names the way the bundler does.
import { describe, expect, test } from 'vitest'
import {
  checkDeploy,
  parseHeaders,
  productOfOutput,
  routeFilePath,
  ruleMatches,
} from './deployRules.ts'
import { hashLength, isHashedName, patternExpression } from '../tooling/outputNaming.ts'

const HASH = 'a1B2c3_-'.repeat(2).slice(0, hashLength)

const RULES = `# comment
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/models/*
  Cache-Control: public, max-age=0, must-revalidate
`

const CLEAN_FILES = [
  'index.html',
  '_headers',
  `assets/index-${HASH}.js`,
  `assets/index-${HASH}.css`,
  'models/one/model.glb',
  'p/one.html',
]

const clean = { files: CLEAN_FILES, headersText: RULES, metaSlugs: ['one'], shippedSlugs: ['one'] }

describe('the hash shape', () => {
  test('is derived from the build patterns', () => {
    expect(isHashedName(`assets/index-${HASH}.js`)).toBe(true)
    expect(isHashedName(`assets/index-${HASH}.css`)).toBe(true)
    expect(isHashedName(`assets/index-${HASH}.woff2`)).toBe(true)
    expect(isHashedName('assets/index.js')).toBe(false)
    expect(isHashedName(`assets/index-${HASH}x.js`)).toBe(false)
    expect(isHashedName(`models/index-${HASH}.js`)).toBe(false)
  })

  test('an unknown placeholder in a pattern fails loudly', () => {
    expect(() => patternExpression('assets/[name]-[stamp][extname]')).toThrow(/unknown/)
  })
})

describe('the headers parser and matcher', () => {
  test('reads patterns, headers and skips comments', () => {
    const { rules, findings } = parseHeaders(RULES)
    expect(findings).toEqual([])
    expect(rules.map((rule) => [rule.line, rule.pattern, rule.headers.length])).toEqual([
      [2, '/assets/*', 1],
      [5, '/models/*', 1],
    ])
  })

  test('a splat matches across folders, a plain pattern only itself', () => {
    expect(ruleMatches('/models/*', 'models/a/b.glb')).toBe(true)
    expect(ruleMatches('/models/*', 'env/a.hdr')).toBe(false)
    expect(ruleMatches('/_headers', '_headers')).toBe(true)
    expect(ruleMatches('/_headers', 'x/_headers')).toBe(false)
  })

  test('a pattern with two splats is a finding', () => {
    const { findings } = parseHeaders('/a/*/b/*\n  X-Test: 1\n')
    expect(findings).toEqual([expect.objectContaining({ kind: 'badRule', line: 1 })])
  })
})

describe('the deploy check', () => {
  test('a clean site has no findings', () => {
    expect(checkDeploy(clean)).toEqual([])
  })

  test('an immutable rule over an unhashed file is a finding', () => {
    const files = [...CLEAN_FILES, 'assets/plain.js']
    expect(checkDeploy({ ...clean, files })).toEqual([
      { kind: 'unhashedImmutable', file: 'assets/plain.js', rule: '/assets/*' },
    ])
  })

  test('a rule that matches no file is a finding', () => {
    const headersText = `${RULES}\n/brand/*\n  Cache-Control: public, max-age=0, must-revalidate\n`
    expect(checkDeploy({ ...clean, headersText })).toEqual([
      { kind: 'staleRule', rule: '/brand/*' },
    ])
  })

  test('two rules setting one header on one file are a finding', () => {
    const headersText = `${RULES}\n/models/one/*\n  cache-control: no-store\n`
    expect(checkDeploy({ ...clean, headersText })).toEqual([
      {
        kind: 'overlappingRules',
        file: 'models/one/model.glb',
        header: 'cache-control',
        rules: ['/models/*', '/models/one/*'],
      },
    ])
  })

  test('two rules setting different headers on one file are fine', () => {
    const headersText = `${RULES}\n/models/one/*\n  X-Test: 1\n`
    expect(checkDeploy({ ...clean, headersText })).toEqual([])
  })

  test('a top-level 404.html is a finding', () => {
    expect(checkDeploy({ ...clean, files: [...CLEAN_FILES, '404.html'] })).toEqual([
      { kind: 'topLevel404', file: '404.html' },
    ])
  })

  test('a product without its route file is a finding', () => {
    const files = CLEAN_FILES.filter((file) => file !== routeFilePath('one'))
    expect(checkDeploy({ ...clean, files })).toEqual([
      { kind: 'missingRouteFile', slug: 'one', file: 'p/one.html' },
    ])
  })

  test('every per-product output of a product that does not ship is a finding', () => {
    const files = [
      ...CLEAN_FILES,
      'social/one.png',
      'models/fixture-speaker/model.glb',
      'p/fixture-speaker.html',
      'social/fixture-speaker.png',
    ]
    expect(checkDeploy({ ...clean, files })).toEqual([
      {
        kind: 'unshippedProductOutput',
        slug: 'fixture-speaker',
        file: 'models/fixture-speaker/model.glb',
      },
      { kind: 'unshippedProductOutput', slug: 'fixture-speaker', file: 'p/fixture-speaker.html' },
      {
        kind: 'unshippedProductOutput',
        slug: 'fixture-speaker',
        file: 'social/fixture-speaker.png',
      },
    ])
  })

  test('the per-product outputs name their product by slug, and nothing else is one', () => {
    expect(productOfOutput('models/one/model.glb')).toBe('one')
    expect(productOfOutput('p/one.html')).toBe('one')
    expect(productOfOutput('social/one.png')).toBe('one')
    expect(productOfOutput('index.html')).toBeNull()
    expect(productOfOutput('env/studio.hdr')).toBeNull()
  })

  test('the old folder layout is a finding', () => {
    const files = [...CLEAN_FILES, 'p/one/index.html']
    expect(checkDeploy({ ...clean, files })).toEqual([
      { kind: 'oldRouteLayout', slug: 'one', file: 'p/one/index.html' },
    ])
  })
})
