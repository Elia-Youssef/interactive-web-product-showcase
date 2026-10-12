import type { CrawlFiles } from '../src/lib/copy/crawl.ts'

export type CrawlInput = {
  readonly expected: CrawlFiles
  readonly robotsText: string | null
  readonly sitemapText: string | null
}

export type CrawlFinding =
  | { readonly kind: 'missingCrawlFile'; readonly file: string }
  | { readonly kind: 'invalidRobots' }
  | { readonly kind: 'invalidSitemap' }
  | { readonly kind: 'straySitemapUrl'; readonly url: string }
  | { readonly kind: 'missingSitemapUrl'; readonly url: string }
  | { readonly kind: 'duplicateSitemapUrl'; readonly url: string }

// Only the sitemap vocabulary the generator writes is accepted. Removing
// recognized nodes must leave whitespace, so malformed XML cannot pass by
// hiding extra elements between otherwise valid locations.
function sitemapUrls(text: string): string[] | null {
  const body =
    /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">([\s\S]*)<\/urlset>\s*$/.exec(
      text,
    )?.[1]
  if (body === undefined) return null
  const urls: string[] = []
  const remainder = body.replace(
    /<url>\s*<loc>([^<]*)<\/loc>\s*<\/url>/g,
    (_node: string, url: string) => {
      urls.push(url.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
      return ''
    },
  )
  return remainder.trim() === '' ? urls : null
}

export function checkCrawlFiles(input: CrawlInput, files: ReadonlySet<string>): CrawlFinding[] {
  const findings: CrawlFinding[] = []
  for (const file of ['robots.txt', 'sitemap.xml']) {
    if (!files.has(file)) findings.push({ kind: 'missingCrawlFile', file })
  }
  if (input.robotsText !== null && input.robotsText !== input.expected.robotsText) {
    findings.push({ kind: 'invalidRobots' })
  }
  if (input.sitemapText === null) return findings
  const urls = sitemapUrls(input.sitemapText)
  if (urls === null) return [...findings, { kind: 'invalidSitemap' }]
  const expected = new Set(input.expected.routeUrls)
  const seen = new Set<string>()
  for (const url of urls) {
    if (!expected.has(url)) findings.push({ kind: 'straySitemapUrl', url })
    if (seen.has(url)) findings.push({ kind: 'duplicateSitemapUrl', url })
    seen.add(url)
  }
  for (const url of expected) {
    if (!seen.has(url)) findings.push({ kind: 'missingSitemapUrl', url })
  }
  return findings
}
