// The files the gates read: every owned file the project authors. Git
// decides what is owned (ownedFiles.ts). A generated file is owned, but a
// tool writes it, so no gate lints, formats or scans it. Every gate takes
// its list from here and narrows it by its own extensions, so the gates
// cannot disagree about which files are ours.
import { isGeneratedFile } from './generatedFiles.ts'
import { listOwnedFiles } from './ownedFiles.ts'

// Repo-relative with forward slashes, as git lists them.
export function isAuthoredFile(file: string): boolean {
  return !isGeneratedFile(file)
}

export function listGatedFiles(root: string): string[] {
  return listOwnedFiles(root).filter(isAuthoredFile)
}
