// Fjor Tast's manifest: the words the site shows for
// public/models/fjor-tast/model.glb. Data only, with one type import, so the
// validate step loads it with plain Node. Swatches are measured keycap
// colors under the look below. The authored views pass the default limits.
import type { ProductInput } from '@lib/product'

export const manifest = {
  slug: 'fjor-tast',
  number: 4,
  category: 'Desk',
  brand: 'Fjor',
  model: 'Tast',
  eyebrow: 'Sixty percent keyboard / 004',
  tagline: 'Sixty-one keys and nothing you do not use.',
  intro: [
    'Tast is a sixty percent keyboard with an aluminum case and one knob.',
    'A brass weight in the base keeps it planted on the desk.',
  ],
  meta: {
    kind: 'sixty percent keyboard',
    description:
      'Fjor Tast, a sixty percent keyboard concept by Rebel Art Studios. Sixty-one keys, an aluminum case and a brass weight in the base. Explore it in 3D.',
  },
  finishes: [
    { variant: 'carbon', label: 'Carbon', swatch: '#33353A' },
    { variant: 'putty', label: 'Putty', swatch: '#BCB3A5' },
    { variant: 'olive', label: 'Olive', swatch: '#6C7154' },
  ],
  hotspots: [
    {
      id: 'knob',
      eyebrow: 'Top right',
      title: 'Machined knob',
      bullets: ['Knurled aluminum rim', 'Detents you can feel'],
    },
    {
      id: 'switch',
      eyebrow: 'Under the caps',
      title: 'Linear switches',
      bullets: ['Rated for fifty million presses', 'Lubed at the factory'],
    },
    {
      id: 'weight',
      eyebrow: 'In the base',
      title: 'Brass weight',
      bullets: ['Adds one kilo of heft', 'Keeps the board planted'],
    },
  ],
  explode: { label: 'Pull apart' },
  look: { exposure: 1.1, environmentIntensity: 1.3, environmentRotationDeg: 330 },
} satisfies ProductInput
