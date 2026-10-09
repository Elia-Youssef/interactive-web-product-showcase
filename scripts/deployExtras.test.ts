import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'
import { crawlFiles } from '../src/lib/copy/crawl.ts'
import { checkDeploy, describeFinding } from './deployRules.ts'
import { cspDirectives, securityHeaders } from './deploySecurity.ts'

const headersText = await readFile(new URL('../public/_headers', import.meta.url), 'utf8')
const expected = crawlFiles(['one', 'two'])
const clean = {
  files: [
    'index.html',
    'p/one.html',
    'p/two.html',
    'robots.txt',
    'sitemap.xml',
    'assets/index-a1B2c3_d.js',
    'models/one/model.glb',
    'env/studio.hdr',
    'fonts/sans.woff2',
    'social/one.png',
  ],
  headersText,
  metaSlugs: ['one', 'two'],
  shippedSlugs: ['one', 'two'],
  crawl: { expected, robotsText: expected.robotsText, sitemapText: expected.sitemapText },
}

describe('crawler deploy rules', () => {
  test('the shipped headers and generated crawler files pass', () => {
    expect(checkDeploy(clean)).toEqual([])
  })

  test.each(['robots.txt', 'sitemap.xml'])('a missing %s fails by name', (file) => {
    const findings = checkDeploy({ ...clean, files: clean.files.filter((entry) => entry !== file) })
    expect(findings).toEqual([{ kind: 'missingCrawlFile', file }])
    expect(describeFinding(findings[0] ?? { kind: 'invalidSitemap' })).toContain(file)
  })

  test.each(['/p/stray', '/dev/harness', '/p/fixture-speaker'])(
    'a planted stray route %s fails by name',
    (route) => {
      const url = new URL(route, expected.routeUrls[0]).href
      const sitemapText = expected.sitemapText.replace(
        '</urlset>',
        `<url><loc>${url}</loc></url></urlset>`,
      )
      const findings = checkDeploy({ ...clean, crawl: { ...clean.crawl, sitemapText } })
      expect(findings).toEqual([{ kind: 'straySitemapUrl', url }])
      expect(findings.map(describeFinding).join('\n')).toContain(url)
    },
  )

  test('a sitemap URL on another host fails even for a shipped path', () => {
    const url = 'https://other.example.test/p/one'
    const sitemapText = expected.sitemapText.replace(
      '</urlset>',
      `<url><loc>${url}</loc></url></urlset>`,
    )
    expect(checkDeploy({ ...clean, crawl: { ...clean.crawl, sitemapText } })).toEqual([
      { kind: 'straySitemapUrl', url },
    ])
  })

  test('a missing route file fails even when the sitemap names its route', () => {
    expect(
      checkDeploy({ ...clean, files: clean.files.filter((file) => file !== 'p/two.html') }),
    ).toEqual([{ kind: 'missingRouteFile', slug: 'two', file: 'p/two.html' }])
  })

  test('a sitemap cannot omit a route, duplicate it or carry malformed XML', () => {
    const url = expected.routeUrls[0]
    if (url === undefined) throw new Error('the home URL is missing')
    const omitted = expected.sitemapText.replace(`  <url><loc>${url}</loc></url>\n`, '')
    const duplicate = expected.sitemapText.replace(
      '</urlset>',
      `<url><loc>${url}</loc></url></urlset>`,
    )
    for (const [sitemapText, finding] of [
      [omitted, { kind: 'missingSitemapUrl', url }],
      [duplicate, { kind: 'duplicateSitemapUrl', url }],
      [expected.sitemapText.replace('</urlset>', '<broken></urlset>'), { kind: 'invalidSitemap' }],
    ] as const) {
      expect(checkDeploy({ ...clean, crawl: { ...clean.crawl, sitemapText } })).toEqual([finding])
    }
  })

  test('robots must retain unrestricted crawling and the generated sitemap URL', () => {
    const robotsText = expected.robotsText.replace('Allow: /', 'Disallow: /')
    expect(checkDeploy({ ...clean, crawl: { ...clean.crawl, robotsText } })).toEqual([
      { kind: 'invalidRobots' },
    ])
  })
})

describe('security headers for every path', () => {
  test.each(Object.keys(securityHeaders))('a planted missing %s fails by name', (header) => {
    const planted = headersText
      .split('\n')
      .filter((line) => !line.trimStart().startsWith(`${header}:`))
      .join('\n')
    expect(planted).not.toContain(`${header}:`)
    const findings = checkDeploy({ ...clean, headersText: planted })
    expect(findings).toEqual([
      {
        kind: 'requiredSecurityHeader',
        header,
        detail: 'must occur once on /* with the required policy',
      },
    ])
    expect(findings.map(describeFinding).join('\n')).toContain(header)
  })

  test('a policy limited to assets cannot protect public and unknown routes', () => {
    const findings = checkDeploy({
      ...clean,
      headersText: headersText.replace('\n/*\n', '\n/assets/*\n'),
    })
    expect(findings.filter((finding) => finding.kind === 'requiredSecurityHeader')).toHaveLength(
      Object.keys(securityHeaders).length,
    )
  })

  test.each(Object.entries(cspDirectives))(
    'a changed CSP directive %s fails',
    (directive, sources) => {
      const planted = headersText.replace(`${directive} ${sources}`, `${directive} *`)
      expect(planted).not.toBe(headersText)
      expect(checkDeploy({ ...clean, headersText: planted })).toContainEqual(
        expect.objectContaining({
          kind: 'requiredSecurityHeader',
          header: 'Content-Security-Policy',
        }),
      )
    },
  )

  test('a narrow override cannot weaken a universal security header', () => {
    const planted = `${headersText}\n/p/one\n  X-Frame-Options: SAMEORIGIN\n`
    expect(checkDeploy({ ...clean, headersText: planted })).toContainEqual(
      expect.objectContaining({ kind: 'requiredSecurityHeader', header: 'X-Frame-Options' }),
    )
  })
})
