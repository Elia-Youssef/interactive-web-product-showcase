import { expect, test } from './fixtures'
import { expectProduct, productPathOf } from './collectionFacts'
import { loadCollection } from './productList'

const collection = await loadCollection()

test('static brand faces retain kerning at every shipped weight', async ({
  page,
  backendPath,
}, testInfo) => {
  await page.goto(productPathOf(backendPath, collection.first))
  await expectProduct(page, collection.first)
  const advances = await page.evaluate(async () => {
    await document.fonts.ready
    const probe = document.createElement('span')
    probe.textContent = 'AVATAR To WA'
    probe.style.fontFamily = 'Montserrat'
    probe.style.fontSize = '32px'
    probe.style.letterSpacing = '0'
    probe.style.whiteSpace = 'nowrap'
    probe.style.display = 'inline-block'
    document.body.appendChild(probe)
    const widths = [400, 500, 600, 800].map((weight) => {
      probe.style.fontWeight = String(weight)
      probe.style.fontKerning = 'normal'
      const kerned = probe.getBoundingClientRect().width
      probe.style.fontKerning = 'none'
      const unkerned = probe.getBoundingClientRect().width
      return { weight, kerned, unkerned }
    })
    probe.remove()
    return widths
  })
  await testInfo.attach('kerning-advance-widths', {
    body: JSON.stringify(advances, null, 2),
    contentType: 'application/json',
  })
  for (const advance of advances) {
    expect(advance.kerned, `Montserrat ${advance.weight} retains pair kerning`).not.toBe(
      advance.unkerned,
    )
  }
})
