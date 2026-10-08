// The prerender step of the build: for every product with a meta block it
// writes dist/p/<slug>.html, the built index.html with the page's
// head tags filled by the copy builder. Most link-preview crawlers execute
// no JavaScript, so the SPA's runtime document title is not enough on a
// deep link; the host serves these files instead (with no SPA rewrite of
// /p/*), and serves /p/<slug> from the file with no trailing-slash redirect,
// which a folder index.html would get. The root file is held against the site head set, and every route
// file is read back after the write and held against the builder's own
// set, so neither the root nor a route can drift from the words.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMissingFileError } from './fsErrors.ts'
import { routeFilePath } from './deployRules.ts'
import { driftedSlot, fillHead } from './headFill.ts'
import { loadMetaPages } from './metaPages.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

async function readBuiltIndex(): Promise<string> {
  const file = path.join(ROOT, 'dist', 'index.html')
  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error('no build output at dist/index.html: run the build before the prerender', {
        cause: error,
      })
    }
    throw error
  }
}

async function main(): Promise<void> {
  const indexHtml = await readBuiltIndex()
  const { site, pages, skipped } = await loadMetaPages()
  const siteDrift = driftedSlot(indexHtml, site)
  if (siteDrift !== null) {
    throw new Error(`the built index.html does not carry the site head set: ${siteDrift}`)
  }
  for (const page of pages) {
    const routeFile = path.join(ROOT, 'dist', routeFilePath(page.slug))
    await mkdir(path.dirname(routeFile), { recursive: true })
    await writeFile(routeFile, fillHead(indexHtml, page.set))
    const routeDrift = driftedSlot(await readFile(routeFile, 'utf8'), page.set)
    if (routeDrift !== null) {
      throw new Error(
        `the written ${path.relative(ROOT, routeFile)} does not carry the builder's words: ${routeDrift}`,
      )
    }
    process.stdout.write(`prerendered /p/${page.slug}\n`)
  }
  for (const slug of skipped) {
    process.stdout.write(`skipped /p/${slug}: the manifest declares no meta block\n`)
  }
}

await main()
