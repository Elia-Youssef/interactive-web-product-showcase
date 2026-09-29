// The lint gate. It lints every owned script file through the ESLint Node
// API, so the file list comes from git (see ownedFiles.ts) with no
// command-line length limit and no discovery rules of its own. Any error, and
// any warning, fails the run.
import { ESLint } from 'eslint'
import { resolve } from 'node:path'
import { hasExtension, scriptExtensions } from './extensions.ts'
import { createConfig } from './eslintConfig.ts'
import { listOwnedFiles } from './ownedFiles.ts'
import { formatRawValueFindings, scanOwnedStyleSheets } from './styleGate.ts'

const root = resolve(import.meta.dirname, '..')
const files = listOwnedFiles(root).filter((file) => hasExtension(file, scriptExtensions))

const eslint = new ESLint({
  cwd: root,
  // The config comes straight from the factory, with no config file lookup:
  // the gate and eslint.config.ts cannot disagree about which factory ran.
  overrideConfigFile: true,
  overrideConfig: createConfig({ root }),
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

// The stylesheet gate runs after ESLint, in the same process: every owned
// stylesheet is scanned for raw design values, and any finding fails the
// run the way an ESLint error does. Both gates report in one run.
const styleFindings = scanOwnedStyleSheets(root)
if (styleFindings.length > 0) {
  process.stdout.write(`${formatRawValueFindings(styleFindings)}\n`)
  process.exitCode = 1
}
