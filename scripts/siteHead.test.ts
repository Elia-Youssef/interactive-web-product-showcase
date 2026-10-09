// The source carries empty slots, and the configured Vite transform fills
// them from the real builder in build and serve modes. A copied checkout
// changes only siteUrl, so the production files prove the go-live path.
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { MetaHeadSet } from '../src/lib/copy/meta.ts'
import { listOwnedFiles } from '../tooling/ownedFiles.ts'
import { routeFilePath } from './deployRules.ts'
import type { MetaPages } from './metaPages.ts'

const ROOT = join(import.meta.dirname, '..')
const HOST = 'head-change.example.test'
const RELOAD_HOST = 'head-reload.example.test'

// These assertions read the tags independently of the writer's slot table,
// so a slot omitted by both the writer and its drift check still fails.
const SLOTS: readonly {
  readonly label: string
  readonly key: keyof MetaHeadSet
  readonly pattern: RegExp
}[] = [
  { label: 'title', key: 'title', pattern: /<title>([\s\S]*?)<\/title>/ },
  { label: 'description', key: 'description', pattern: /name="description"\s+content="([^"]*)"/ },
  { label: 'canonical', key: 'canonicalUrl', pattern: /rel="canonical"\s+href="([^"]*)"/ },
  { label: 'og:type', key: 'socialType', pattern: /property="og:type"\s+content="([^"]*)"/ },
  {
    label: 'og:site_name',
    key: 'socialSiteName',
    pattern: /property="og:site_name"\s+content="([^"]*)"/,
  },
  { label: 'og:title', key: 'socialTitle', pattern: /property="og:title"\s+content="([^"]*)"/ },
  {
    label: 'og:description',
    key: 'socialDescription',
    pattern: /property="og:description"\s+content="([^"]*)"/,
  },
  { label: 'og:url', key: 'canonicalUrl', pattern: /property="og:url"\s+content="([^"]*)"/ },
  { label: 'og:image', key: 'socialImageUrl', pattern: /property="og:image"\s+content="([^"]*)"/ },
  { label: 'twitter:card', key: 'twitterCard', pattern: /name="twitter:card"\s+content="([^"]*)"/ },
  {
    label: 'twitter:title',
    key: 'socialTitle',
    pattern: /name="twitter:title"\s+content="([^"]*)"/,
  },
  {
    label: 'twitter:description',
    key: 'socialDescription',
    pattern: /name="twitter:description"\s+content="([^"]*)"/,
  },
  {
    label: 'twitter:image',
    key: 'socialImageUrl',
    pattern: /name="twitter:image"\s+content="([^"]*)"/,
  },
]

function assertHead(html: string, set: MetaHeadSet, oldHost: string, host = HOST): void {
  for (const slot of SLOTS) {
    expect(slot.pattern.exec(html)?.[1], slot.label).toBe(set[slot.key])
  }
  expect(set.canonicalUrl).toContain(`https://${host}/`)
  expect(set.socialImageUrl).toContain(`https://${host}/social/`)
  expect(html).not.toContain(oldHost)
}

