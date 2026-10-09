import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { resolveConfig } from 'vite'
import type { IndexHtmlTransformHook } from 'vite'
import { beforeAll, describe, expect, test } from 'vitest'
import { fillHead } from '../scripts/headFill.ts'
import { loadCopyMeta } from '../scripts/manifestIo.ts'

const ROOT = join(import.meta.dirname, '..')
const SITE_ENTRY = 'index.html'

// Discover every entry so a new development page inherits the ownership
// contract without a list of exceptions or a test-table edit.
const htmlFiles = readdirSync(ROOT, { withFileTypes: true })
  .filter((file) => file.isFile() && extname(file.name).toLowerCase() === '.html')
  .map((file) => file.name)
  .sort()

describe('the configured site-head HTML hook', () => {
  let transform: OmitThisParameter<IndexHtmlTransformHook>

  beforeAll(async () => {
    await resolveConfig(
      {
        root: ROOT,
        configFile: join(ROOT, 'vite.config.ts'),
        // Bind the configured handler to Vite's real global hook context.
        plugins: [
          {
            name: 'html-hook-context',
            configResolved(config) {
              const hook = config.plugins.find(
                (plugin) => plugin.name === 'site-head',
              )?.transformIndexHtml
              if (hook === undefined) {
                throw new Error('the configured site-head HTML hook is missing')
              }
              transform = (typeof hook === 'function' ? hook : hook.handler).bind(this)
            },
          },
        ],
      },
      'serve',
    )
  })

  test.each(htmlFiles)('%s receives only the head its entry owns', async (file) => {
    const original = await readFile(join(ROOT, file), 'utf8')
    const result = await transform(original, {
      // The entry filename owns the head even when the request is a site
      // fallback route, or another page is requested through an alias.
      path: file === SITE_ENTRY ? '/p/sample' : '/',
      filename: join(ROOT, file),
    })
    if (file === SITE_ENTRY) {
      const copyMeta = await loadCopyMeta()
      expect(result).toBe(fillHead(original, copyMeta.siteMetaSet()))
      expect(result).not.toBe(original)
    } else {
      expect(result).toBe(original)
    }
  })
})
