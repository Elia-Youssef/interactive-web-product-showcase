// The deploy check of the build, run after the prerender over the written
// dist/: it lists the files and hands them, with the _headers text, the
// products that carry a meta block and the shipped products, to the pure
// check in deployRules.ts, and fails the build naming each finding.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDeploy, describeFinding } from './deployRules.ts'
import { isMissingFileError } from './fsErrors.ts'
import { loadMetaPages } from './metaPages.ts'
import { listManifestSlugs } from './shippedProducts.ts'
import { loadCrawlFiles } from './manifestIo.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(dir, entry.name), relative)))
    } else {
      files.push(relative)
    }
  }
  return files
}

async function readHeaders(): Promise<string> {
  try {
    return await readFile(path.join(DIST, '_headers'), 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error('no dist/_headers: the host takes its cache rules from public/_headers', {
        cause: error,
      })
    }
    throw error
  }
}

async function readCrawlFile(file: string): Promise<string | null> {
  try {
    return await readFile(path.join(DIST, file), 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) return null
    throw error
  }
}

async function main(): Promise<void> {
  const [files, headersText, { pages }, shippedSlugs, generate, robotsText, sitemapText] =
    await Promise.all([
      listFiles(DIST),
      readHeaders(),
      loadMetaPages(),
      listManifestSlugs(ROOT),
      loadCrawlFiles(),
      readCrawlFile('robots.txt'),
      readCrawlFile('sitemap.xml'),
    ])
  const findings = checkDeploy({
    files,
    headersText,
    metaSlugs: pages.map((page) => page.slug),
    shippedSlugs,
    crawl: { expected: generate(pages.map((page) => page.slug)), robotsText, sitemapText },
  })
  if (findings.length > 0) {
    const lines = findings.map((finding) => `  ${describeFinding(finding)}`)
    throw new Error(`the deploy output has ${findings.length} problem(s):\n${lines.join('\n')}`)
  }
  process.stdout.write(
    `deploy check: ${files.length} files, ${pages.length} route files, rules clean\n`,
  )
}

await main()
