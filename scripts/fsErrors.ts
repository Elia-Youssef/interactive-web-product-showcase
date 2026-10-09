// The one check for "the file is not there", shared by every caller that
// treats a missing file as a normal case. A missing file may be skipped or
// defaulted; every other error (permissions, IO, a bad path) must propagate,
// never hide behind the missing-file handling.
import type { Stats } from 'node:fs'
import { stat } from 'node:fs/promises'

// True when the error is Node's ENOENT: nothing exists at that path. Any
// other error, including one that only looks like a path problem, is false.
export function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

// What exists at the path, or null when nothing does. Every other error
// propagates: a path that cannot be read is a problem to report, never an
// answer of "nothing there".
export async function statOrNull(target: string): Promise<Stats | null> {
  try {
    return await stat(target)
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error
    }
    return null
  }
}

// True when a regular file exists at the path, false when nothing does.
export async function isFile(file: string): Promise<boolean> {
  return (await statOrNull(file))?.isFile() ?? false
}

// True when a folder exists at the path, false when nothing does.
export async function isDirectory(folder: string): Promise<boolean> {
  return (await statOrNull(folder))?.isDirectory() ?? false
}
