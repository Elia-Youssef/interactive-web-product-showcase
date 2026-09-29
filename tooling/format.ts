// The format gate. It checks or rewrites every owned formattable file through
// the Prettier Node API over the same git-backed list the lint gate uses.
// Options come from .prettierrc.json alone; there is no second ignore list.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { check as checkFormat, format as formatSource, resolveConfig } from 'prettier'
import { formatExtensions, hasExtension } from './extensions.ts'
import { listOwnedFiles } from './ownedFiles.ts'

const root = resolve(import.meta.dirname, '..')
const mode = process.argv[2] === '--write' ? 'write' : 'check'
const files = listOwnedFiles(root).filter((file) => hasExtension(file, formatExtensions))

let unformatted = 0
for (const file of files) {
  const path = resolve(root, file)
  const source = readFileSync(path, 'utf8')
  const options = { ...(await resolveConfig(path)), filepath: path }
  if (mode === 'write') {
    const formatted = await formatSource(source, options)
    if (formatted !== source) {
      writeFileSync(path, formatted)
      process.stdout.write(`formatted ${file}
`)
    }
  } else if (!(await checkFormat(source, options))) {
    unformatted += 1
    process.stdout.write(`not formatted: ${file}
`)
  }
}

if (mode === 'check') {
  process.stdout.write(`${files.length} owned files checked, ${unformatted} not formatted
`)
  if (unformatted > 0) {
    process.exitCode = 1
  }
} else {
  process.stdout.write(`${files.length} owned files formatted
`)
}
