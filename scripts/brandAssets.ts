import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { brandColors, rasterize } from './brandRaster.ts'
import { raBox, raPolygon, raViewBox } from '../src/ui/raGeometry.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const pageRingSize = 128
const faviconRingSize = 256
const faviconSize = 32
const appleSize = 180

// The share of the icon tile the mark spans: the ring and the R are drawn
// centered at this fraction of the tile, so the brush stroke never touches
// the icon edge at any size the set rasterizes to.
const faviconContentShare = 0.84

// Embedded raster preserves the brush texture; the glyph remains a polygon.
export function buildFaviconSvg(ring: Uint8Array, bg: string, white: string): string {
  const data = Buffer.from(ring).toString('base64')
  // The content group scales about the tile's center: the center point
  // stays, so the mark keeps its place and spans the named content share.
  const inset = ((raBox * (1 - faviconContentShare)) / 2).toFixed(1)
  const content = `translate(${inset} ${inset}) scale(${faviconContentShare})`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${raViewBox}"><rect width="${raBox}" height="${raBox}" fill="${bg}"/><g transform="${content}"><image width="${raBox}" height="${raBox}" href="data:image/png;base64,${data}"/><polygon fill="${white}" points="${raPolygon}"/></g></svg>\n`
}

// A single PNG entry, supported by current browsers, wrapped in the ICO directory.
export function pngIcon(png: Uint8Array, size: number): Buffer {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header[6] = size
  header[7] = size
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(header.length, 18)
  return Buffer.concat([header, png])
}

export async function buildBrandAssets(root = ROOT): Promise<Map<string, Buffer>> {
  const [source, tokens] = await Promise.all([
    readFile(path.join(root, 'assets/brand/ra-ring.png')),
    readFile(path.join(root, 'src/styles/tokens.css'), 'utf8'),
  ])
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const colors = await brandColors(page, tokens)
    const ringUrl = `data:image/png;base64,${source.toString('base64')}`
    const ring = await rasterize(page, ringUrl, pageRingSize)
    const faviconRing = await rasterize(page, ringUrl, faviconRingSize)
    const svg = buildFaviconSvg(faviconRing, colors.bg, colors.white)
    const faviconUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    return new Map([
      ['public/brand/ra-ring.png', ring],
      ['public/favicon.svg', Buffer.from(svg)],
      ['public/favicon.ico', pngIcon(await rasterize(page, faviconUrl, faviconSize), faviconSize)],
      ['public/apple-touch-icon.png', await rasterize(page, faviconUrl, appleSize)],
    ])
  } finally {
    await browser.close()
  }
}

async function main(): Promise<void> {
  for (const [file, bytes] of await buildBrandAssets()) {
    await mkdir(path.dirname(path.join(ROOT, file)), { recursive: true })
    await writeFile(path.join(ROOT, file), bytes)
    process.stdout.write(`generated ${file}: ${bytes.length} bytes\n`)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
