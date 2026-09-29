// The served transcoder must be exactly the installed three's transcoder:
// a three upgrade without a copy refresh would leave a stale decoder that
// can no longer read the textures new files encode. The check is byte for
// byte, so no drift of any kind passes.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { BASIS_TRANSCODER_FILES, basisSourceDir, basisTargetDir } from './basisAssets.ts'

// The repo root: the parent of the scripts folder this file lives in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

test.each(BASIS_TRANSCODER_FILES)(
  'public/basis/%s is byte for byte the file the installed three ships',
  (file) => {
    const served = readFileSync(path.join(basisTargetDir(ROOT), file))
    const installed = readFileSync(path.join(basisSourceDir(ROOT), file))
    const message =
      `public/basis/${file} differs from the installed three's copy; ` + 'run pnpm assets:basis'
    expect(served.equals(installed), message).toBe(true)
  },
)
