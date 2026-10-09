// The one check for "the file is not there", shared by every caller that
// treats a missing file as a normal case. A missing file may be skipped or
// defaulted; every other error (permissions, IO, a bad path) must propagate,
// never hide behind the missing-file handling.
import { stat } from 'node:fs/promises'

// True when the error is Node's ENOENT: nothing exists at that path. Any
// other error, including one that only looks like a path problem, is false.
export function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

// True when a regular file exists at the path, false when nothing does.
// Every other error propagates: a path that cannot be read is a problem to
// report, never an answer of "no file".
export async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile()
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error
    }
    return false
  }
}
