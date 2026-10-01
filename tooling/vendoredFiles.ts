// The vendored files: tracked paths whose contents belong to an upstream
// project, copied in and never edited by hand. They are owned in git but not
// ours to lint, format or scan, so the gated file list (gatedFiles.ts)
// leaves them out. The list is the one place a vendored path is named, so a
// new vendored file is one edit here. The Basis entry derives
// from scripts/basisAssets.ts, which itself derives from the transcoder
// path constant, so the location is spelled once.
import { basisVendoredPrefix } from '../scripts/basisAssets.ts'

export const vendoredFilePaths = [basisVendoredPrefix] as const

// Repo-relative with forward slashes, as git lists them.
export function isVendoredFile(file: string): boolean {
  return vendoredFilePaths.some((prefix) => file.startsWith(prefix))
}
