// A deliberately broken manifest list for the harness error screen, reached
// with ?manifests=invalid on the harness page only. The slug stays valid, so
// the error names the product, and the manifest fails twice: once on the
// swatch color and once on the unknown key. It cannot satisfy ProductInput
// because the unknown key is the point; the raw data goes straight to the
// collection loader, which rejects it like any untyped input.
export const invalidManifests = [
  {
    slug: 'broken-one',
    number: 1,
    category: 'Audio',
    brand: 'Sample',
    model: 'One',
    eyebrow: 'Broken on purpose',
    tagline: 'This manifest fails validation.',
    intro: [],
    finishes: [{ variant: 'sage', label: 'Sage Green', swatch: 'sage' }],
    hotspots: [],
    taglines: 'an unknown key',
  },
] as const
