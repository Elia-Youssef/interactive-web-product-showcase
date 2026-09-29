// The raw manifest list of the collection, derived from the manifest files
// themselves: every
// `<slug>.manifest.ts` in this folder is one product, and nothing lists
// products by hand, so a manifest can never be left out. Data only:
// createCollection validates each entry and orders products by their number,
// and every layer reads the result through the app's collection loader.
const manifestModules = import.meta.glob<unknown>('./*.manifest.ts', {
  eager: true,
  import: 'manifest',
})

export const productManifests: readonly unknown[] = Object.values(manifestModules)
