// The placeholder speaker's manifest: the words the site shows for
// public/models/placeholder-speaker/model.glb. The file holds data only and
// its one import is a type, so the validate step loads it with plain Node.
//
// The speaker holds a slot of the collection until the launch set ships:
// the copy is deliberately neutral and names itself as a sample.
import type { ProductInput } from '@lib/product'

export const manifest = {
  slug: 'placeholder-speaker',
  number: 4,
  category: 'Audio',
  brand: 'Sample',
  model: 'Speaker',
  eyebrow: 'Compact speaker / 004',
  tagline: 'A quiet box that fills the room.',
  intro: ['Sample Speaker holds a slot while the pipeline is proven.'],
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
  // The driver close-up orbits its target at 0.2957 stage units under the
  // anchor pivot, closer than the 0.5 ratio minimum of the home distance
  // would allow. The authored minimum sits below that orbit distance and
  // above the model's 0.2846 reach from the pivot, so the close-up stays
  // reachable and the camera never enters the model.
  camera: { minDistance: 0.29 },
} satisfies ProductInput
