// The files the gates read: every owned file the project authors. Git
// decides what is owned (ownedFiles.ts). A generated file is owned, but a
// tool writes it, so no gate lints, formats or scans it. Every gate takes
// its list from here and narrows it by its own extensions, so the gates
// cannot disagree about which files are ours.
import { binaryExtensions, hasExtension } from './extensions.ts'
import { isGeneratedFile } from './generatedFiles.ts'
import { listOwnedFiles } from './ownedFiles.ts'

// Repo-relative with forward slashes, as git lists them.
export function isAuthoredFile(file: string): boolean {
  return !isGeneratedFile(file)
}

// Text is decided by name (extensions.ts), never by the bytes inside: a
// text file holding a stray byte must stay in the reach of every text gate.
export function isGatedTextFile(file: string): boolean {
  return isAuthoredFile(file) && !hasExtension(file, binaryExtensions)
}

export function listGatedFiles(root: string): string[] {
  return listOwnedFiles(root).filter(isAuthoredFile)
}

export function listGatedTextFiles(root: string): string[] {
  return listOwnedFiles(root).filter(isGatedTextFile)
}
