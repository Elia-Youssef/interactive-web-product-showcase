// The lint gate. It lints every gated script file through the ESLint Node
// API, so the file list comes from git (see gatedFiles.ts) with no
// command-line length limit and no discovery rules of its own. Any error, and
// any warning, fails the run.
import { ESLint } from 'eslint'
import { resolve } from 'node:path'
import { hasExtension, scriptExtensions } from './extensions.ts'
import { createConfig } from './eslintConfig.ts'
import { listGatedFiles } from './gatedFiles.ts'
import { formatRawValueFindings, scanGatedStyleSheets } from './styleGate.ts'
import { formatControlByteFindings } from './controlBytes.ts'
import { scanGatedFilesForControlBytes } from './controlByteGate.ts'
import { formatPointerFindings, scanGatedFilesForPointers } from './pointerGate.ts'

const root = resolve(import.meta.dirname, '..')
const gatedFiles = listGatedFiles(root)
const files = gatedFiles.filter((file) => hasExtension(file, scriptExtensions))

const eslint = new ESLint({
  cwd: root,
  // The config comes straight from the factory, with no config file lookup:
  // the gate and eslint.config.ts cannot disagree about which factory ran.
  overrideConfigFile: true,
  overrideConfig: await createConfig({ root, files: gatedFiles }),
})

const results = await eslint.lintFiles(files)
const formatter = await eslint.loadFormatter('stylish')
const output = await formatter.format(results)
if (output.trim().length > 0) {
  process.stdout.write(output)
}

const errors = results.reduce((count, result) => count + result.errorCount, 0)
const warnings = results.reduce((count, result) => count + result.warningCount, 0)
if (errors > 0 || warnings > 0) {
  process.exitCode = 1
}

// The stylesheet gate runs after ESLint, in the same process: every gated
// stylesheet is scanned for raw design values, and any finding fails the
// run the way an ESLint error does. All gates report in one run.
const styleFindings = scanGatedStyleSheets(root)
if (styleFindings.length > 0) {
  process.stdout.write(`${formatRawValueFindings(styleFindings)}\n`)
  process.exitCode = 1
}

// The pointer gate runs after the stylesheet gate, in the same process:
// every gated text file is scanned for pointers to local-only material, and
// any finding fails the run the way an ESLint error does. All gates report
// in one run.
const pointerFindings = scanGatedFilesForPointers(root)
if (pointerFindings.length > 0) {
  process.stdout.write(`${formatPointerFindings(pointerFindings)}\n`)
  process.exitCode = 1
}

// The control byte gate runs last, in the same process: every gated text
// file is scanned for ASCII control characters other than tab, line feed and
// carriage return, and any finding fails the run.
const controlByteFindings = scanGatedFilesForControlBytes(root)
if (controlByteFindings.length > 0) {
  process.stdout.write(`${formatControlByteFindings(controlByteFindings)}\n`)
  process.exitCode = 1
}
