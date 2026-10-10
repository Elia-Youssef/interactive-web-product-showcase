import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { resolveConfig } from 'vite'
import type { IndexHtmlTransformHook } from 'vite'
import { beforeAll, describe, expect, test } from 'vitest'
import { fillSiteHead } from '../scripts/headFill.ts'
import { loadCopyMeta } from '../scripts/manifestIo.ts'
import { TOOL_FIXTURE_TIMEOUT_MS } from './subprocess.fixtures.ts'

const ROOT = join(import.meta.dirname, '..')
const SITE_ENTRY = 'index.html'

// Discover every entry so a new development page inherits the ownership
// contract without a list of exceptions or a test-table edit.
const htmlFiles = readdirSync(ROOT, { withFileTypes: true })
  .filter((file) => file.isFile() && extname(file.name).toLowerCase() === '.html')
  .map((file) => file.name)
  .sort()

describe('the configured site-head HTML hook', () => {
  const heads = new Map<string, { original: string; result: unknown; expected: string }>()

  beforeAll(async () => {
    let transform: OmitThisParameter<IndexHtmlTransformHook> | undefined
    await resolveConfig(
      {
        root: ROOT,
        base: '/portfolio/',
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
    if (transform === undefined) throw new Error('the configured HTML hook did not resolve')
    for (const file of htmlFiles) {
      const original = await readFile(join(ROOT, file), 'utf8')
      const result = await transform(original, {
        // The entry filename owns the head even when the request is a site
        // fallback route, or another page is requested through an alias.
        path: file === SITE_ENTRY ? '/p/sample' : '/',
        filename: join(ROOT, file),
      })
      const expected =
        file === SITE_ENTRY
          ? fillSiteHead(original, (await loadCopyMeta()).siteMetaSet(), '/portfolio/')
          : original
      heads.set(file, { original, result, expected })
    }
  }, TOOL_FIXTURE_TIMEOUT_MS)

  test.each(htmlFiles)('%s receives only the head its entry owns', (file) => {
    const head = heads.get(file)
    if (head === undefined) throw new Error(`missing head evidence for ${file}`)
    if (file === SITE_ENTRY) {
      expect(head.result).toBe(head.expected)
      expect(head.result).not.toBe(head.original)
    } else {
      expect(head.result).toBe(head.original)
    }
  })
})
