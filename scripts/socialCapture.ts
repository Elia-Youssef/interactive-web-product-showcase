// The social card capture: for every product with link-preview words it
// writes public/social/<slug>.png, the product's own route at rest in a
// production build, so the card and the landing frame are the same page and
// cannot drift. One command after a build (pnpm assets:social): the script
// starts and stops its own preview server. The pose is the load pose, the
// first finish, assembled, on the desktop layout, waited into with the
// e2e suite's own settle contract.
import { existsSync } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from '@playwright/test'
import { preview } from 'vite'
import { createJiti } from 'jiti'
import { devHost } from '../tooling/devHost.ts'
import { resolveDevPort } from '../tooling/devPort.ts'
import { namedExport } from './manifestIo.ts'
import { loadMetaPages } from './metaPages.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

// The card size of the social platforms, at one device pixel so the shot is
// the CSS layout. The width clears the desktop breakpoint, so the capture
// carries the full frame: top bar, panel, stage and its chrome.
const CARD_VIEWPORT = { width: 1200, height: 630 }
const CARD_DEVICE_SCALE_FACTOR = 1

// The engine of the visual baseline host (the e2e matrix's chrome row): the
// only launch this machine has proven to carry a presented canvas into a
// screenshot.
const CAPTURE_CHANNEL = 'chrome'

// The card-ready contract is the suite's own, loaded across the boundary
// the way the pipeline loads src modules: the helper imports its relatives
// without extensions, which plain Node cannot resolve.
type SettledSocialCard = (page: Page, slug: string) => Promise<void>

function isSettledSocialCard(value: unknown): value is SettledSocialCard {
  return typeof value === 'function'
}

const jiti = createJiti(import.meta.url)
const cardsModule: unknown = await jiti.import('../tests/e2e/socialCards.ts')
const cardsExport = namedExport(cardsModule, 'settledSocialCard', isSettledSocialCard)
if (cardsExport.kind === 'absent') {
  throw new Error("expected a 'settledSocialCard' export in tests/e2e/socialCards.ts")
}
const settledSocialCard = cardsExport.value

async function main(): Promise<void> {
  if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    throw new Error('no build output at dist/index.html: run pnpm build before the capture')
  }
  const { pages, skipped } = await loadMetaPages()

  const port = resolveDevPort(process.env)
  const server = await preview({
    preview: { port, strictPort: true, host: devHost.address },
  })
  const baseURL = `http://${devHost.address}:${port}`

  try {
    const browser = await chromium.launch({ channel: CAPTURE_CHANNEL })
    try {
      const context = await browser.newContext({
        viewport: CARD_VIEWPORT,
        deviceScaleFactor: CARD_DEVICE_SCALE_FACTOR,
      })
      const page = await context.newPage()
      const socialDir = path.join(ROOT, 'public', 'social')
      await mkdir(socialDir, { recursive: true })

      for (const socialPage of pages) {
        await page.goto(`${baseURL}/p/${socialPage.slug}`)
        await settledSocialCard(page, socialPage.slug)
        const file = path.join(socialDir, `${socialPage.slug}.png`)
        await writeFile(file, await page.screenshot())
        process.stdout.write(
          `captured /p/${socialPage.slug} -> public/social/${socialPage.slug}.png ` +
            `${(await stat(file)).size} bytes\n`,
        )
      }
      for (const slug of skipped) {
        process.stdout.write(`skipped /p/${slug}: the manifest declares no meta block\n`)
      }
    } finally {
      await browser.close()
    }
  } finally {
    await server.close()
  }
}

await main()
