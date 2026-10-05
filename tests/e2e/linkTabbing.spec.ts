import { expect, test } from './fixtures'
import { testBudgetMs } from './budgets'
import { siteCopy } from '../../src/lib/copy/site'
import { formatProductPath } from '../../src/lib/routing'
import { routePath } from './appPaths'
import { focusedAccessibleName, neighborsOf, plainTabReachesLinks } from './collectionFacts'
import { loadCollection } from './productList'
import { waitForProductReady } from './productSpecs'
import { stepLabel } from '../../src/features/collection'

// The engines' keyboard model over links, as a fact of its own: what the
// collection spec's keyboard walk may assume about a plain tab. The walk
// runs on the app itself, over the navigation row's links. When an engine
// ships another model, this spec fails and the keyboard walk revisits.

const collection = await loadCollection()
const first = collection.first

test('the keyboard model over links holds on this engine', async ({
  page,
  backendPath,
  expectedBrowserName,
}) => {
  test.setTimeout(testBudgetMs({ productLoads: 1 }))
  await page.goto(routePath(backendPath, formatProductPath(first.slug)))
  await waitForProductReady(page)

  const previous = neighborsOf(collection, first).previous
  const previousName = stepLabel(siteCopy.previousLabel, previous)
  const activeName = () => focusedAccessibleName(page)

  // Walks the page with the key up to the cap and reports whether focus
  // ever rested on the previous link.
  const walkReachesLink = async (key: string, cap: number): Promise<boolean> => {
    for (let tabs = 0; tabs < cap; tabs++) {
      await page.keyboard.press(key)
      if ((await activeName()) === previousName) {
        return true
      }
    }
    return false
  }

  if (plainTabReachesLinks(expectedBrowserName)) {
    expect(
      await walkReachesLink('Tab', 30),
      'a plain tab reaches the previous link on this engine',
    ).toBe(true)
    return
  }

  // The macOS keyboard model: a plain tab moves between form controls
  // only, and the modified tab of that model tabs the same link-free
  // order, so no walk of this suite reaches the links there.
  expect(await walkReachesLink('Tab', 30), 'a plain tab skips the links').toBe(false)
  expect(await walkReachesLink('Alt+Tab', 30), 'an alt tab skips the links too').toBe(false)
})
