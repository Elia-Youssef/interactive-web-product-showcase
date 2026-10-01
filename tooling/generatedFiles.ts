// The generated files: tracked paths a tool writes and nobody edits by hand.
// They are owned in git, but they carry no authored text, so the gated file
// list (gatedFiles.ts) leaves them out. The list is the one place a
// generated path is named, so a new generated file is one edit here.

// The lockfile the package manager rewrites on every dependency change.
export const generatedFilePaths = ['pnpm-lock.yaml'] as const

// Repo-relative with forward slashes, as git lists them.
export function isGeneratedFile(file: string): boolean {
  return generatedFilePaths.some((path) => path === file)
}
