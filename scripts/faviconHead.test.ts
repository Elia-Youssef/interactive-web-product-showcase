import { expect, test } from 'vitest'
import { fillFaviconHead, siteIcons } from './faviconHead.ts'

const template = siteIcons
  .map((icon) => `<link rel="${icon.rel}" type="${icon.type}" href="" />`)
  .join('\n')
test.each(['/', '/portfolio/'])('all icon slots honor the site base %s', (base) => {
  const filled = fillFaviconHead(template, base)
  for (const icon of siteIcons) expect(filled).toContain(`href="${base}${icon.file}"`)
  expect(fillFaviconHead(filled, base)).toBe(filled)
})
test.each(siteIcons)('a missing $file slot fails loudly', (icon) => {
  const without = template
    .split('\n')
    .filter((line) => !line.includes(`type="${icon.type}"`))
    .join('\n')
  expect(() => fillFaviconHead(without, '/')).toThrow(`no ${icon.file} slot`)
})
