import { test } from './fixtures'
import { focusVisibly } from './measurementFocus'

// A non-editing control retains the panel's sequential navigation start
// without scheduling text-caret scrolling. Its focus must not reveal it:
// the scroll positions below deliberately leave that earlier control offscreen.
test('measurement focus preserves nested horizontal and vertical scroll positions', async ({
  page,
}) => {
  await page.setContent(
    `<div id="outer" style="width:200px;height:120px;overflow:auto"><div style="width:600px;height:500px"><div id="panel" style="width:180px;height:100px;overflow:auto"><button>Earlier control</button><div style="height:400px;width:500px"></div><button>Later control</button></div></div></div><button>Marker</button>`,
  )
  await page
    .getByRole('button', { name: 'Earlier control', exact: true })
    .evaluate((element) => element.focus({ preventScroll: true }))
  await page.evaluate(() => {
    const outer = document.getElementById('outer')
    const panel = document.getElementById('panel')
    if (outer === null || panel === null) throw new Error('scroll fixture must exist')
    outer.scrollTo(20, 10)
    panel.scrollTo(30, 15)
  })
  await focusVisibly(page, page.getByRole('button', { name: 'Marker', exact: true }))
})
