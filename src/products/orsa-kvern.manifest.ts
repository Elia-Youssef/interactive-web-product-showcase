// Orsa Kvern's manifest: the words the site shows for
// public/models/orsa-kvern/model.glb. Data only, with one type import, so the
// validate step loads it with plain Node. Every authored view passes the
// default camera limits, so there is no camera block. The swatches are the
// masked medians of the surface that tells each finish apart (the shell for
// steel and ink, the grip band for walnut) under the look block below,
// measured on the built model; every finish stays far from the UI red.
import type { ProductInput } from '@lib/product'

export const manifest = {
  slug: 'orsa-kvern',
  number: 2,
  category: 'Kitchen',
  brand: 'Orsa',
  model: 'Kvern',
  eyebrow: 'Single-dose grinder / 002',
  tagline: 'Forty clicks from fine to coarse.',
  intro: [
    'Kvern is a single-dose grinder with a 40 mm conical burr.',
    'The burr carrier lifts out in one piece for cleaning.',
  ],
  meta: {
    kind: 'single-dose coffee grinder',
    description:
      'Orsa Kvern, a single-dose coffee grinder concept by Rebel Art Studios. A 40 mm conical burr and forty clicks from fine to coarse. Explore it in 3D.',
  },
  finishes: [
    { variant: 'steel', label: 'Brushed Steel', swatch: '#BEB9BA' },
    { variant: 'walnut', label: 'Walnut Grip', swatch: '#79553F' },
    { variant: 'ink', label: 'Ink', swatch: '#212225' },
  ],
  hotspots: [
    {
      id: 'burr',
      eyebrow: 'Inside the column',
      title: 'Conical burr',
      bullets: ['40 mm hardened steel', 'Zero-retention cut path'],
    },
    {
      id: 'dial',
      eyebrow: 'On the side',
      title: 'Grind dial',
      bullets: ['Forty detented steps', 'Indexed by feel'],
    },
    {
      id: 'cup',
      eyebrow: 'At the base',
      title: 'Grounds cup',
      bullets: ['Magnetic alignment', 'Dosing ring included'],
    },
  ],
  explode: { label: 'Pull apart' },
  look: { exposure: 1.1, environmentIntensity: 1.3, environmentRotationDeg: 135 },
} satisfies ProductInput
