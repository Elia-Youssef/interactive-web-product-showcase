// Refresh the shipped static Latin faces and their license from the pinned
// package. Copying upstream bytes keeps shaping and kerning intact.
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE = path.join(ROOT, 'node_modules', '@fontsource', 'montserrat')
const TARGET = path.join(ROOT, 'public', 'fonts')
const WEIGHTS = [400, 500, 600, 800] as const

async function main(): Promise<void> {
  await mkdir(TARGET, { recursive: true })
  for (const weight of WEIGHTS) {
    const file = `montserrat-latin-${weight}-normal.woff2`
    await copyFile(path.join(SOURCE, 'files', file), path.join(TARGET, file))
    process.stdout.write(`copied ${file} -> public/fonts/${file}\n`)
  }
  await copyFile(path.join(SOURCE, 'LICENSE'), path.join(TARGET, 'OFL-Montserrat.txt'))
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
