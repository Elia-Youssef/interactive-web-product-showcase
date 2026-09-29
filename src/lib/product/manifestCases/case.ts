// The shape of one schema test case and the two builders every case module
// uses. Plain data: the test file owns the assertions.

export type ManifestCase =
  | {
      readonly name: string
      readonly manifest: unknown
      readonly accepted: true
      readonly slug: string
    }
  | {
      readonly name: string
      readonly manifest: unknown
      readonly accepted: false
      readonly path: string
    }

export const accepts = (name: string, manifest: unknown, slug: string): ManifestCase => ({
  name,
  manifest,
  accepted: true,
  slug,
})

export const rejects = (name: string, manifest: unknown, path: string): ManifestCase => ({
  name,
  manifest,
  accepted: false,
  path,
})

// A list of n valid single-line strings, for the count limits.
export const lines = (n: number): string[] => Array.from({ length: n }, () => 'a line')
