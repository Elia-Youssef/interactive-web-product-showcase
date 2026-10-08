// Forma One's manifest: the words the site shows for
// public/models/forma-one/model.glb. Data only, with one type import, so the
// validate step loads it with plain Node.
import type { ProductInput } from '@lib/product'

export const manifest = {
  slug: 'forma-one',
  number: 1,
  category: 'Audio',
  brand: 'Forma',
  model: 'One',
  eyebrow: 'Wireless over-ear headphones / 001',
  tagline: 'Weight where it matters, quiet everywhere else.',
  intro: [
    'A closed-back headphone built around one 40 mm driver per side.',
    'Aluminum yokes, steel sliders and a knit band.',
  ],
  finishes: [
    { variant: 'slate', label: 'Slate', swatch: '#6A7078' },
    { variant: 'bone', label: 'Bone', swatch: '#F3ECE2' },
    { variant: 'ochre', label: 'Ochre', swatch: '#AE894F' },
    { variant: 'stone', label: 'Stone', swatch: '#A8A199' },
  ],
  hotspots: [
    {
      id: 'driver',
      eyebrow: 'Inside the cup',
      title: 'Driver and pads',
      bullets: ['40 mm driver per side', 'Magnetic knit pads, swap without tools'],
    },
    {
      id: 'yoke',
      eyebrow: 'On the side',
      title: 'Aluminum yoke',
      bullets: ['Tilts at the pins', 'Swivels at the crown'],
    },
  ],
  explode: { label: 'Pull apart' },
  look: { exposure: 1.1, environmentIntensity: 1.3, environmentRotationDeg: 75 },
} satisfies ProductInput
