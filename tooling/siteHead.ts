import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { fillSiteHead } from '../scripts/headFill.ts'
import { loadCopyMeta } from '../scripts/manifestIo.ts'

// Owns only the site's entry, identified by its resolved filename rather
// than the request URL. Other HTML entries keep their own heads, while site
// fallback routes share the same writer in build and serve modes.
export function siteHeadPlugin(): Plugin {
  let siteEntry: string
  let base: string
  return {
    name: 'site-head',
    configResolved(config) {
      siteEntry = resolve(config.root, 'index.html')
      base = config.base
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        if (resolve(context.filename) !== siteEntry) {
          return html
        }
        const copyMeta = await loadCopyMeta()
        return fillSiteHead(html, copyMeta.siteMetaSet(), base)
      },
    },
  }
}
