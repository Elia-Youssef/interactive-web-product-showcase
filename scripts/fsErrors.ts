// The one check for "the file is not there", shared by every caller that
// treats a missing file as a normal case. A missing file may be skipped or
// defaulted; every other error (permissions, IO, a bad path) must propagate,
// never hide behind the missing-file handling.

// True when the error is Node's ENOENT: nothing exists at that path. Any
// other error, including one that only looks like a path problem, is false.
export function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
