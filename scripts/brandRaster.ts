/// <reference lib="dom" />
import type { Page } from '@playwright/test'

export async function brandColors(
  page: Page,
  tokens: string,
): Promise<{ bg: string; white: string }> {
  await page.setContent(
    `<style>${tokens}</style><div style="color:var(--white);background:var(--bg)"></div>`,
  )
  return page.locator('div').evaluate((element) => {
    const style = getComputedStyle(element)
    return { bg: style.backgroundColor, white: style.color }
  })
}

export async function rasterize(page: Page, url: string, size: number): Promise<Buffer> {
  const encoded = await page.evaluate(
    async ({ url, size }) => {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('rasterization requires a 2d canvas')
      context.drawImage(image, 0, 0, size, size)
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { url, size },
  )
  if (encoded === undefined) throw new Error('rasterization returned no PNG')
  return Buffer.from(encoded, 'base64')
}
