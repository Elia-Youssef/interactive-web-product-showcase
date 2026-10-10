import { describe, expect, it } from 'vitest'
import { siteCopy } from './site'
import { angleReadoutText, loadReadoutText, zoomReadoutText } from './stageReadouts'

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

describe('loadReadoutText', () => {
  it('writes the label and the whole percent figure', () => {
    expect(loadReadoutText(siteCopy.loadingLabel, 42)).toBe('Loading 42%')
    expect(loadReadoutText(siteCopy.loadingLabel, 0)).toBe('Loading 0%')
  })

  it('writes the label alone while the figure is unknown', () => {
    expect(loadReadoutText(siteCopy.loadingLabel, null)).toBe('Loading')
  })

  it('stays ASCII', () => {
    for (const percent of [null, 0, 7, 42, 99]) {
      expect(/^[\x20-\x7E]*$/.test(loadReadoutText(siteCopy.loadingLabel, percent))).toBe(true)
    }
  })
})
