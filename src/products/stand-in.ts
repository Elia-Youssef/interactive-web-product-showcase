import type { ProductInput } from '@lib/product'

// The stand-in manifest: the stand-in model carries the Forma One copy
// until a model built for the site replaces both the model and these
// words. The finish variants are the model's real KHR_materials_variants
// names in glTF order, midnight first because it is the glTF default;
// the labels name the real looks and the swatch hex values approximate them.
// The export name is the convention the validate step loads by.
export const manifest = {
  slug: 'stand-in',
  number: 1,
  category: 'Audio',
  brand: 'Forma',
  model: 'One',
  eyebrow: 'Wireless over-ear headphones / 001',
  tagline: 'A quieter world. A fuller sound.',
  intro: [
    'Precision-tuned audio in a sculpted, all-day silhouette.',
    'Turn it around, discover the details, and make it yours.',
  ],
  finishes: [
    { variant: 'midnight', label: 'Midnight', swatch: '#232838' },
    { variant: 'beach', label: 'Beach', swatch: '#d8a091' },
    { variant: 'street', label: 'Street', swatch: '#26262a' },
  ],
  hotspots: [],
} satisfies ProductInput
