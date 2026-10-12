import { formatProductPath } from '../routing'
import { absoluteUrl } from './meta'
import { siteCopy } from './site'

export type CrawlFiles = {
  readonly routeUrls: readonly string[]
  readonly robotsText: string
  readonly sitemapText: string
}

function xmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Slugs come from the prerender's discovered pages, never from fixtures or
// a separate collection list. The URL builder owns the scheme for both files.
export function crawlFiles(
  slugs: readonly string[],
  site: { readonly siteUrl: string } = siteCopy,
): CrawlFiles {
  const routeUrls = ['/', ...slugs.map(formatProductPath)].map((path) =>
    absoluteUrl(path, site.siteUrl),
  )
  return {
    routeUrls,
    robotsText: `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml', site.siteUrl)}\n`,
    sitemapText: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...routeUrls.map((url) => `  <url><loc>${xmlText(url)}</loc></url>`),
      '</urlset>\n',
    ].join('\n'),
  }
}
