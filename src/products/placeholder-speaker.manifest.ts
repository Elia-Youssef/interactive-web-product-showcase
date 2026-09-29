// The placeholder speaker's manifest: the words the site shows for
// public/models/placeholder-speaker/model.glb. The file holds data only and
// its one import is a type, so the validate step loads it with plain Node.
//
// The speaker stands in for the collection's second slot until the first
// launch product ships: the copy is deliberately neutral and names itself
// as a sample.
import type { ProductInput } from '@lib/product'

export const manifest = {
  slug: 'placeholder-speaker',
  number: 2,
  category: 'Audio',
  brand: 'Sample',
  model: 'Speaker',
  eyebrow: 'Compact speaker / 002',
  tagline: 'A quiet box that fills the room.',
  intro: ['Sample Speaker holds the second slot while the pipeline is proven.'],
  finishes: [
    { variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' },
    { variant: 'graphite', label: 'Graphite', swatch: '#2B2E2C' },
  ],
  hotspots: [
    {
      id: 'driver',
      eyebrow: 'A closer look',
      title: 'Full-range driver',
      bullets: ['Set behind the grille', 'Ported through the base'],
    },
    {
      id: 'knob',
      eyebrow: 'On top',
      title: 'Volume knob',
      bullets: ['Machined aluminum', 'Push to mute'],
    },
  ],
  explode: { label: 'See inside' },
} satisfies ProductInput
