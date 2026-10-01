// The files the gates read: every owned file the project authors. Git
// decides what is owned (ownedFiles.ts). A vendored file is owned, but its
// contents belong to an upstream project; a generated file is owned, but a
// tool writes it. No gate lints, formats or scans either. Every gate takes its list from here and narrows it by its own
// extensions, so the gates cannot disagree about which files are ours.
import { isGeneratedFile } from './generatedFiles.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { isVendoredFile } from './vendoredFiles.ts'

// Repo-relative with forward slashes, as git lists them.
export function isAuthoredFile(file: string): boolean {
  return !isVendoredFile(file) && !isGeneratedFile(file)
}

export function listGatedFiles(root: string): string[] {
  return listOwnedFiles(root).filter(isAuthoredFile)
}
