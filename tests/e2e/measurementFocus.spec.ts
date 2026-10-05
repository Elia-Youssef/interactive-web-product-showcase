import { expect, test } from './fixtures'
import { focusVisibly } from './measurementFocus'

// A preceding input leaves sequential navigation inside an independently
// scrolled panel. Measurement focus must not visit the offscreen next button.
test('measurement focus preserves nested horizontal and vertical scroll positions', async ({
  page,
}) => {
  await page.setContent(
    `<div id="outer" style="width:200px;height:120px;overflow:auto"><div style="width:600px;height:500px"><div id="panel" style="width:180px;height:100px;overflow:auto"><input aria-label="Earlier control"><div style="height:400px;width:500px"></div><button>Later control</button></div></div></div><button>Marker</button>`,
  )
  await page.getByRole('textbox').focus()
  await page.evaluate(() => {
    const outer = document.getElementById('outer')
    const panel = document.getElementById('panel')
    if (outer === null || panel === null) throw new Error('scroll fixture must exist')
    outer.scrollTo(20, 10)
    panel.scrollTo(30, 15)
  })
  await focusVisibly(page, page.getByRole('button', { name: 'Marker', exact: true }))
  await expect(page.getByRole('button', { name: 'Marker', exact: true })).toBeFocused()
})
