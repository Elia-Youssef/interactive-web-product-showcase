import { expect, test } from 'vitest'
import { raBox, raGlyphPoints, raPolygon, raViewBox } from './raGeometry'

test('the glyph has eighteen distinct vertices in its square coordinate box', () => {
  expect(raBox).toBe(1080)
  expect(raViewBox).toBe('0 0 1080 1080')
  expect(raGlyphPoints).toHaveLength(18)
  expect(new Set(raGlyphPoints.map((point) => point.join(','))).size).toBe(18)
  for (const point of raGlyphPoints) {
    for (const coordinate of point) {
      expect(coordinate).toBeGreaterThan(0)
      expect(coordinate).toBeLessThan(raBox)
      expect(Number(coordinate.toFixed(1))).toBe(coordinate)
    }
  }
  expect(raPolygon).toBe(
    '745.8,271.9 844.1,722.7 775.7,737.5 693.0,355.4 330.3,433.4 353.8,542.0 393.3,567.5 620.2,518.8 649.4,473.7 663.4,538.7 630.5,589.7 537.0,610.4 402.6,819.1 307.6,839.5 442.1,630.7 371.9,645.5 291.0,593.0 245.2,380.2',
  )
})
