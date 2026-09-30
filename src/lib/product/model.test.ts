import { describe, expect, it } from 'vitest'
import { modelUrl } from './model'

describe('modelUrl', () => {
  it('derives the URL from the slug alone', () => {
    expect(modelUrl('stand-in')).toBe('/models/stand-in/model.glb')
  })

  it('maps every slug to its own model file', () => {
    expect(modelUrl('placeholder-speaker')).toBe('/models/placeholder-speaker/model.glb')
    expect(modelUrl('placeholder-speaker')).not.toBe(modelUrl('stand-in'))
  })
})
