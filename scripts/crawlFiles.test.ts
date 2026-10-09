import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { crawlFiles } from '../src/lib/copy/crawl.ts'
import { absoluteUrl } from '../src/lib/copy/meta.ts'
import { formatProductPath } from '../src/lib/routing/index.ts'
import { loadCrawlFiles } from './manifestIo.ts'
import { loadMetaPages } from './metaPages.ts'
import { listManifestSlugs } from './shippedProducts.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const { pages } = await loadMetaPages()
const slugs = pages.map((page) => page.slug)

describe('build crawler files', () => {
  test('robots allows every path and names the absolute sitemap URL', () => {
    expect(crawlFiles(slugs).robotsText).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`,
    )
  })

  test('a changed siteUrl flows into robots and every sitemap URL', () => {
    const siteUrl = 'moved.example.test'
    const generated = crawlFiles(slugs, { siteUrl })
    expect(generated.robotsText).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: https://${siteUrl}/sitemap.xml\n`,
    )
    const urls = [...generated.sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    )
    expect(urls).toEqual(
      ['/', ...slugs.map(formatProductPath)].map((path) => `https://${siteUrl}${path}`),
    )
  })

  test('home and every shipped route appear exactly once, in prerender order', async () => {
    expect(new Set(slugs)).toEqual(new Set(await listManifestSlugs(root)))
    const generated = crawlFiles(slugs)
    const urls = [...generated.sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    )
    expect(urls).toEqual([absoluteUrl('/'), ...pages.map((page) => page.set.canonicalUrl)])
    expect(new Set(urls).size).toBe(urls.length)
  })

  test('fixture products and development pages never appear', async () => {
    const generated = crawlFiles(slugs)
    const fixtures = await readdir(new URL('../tests/fixtures/products/', import.meta.url), {
      withFileTypes: true,
    })
    expect(fixtures.some((entry) => entry.isDirectory())).toBe(true)
    for (const fixture of fixtures.filter((entry) => entry.isDirectory())) {
      expect(generated.sitemapText).not.toContain(formatProductPath(fixture.name))
    }
    expect(generated.sitemapText).not.toContain('/dev/')
  })

  test('the build bridge loads the tested generator', async () => {
    const generate = await loadCrawlFiles()
    expect(generate(slugs)).toEqual(crawlFiles(slugs))
  })

  test('route segments stay URL encoded in XML locations', () => {
    expect(crawlFiles(['one&two']).sitemapText).toContain('/p/one%26two</loc>')
  })
})
