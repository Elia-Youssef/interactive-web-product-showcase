export const siteIcons = [
  { file: 'favicon.ico', rel: 'icon', type: 'image/x-icon' },
  { file: 'favicon.svg', rel: 'icon', type: 'image/svg+xml' },
  { file: 'apple-touch-icon.png', rel: 'apple-touch-icon', type: 'image/png' },
] as const

// Stable icon slots belong to the same entry as the site's metadata.
export function fillFaviconHead(html: string, base: string): string {
  let filled = html
  for (const icon of siteIcons) {
    const type = icon.type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(<link\\s+rel="${icon.rel}"\\s+type="${type}"\\s+href=")[^"]*(")`)
    if (!pattern.test(filled)) throw new Error(`the head template has no ${icon.file} slot`)
    const href = `${base.replace(/\/$/, '')}/${icon.file}`
    filled = filled.replace(
      pattern,
      (_match, before: string, after: string) => `${before}${href}${after}`,
    )
  }
  return filled
}
