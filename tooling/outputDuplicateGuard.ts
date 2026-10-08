// The output duplicate guard: the production build must ship every payload
// once. It reads the written output directory after the build has closed,
// so it sees what a deploy uploads: the bundle's own emissions and the
// public directory's copies alike. Two files with the same bytes are one
// payload shipped twice, whichever step put each one there, so the build
// fails and names every copy.
//
// Empty files are out of scope: an empty file carries no payload, so two of
// them duplicate nothing, and the empty placeholders that keep a public
// folder in git are the only empty files the build ships.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

// One written output file: its path relative to the output directory, with
// forward slashes, and its bytes.
export interface OutputFile {
  readonly path: string
  readonly bytes: Uint8Array
}

// The groups of byte-identical non-empty files, each group sorted by path
// and the groups sorted by their first path, so a report reads the same on
// every run.
export function findDuplicateOutputs(files: readonly OutputFile[]): string[][] {
  const byDigest = new Map<string, string[]>()
  for (const file of files) {
    if (file.bytes.byteLength === 0) {
      continue
    }
    const digest = createHash('sha256').update(file.bytes).digest('hex')
    const group = byDigest.get(digest)
    if (group === undefined) {
      byDigest.set(digest, [file.path])
    } else {
      group.push(file.path)
    }
  }
  return [...byDigest.values()]
    .filter((group) => group.length > 1)
    .map((group) => [...group].sort())
    .sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''))
}

// Every file under the output directory, read whole.
export function readOutputFiles(outDir: string): OutputFile[] {
  return readdirSync(outDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const absolute = join(entry.parentPath, entry.name)
      return {
        path: relative(outDir, absolute).replaceAll('\\', '/'),
        bytes: readFileSync(absolute),
      }
    })
}

// The build failure for the duplicate groups, one group per line.
export function duplicateOutputsMessage(groups: readonly (readonly string[])[]): string {
  const lines = groups.map((group) => `  ${group.join(' = ')}`)
  return ['the build output ships the same bytes more than once:', ...lines].join('\n')
}

export function outputDuplicateGuardPlugin(): Plugin {
  return {
    name: 'output-duplicate-guard',
    apply: 'build',
    closeBundle(error) {
      if (error !== undefined) {
        return
      }
      const { root, build } = this.environment.config
      const groups = findDuplicateOutputs(readOutputFiles(resolve(root, build.outDir)))
      if (groups.length > 0) {
        throw new Error(duplicateOutputsMessage(groups))
      }
    },
  }
}
