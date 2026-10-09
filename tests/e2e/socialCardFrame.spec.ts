import { expect, test } from './fixtures'
import { cutElements } from './cardFrame'
import { productPathOf } from './collectionFacts'
import { loadCollection } from './productList'
import { readFramedElements, settledSocialCard, socialCardViewport } from './socialCards'

// The social card a product's link preview shows cuts no element at the
// card's edge: the capture's own rest and frame step, run on the product's
// own route at the card size, leave every element the card shows whole.
// The cards are the products with link-preview words, the ones the capture
// writes.
const collection = await loadCollection()

for (const product of collection.products.filter((entry) => entry.meta !== undefined)) {
  test(`the social card of ${product.slug} shows every element whole`, async ({
    page,
    backendPath,
  }) => {
    await page.setViewportSize(socialCardViewport)
    await page.goto(productPathOf(backendPath, product))
    await settledSocialCard(page, product.slug)

    const cut = cutElements(await readFramedElements(page))
    expect(
      cut.map((element) => element.name),
      'elements the card edge or a clipping box cuts',
    ).toEqual([])
  })
}
