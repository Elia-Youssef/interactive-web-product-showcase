// Manifest fixtures for the product domain tests. They are typed with
// `satisfies ProductInput`, so a shape drift between the fixtures and the
// schema fails the typecheck instead of waiting for a test to catch it.

import type { ProductInput } from './schema'

export const sageFinish = {
  variant: 'sage',
  label: 'Sage Green',
  swatch: '#9db89d',
} satisfies ProductInput['finishes'][number]

export const graphiteFinish = {
  variant: 'graphite',
  label: 'Graphite',
  swatch: '#2b2e2c',
} satisfies ProductInput['finishes'][number]

export const driverHotspot = {
  id: 'driver',
  eyebrow: 'A closer look',
  title: '40 mm full-range driver',
  bullets: ['Neodymium motor', 'Ported rear chamber', 'Replaceable grill'],
} satisfies ProductInput['hotspots'][number]

export const shellHotspot = {
  id: 'shell',
  eyebrow: 'Materials',
  title: 'Anodized aluminum shell',
  bullets: ['CNC unibody', 'Soft-touch coating'],
} satisfies ProductInput['hotspots'][number]

export const sampleOneManifest = {
  slug: 'sample-one',
  number: 1,
  category: 'Audio',
  brand: 'Sample',
  model: 'One',
  eyebrow: 'Wireless over-ear headphones',
  tagline: 'Sound first, everything else second.',
  intro: [
    'Sample One is an over-ear headphone for long sessions.',
    'Every part opens without glue.',
  ],
  finishes: [sageFinish, graphiteFinish],
  hotspots: [driverHotspot, shellHotspot],
  explode: { clip: 'Explode', label: 'See inside' },
  camera: { minDistance: 0.4, maxDistance: 4 },
} satisfies ProductInput

export const sampleTwoManifest = {
  slug: 'sample-two',
  number: 2,
  category: 'Audio',
  brand: 'Sample',
  model: 'Two',
  eyebrow: 'Wireless over-ear headphones',
  tagline: 'The same idea, smaller.',
  intro: [],
  finishes: [graphiteFinish],
  hotspots: [],
} satisfies ProductInput

export const sampleThreeManifest = {
  slug: 'sample-three',
  number: 3,
  category: 'Audio',
  brand: 'Sample',
  model: 'Three',
  eyebrow: 'Wireless over-ear headphones',
  tagline: 'The same idea, for the desk.',
  intro: ['Sample Three stays put and plays all day.'],
  finishes: [sageFinish],
  hotspots: [driverHotspot],
  explode: { label: 'See inside' },
  camera: { minDistance: 0.5 },
} satisfies ProductInput
