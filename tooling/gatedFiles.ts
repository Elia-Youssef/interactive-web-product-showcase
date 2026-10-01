// The files the gates read: every owned file the project authors. Git
// decides what is owned (ownedFiles.ts); a vendored file is owned, but its
// contents belong to an upstream project, so no gate lints, formats or scans
// it. Every gate takes its list from here and narrows it by its own
// extensions, so the gates cannot disagree about which files are ours.
import { listOwnedFiles } from './ownedFiles.ts'
import { isVendoredFile } from './vendoredFiles.ts'

// Repo-relative with forward slashes, as git lists them.
export function isAuthoredFile(file: string): boolean {
  return !isVendoredFile(file)
}

export function listGatedFiles(root: string): string[] {
  return listOwnedFiles(root).filter(isAuthoredFile)
}
