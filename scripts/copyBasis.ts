// The Basis transcoder copy step: refreshes public/basis from the installed
// three, byte for byte.
//
//   pnpm assets:basis
//
// The copied files are committed and served as they are, so the site never
// fetches a transcoder from a CDN. The step exists for a three upgrade:
// scripts/basisAssets.test.ts fails while the served copies differ from the
// installed three, and running this step is the fix.
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASIS_TRANSCODER_FILES, basisSourceDir, basisTargetDir } from './basisAssets.ts'

// The repo root: the parent of the scripts folder this file lives in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

export async function copyBasisAssets(root: string): Promise<void> {
  await mkdir(basisTargetDir(root), { recursive: true })
  for (const file of BASIS_TRANSCODER_FILES) {
    await copyFile(path.join(basisSourceDir(root), file), path.join(basisTargetDir(root), file))
  }
}

export async function main(): Promise<void> {
  await copyBasisAssets(ROOT)
  for (const file of BASIS_TRANSCODER_FILES) {
    process.stdout.write(
      `copied ${path.join(basisSourceDir(ROOT), file)} -> public/basis/${file}\n`,
    )
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
