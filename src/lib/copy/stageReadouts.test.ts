import { describe, expect, it } from 'vitest'
import { angleReadoutText, zoomReadoutText } from './stageReadouts'

describe('angleReadoutText', () => {
  it('formats whole degrees over the full turn', () => {
    expect(angleReadoutText(0)).toBe('0 / 360')
    expect(angleReadoutText(127)).toBe('127 / 360')
    expect(angleReadoutText(359.4)).toBe('359 / 360')
  })

  it('wraps a value that rounds to the full turn back to 0', () => {
    expect(angleReadoutText(359.6)).toBe('0 / 360')
  })
})

describe('zoomReadoutText', () => {
  it('formats the percentage as the design pins it', () => {
    expect(zoomReadoutText(0)).toBe('0%')
    expect(zoomReadoutText(70.4)).toBe('70%')
    expect(zoomReadoutText(100)).toBe('100%')
  })
})
