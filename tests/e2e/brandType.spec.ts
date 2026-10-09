import { expect, test } from './fixtures'
import { expectProduct, productPathOf } from './collectionFacts'
import { settledFrames } from './stageSettle'
import { inkDensityOf } from './imageInk'
import { loadCollection } from './productList'
import { elementCapture, expectElementScreenshot } from './stageCapture'

// The brand type renders as the design sets it, on every engine and every
// routed product: the type roles of the panel compute to the tokens' family
// and weight, the faces the stylesheets declare are the faces the engine
// loaded, and the title's raster carries its weight for real, which is the
// step a broken variable font cannot fake: an engine that renders every
// weight at one instance paints the title with the body's stroke, and the
// title's ink per pixel collapses onto the body's. The ink floor sits well
// under the healthy engines' ratio and well over the collapsed one.

// The title's ink per pixel must exceed the body's by this factor. Healthy
// engines measure 2.3 to 2.6; the hairline failure measures about 1.0.
const TITLE_TO_BODY_INK_FLOOR = 1.8

// A luminance ceiling that counts antialiased edge pixels as ink without
// counting the panel's background.
const INK_LUMINANCE_CEILING = 200

const typeRoles = [
  { selector: 'h1', familyToken: '--sans', weightToken: '--weight-title' },
  { selector: '[class*="eyebrow"]', familyToken: '--sans', weightToken: '--weight-eyebrow' },
  { selector: '[class*="tagline"]', familyToken: '--sans', weightToken: '--weight-tagline' },
  { selector: '[class*="introLine"]', familyToken: '--sans', weightToken: '--weight-body' },
  { selector: '[class*="readout"]', familyToken: '--mono', weightToken: '--weight-readout' },
  // The tracked control labels are buttons: the engine's own control font
  // must never answer for them.
  { selector: 'button[class*="button"]', familyToken: '--sans', weightToken: '--weight-eyebrow' },
] as const

const collection = await loadCollection()
const firstProduct = collection.products[0]
if (firstProduct === undefined) {
  throw new Error('the collection holds no product for the type checks')
}

for (const product of collection.products) {
  test(`brand type: ${product.slug} renders its type roles at the tokens' family and weight with the faces loaded`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(productPathOf(backendPath, product))
    await expectProduct(page, product)
    await settledFrames(page)

    const computed = await page.evaluate(
      async (roles) => {
        await document.fonts.ready
        const root = getComputedStyle(document.documentElement)
        const tokenFont = (token: string): string => root.getPropertyValue(token).trim()
        const faces = [...document.fonts].map((face) => ({
          family: face.family.replace(/['"]/g, ''),
          weight: face.weight,
          status: face.status,
        }))
        return {
          roles: roles.map((role) => {
            const element = document.querySelector(role.selector)
            const style = element === null ? null : getComputedStyle(element)
            return {
              selector: role.selector,
              present: element !== null,
              family: style?.fontFamily ?? '',
              expectedFamily: tokenFont(role.familyToken),
              weight: style?.fontWeight ?? '',
              expectedWeight: tokenFont(role.weightToken),
            }
          }),
          faces,
        }
      },
      [...typeRoles],
    )

    expect(computed.roles.length).toBe(typeRoles.length)
    for (const role of computed.roles) {
      expect(role.present, `${role.selector} must render on the panel`).toBe(true)
      expect(primaryFamilyOf(role.family), `${product.slug} ${role.selector} family`).toBe(
        primaryFamilyOf(role.expectedFamily),
      )
      expect(role.weight, `${product.slug} ${role.selector} weight`).toBe(role.expectedWeight)
    }

    // Every declared face the page uses has loaded: an engine that fell
    // back silently would answer unloaded or error here.
    for (const role of computed.roles) {
      const weight = role.expectedWeight
      const face = computed.faces.find(
        (candidate) =>
          candidate.family === primaryFamilyOf(role.expectedFamily) &&
          coversWeight(candidate.weight, weight),
      )
      expect(face, `${role.selector} must have a loaded face at weight ${weight}`).toBeDefined()
      expect(face?.status, `${role.selector} weight ${weight} face status`).toBe('loaded')
    }
  })

  test(`brand type: ${product.slug} paints the weights its faces declare`, async ({
    page,
    backendPath,
  }) => {
    await page.goto(productPathOf(backendPath, product))
    await expectProduct(page, product)
    await settledFrames(page)

    // The same string at the same size through the page's own declared
    // faces, at the title's weight and the body's: glyph size cancels out,
    // so the ratio answers the weight alone. An engine that renders the
    // face at one instance paints both strokes the same.
    await page.evaluate(() => {
      const host = document.createElement('div')
      host.style.position = 'fixed'
      host.style.insetInlineStart = '0'
      host.style.insetBlockStart = '0'
      host.style.background = '#ffffff'
      host.style.whiteSpace = 'nowrap'
      host.style.zIndex = '9999'
      for (const weight of [400, 800]) {
        const span = document.createElement('span')
        span.dataset.probeWeight = String(weight)
        span.style.fontFamily = 'Montserrat'
        span.style.fontWeight = String(weight)
        span.style.fontSize = '32px'
        span.style.lineHeight = '1'
        span.style.color = '#000000'
        span.style.display = 'block'
        span.textContent = 'Fjor Tast 123'
        host.appendChild(span)
      }
      document.body.appendChild(host)
    })
    const title = await inkDensityOf(
      await elementCapture(page, page.locator('[data-probe-weight="800"]')),
      INK_LUMINANCE_CEILING,
    )
    const body = await inkDensityOf(
      await elementCapture(page, page.locator('[data-probe-weight="400"]')),
      INK_LUMINANCE_CEILING,
    )
    const ratio = title.ink / body.ink
    await page.evaluate(() =>
      document.querySelector('[data-probe-weight]')?.parentElement?.remove(),
    )
    expect(
      ratio,
      `the 800 face must paint well over ${TITLE_TO_BODY_INK_FLOOR}x the 400 face's ink at one size, but paints ${ratio}`,
    ).toBeGreaterThan(TITLE_TO_BODY_INK_FLOOR)
  })
}

// The WebKit title image: the one engine whose variable-weight rendering
// was the defect holds its own committed baseline, so the title it paints
// is judged as pixels, not only as ratios.
test('brand type: WebKit paints the committed title', async ({
  page,
  backendPath,
  expectedBrowserName,
}) => {
  test.skip(expectedBrowserName !== 'webkit', 'the title baseline belongs to WebKit')
  await page.goto(productPathOf(backendPath, firstProduct))
  await expectProduct(page, firstProduct)
  await settledFrames(page)
  await expectElementScreenshot(page, page.locator('h1'), 'webkit-title.png')
})

// The first family name of a font stack token, without its quotes.
function primaryFamilyOf(stack: string): string {
  return stack.split(',')[0]?.trim().replace(/['"]/g, '') ?? ''
}

// Whether a face's weight descriptor covers a weight: a single number
// covers exactly it, a range covers what it spans.
function coversWeight(descriptor: string, weight: string): boolean {
  const wanted = Number(weight)
  const range = /^(\d+)\s+(\d+)$/.exec(descriptor)
  if (range === null) {
    return Number(descriptor) === wanted
  }
  const from = Number(range[1])
  const to = Number(range[2])
  return wanted >= from && wanted <= to
}