test('the source template contains only empty builder slots and no absolute URLs', () => {
  const source = readFileSync(join(ROOT, 'index.html'), 'utf8')
  for (const slot of SLOTS) {
    expect(slot.pattern.exec(source)?.[1], `${slot.label} must be empty in index.html`).toBe('')
  }
  expect(source, 'index.html must contain no absolute URL').not.toMatch(/(?:https?:)?\/\//)
})

// This script runs in the copied checkout, through its own bridge and Vite
// configuration. Serve mode resolves and calls the HTML hook without opening
// a server or a browser. No test-only metadata enters the production plugin.
const EVIDENCE_SCRIPT = `
import { readFile, writeFile } from 'node:fs/promises'
import { build, resolveConfig } from 'vite'
import { loadMetaPages } from './metaPages.ts'

if (process.argv[2] === 'build') {
  await build()
  await import('./prerender.ts')
  await import('./deployCheck.ts')
} else {
  const config = await resolveConfig({}, 'serve')
  const plugin = config.plugins.find((item) => item.name === 'site-head')
  const hook = plugin?.transformIndexHtml
  if (hook === undefined) throw new Error('the configured site-head HTML transform is missing')
  const handler = typeof hook === 'function' ? hook : hook.handler
  const source = await readFile('index.html', 'utf8')
  const context = { path: '/', filename: config.root + '/index.html' }
  const html = await handler(source, context)
  if (typeof html !== 'string') throw new Error('the site-head transform must return filled HTML')
  await writeFile('dev-head.html', html)

  const siteFile = 'src/lib/copy/site.ts'
  const siteSource = await readFile(siteFile, 'utf8')
  const changed = siteSource.replace("siteUrl: '${HOST}'", "siteUrl: '${RELOAD_HOST}'")
  if (changed === siteSource) throw new Error('the second siteUrl edit did not apply')
  try {
    await writeFile(siteFile, changed)
    const refreshed = await handler(source, context)
    if (typeof refreshed !== 'string') throw new Error('the refreshed head must be HTML')
    await writeFile('dev-refreshed.html', refreshed)
    await writeFile('dev-refreshed-meta.json', JSON.stringify(await loadMetaPages()))
  } finally {
    await writeFile(siteFile, siteSource)
  }
}
await writeFile('meta-pages.json', JSON.stringify(await loadMetaPages()))
`

describe('a changed siteUrl', () => {
  let copyRoot: string
  let oldHost: string

  beforeAll(() => {
    const scratch = join(ROOT, 'scratch')
    mkdirSync(scratch, { recursive: true })
    copyRoot = mkdtempSync(join(scratch, 'site-head-'))
    for (const file of listOwnedFiles(ROOT)) {
      const target = join(copyRoot, file)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(join(ROOT, file), target)
    }
    symlinkSync(join(ROOT, 'node_modules'), join(copyRoot, 'node_modules'), 'junction')
    const siteFile = join(copyRoot, 'src', 'lib', 'copy', 'site.ts')
    const source = readFileSync(siteFile, 'utf8')
    const match = /siteUrl: '([^']+)'/.exec(source)
    if (match?.[1] === undefined) {
      throw new Error('the siteUrl change must find the configured host')
    }
    oldHost = match[1]
    const changed = source.replace(`siteUrl: '${oldHost}'`, `siteUrl: '${HOST}'`)
    expect(changed, 'the siteUrl change must apply').not.toBe(source)
    writeFileSync(siteFile, changed)
    expect(readFileSync(siteFile, 'utf8')).toContain(`siteUrl: '${HOST}'`)
    writeFileSync(join(copyRoot, 'scripts', 'siteHeadEvidence.ts'), EVIDENCE_SCRIPT)
  })

  afterAll(() => {
    expect(copyRoot.startsWith(join(ROOT, 'scratch') + sep)).toBe(true)
    rmSync(copyRoot, { recursive: true, force: true })
  })

  test('fills every built head slot and every prerendered route without the old host', () => {
    const output = execFileSync(process.execPath, ['scripts/siteHeadEvidence.ts', 'build'], {
      cwd: copyRoot,
      encoding: 'utf8',
    })
    writeFileSync(join(ROOT, 'scratch', 'site-head-build.log'), output)
    const meta: MetaPages = JSON.parse(readFileSync(join(copyRoot, 'meta-pages.json'), 'utf8'))
    expect(meta.pages.length).toBeGreaterThan(0)
    expect(meta.skipped).toEqual([])
    const coveredKeys = [...new Set(SLOTS.map((slot) => slot.key))].sort()
    expect(coveredKeys).toEqual(Object.keys(meta.site).sort())
    assertHead(readFileSync(join(copyRoot, 'dist', 'index.html'), 'utf8'), meta.site, oldHost)
    for (const page of meta.pages) {
      assertHead(
        readFileSync(join(copyRoot, 'dist', routeFilePath(page.slug)), 'utf8'),
        page.set,
        oldHost,
      )
    }
  })

  test('fills the same slots through the configured development HTML transform', () => {
    execFileSync(process.execPath, ['scripts/siteHeadEvidence.ts'], { cwd: copyRoot })
    const meta: MetaPages = JSON.parse(readFileSync(join(copyRoot, 'meta-pages.json'), 'utf8'))
    assertHead(readFileSync(join(copyRoot, 'dev-head.html'), 'utf8'), meta.site, oldHost)
    const refreshedMeta: MetaPages = JSON.parse(
      readFileSync(join(copyRoot, 'dev-refreshed-meta.json'), 'utf8'),
    )
    const refreshed = readFileSync(join(copyRoot, 'dev-refreshed.html'), 'utf8')
    assertHead(refreshed, refreshedMeta.site, oldHost, RELOAD_HOST)
    expect(refreshed).not.toContain(HOST)
  })
})
