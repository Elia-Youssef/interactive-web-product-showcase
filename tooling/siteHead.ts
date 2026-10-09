import type { Plugin } from 'vite'
import { fillHead } from '../scripts/headFill.ts'
import { loadCopyMeta } from '../scripts/manifestIo.ts'

// Fills the site head before Vite processes the HTML, in build and serve
// modes. Each transform loads the copy builder through the pipeline's bridge,
// so the source template owns no metadata and no second writer exists.
export function siteHeadPlugin(): Plugin {
  return {
    name: 'site-head',
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const copyMeta = await loadCopyMeta()
        return fillHead(html, copyMeta.siteMetaSet())
      },
    },
  }
}
