import type { ProductInput } from '@lib/product'

// Unlit red and middle gray on identical geometry give an independent
// direction oracle. Neither lights, textures nor a shipped finish set can
// reverse it. The remaining fixture surfaces do not change between states.
export const manifest = {
  slug: 'finish-colors',
  number: 6,
  category: 'Sample',
  brand: 'Sample',
  model: 'Colors',
  eyebrow: 'Color sample',
  tagline: 'Two known colors on one surface.',
  intro: ['An unlit surface for pixel comparisons.'],
  finishes: [
    { variant: 'red', label: 'Red', swatch: '#FF0000' },
    { variant: 'gray', label: 'Gray', swatch: '#808080' },
  ],
  hotspots: [],
} satisfies ProductInput
