import type { ProductInput } from '@lib/product'

export const manifest = {
  slug: 'vidde-spak',
  number: 3,
  category: 'Lighting',
  brand: 'Vidde',
  model: 'Spak',
  eyebrow: 'Counterweight task lamp',
  tagline: 'A counterweight arm that stays where you leave it.',
  intro: [
    'Spak is a two-segment task lamp balanced by a steel weight in the base.',
    'One lever sets the friction on both arm joints at once.',
  ],
  meta: {
    kind: 'counterweight task lamp',
    description:
      'Vidde Spak, a counterweight task lamp concept by Rebel Art Studios. A steel weight keeps the arm where you leave it. Explore it in 3D.',
  },
  finishes: [
    { variant: 'ivory', label: 'Ivory', swatch: '#EEE4D6' },
    { variant: 'charcoal', label: 'Charcoal', swatch: '#484B51' },
    { variant: 'spruce', label: 'Spruce', swatch: '#2D5346' },
  ],
  hotspots: [
    {
      id: 'lever',
      eyebrow: 'At the elbow',
      title: 'Clutch lever',
      bullets: ['Sets tension on both arm joints', 'Brass friction discs inside'],
    },
    {
      id: 'diffuser',
      eyebrow: 'Under the head',
      title: 'Edge-lit diffuser',
      bullets: ['Side-emitting LED strip', 'Opal acrylic disc'],
    },
    {
      id: 'weight',
      eyebrow: 'In the base',
      title: 'Counterweight',
      bullets: ['Machined steel puck', 'Balances the arm'],
    },
  ],
  explode: { label: 'Pull apart' },
  look: { exposure: 1.1, environmentIntensity: 1.3, environmentRotationDeg: 120 },
} satisfies ProductInput
