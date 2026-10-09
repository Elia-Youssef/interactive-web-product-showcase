// Plants throwaway project trees under the gitignored scratch/ and lints them
// with the real ESLint configuration, so the lint rule suite proves the exact
// rules the lint gate runs. Each run gets its own unique tree, and the trees
// never touch the real src/.
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type LintMessage = {
  ruleId: string | null
  severity: number
  message: string
  line: number
}

// Relative file path inside the planted tree, POSIX style
export type LintReport = Map<string, LintMessage[]>

export type PlantedProject = {
  readonly root: string
  add(relativePath: string, content: string): void
  lint(options?: { readonly cwd?: string }): LintReport
  remove(): void
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratchRoot = join(repoRoot, 'scratch')
const eslintBin = join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
const lintTimeoutMs = 240_000
// The folders of a planted tree the lint runs over, when present.
const lintedRoots = ['src', 'tests']

// The alias table comes from the repo tsconfig: the planted trees resolve the
// same aliases as the real code, with no second hand-written table.
function aliasPaths(): Record<string, string[]> {
  const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.json'), 'utf8')) as {
    compilerOptions?: { paths?: Record<string, string[]> }
  }
  return tsconfig.compilerOptions?.paths ?? {}
}

export function aliasFor(folder: string): string {
  for (const [alias, targets] of Object.entries(aliasPaths())) {
    if (targets.includes(`./src/${folder}/*`)) {
      return alias.replace(/\/\*$/, '')
    }
  }
  throw new Error(`no tsconfig path alias covers src/${folder}`)
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

function writePlantedConfig(root: string, factoryImport: string, files: ReadonlySet<string>): void {
  writeFileSync(
    join(root, 'eslint.config.ts'),
    `import { createConfig } from '${factoryImport}'\nexport default await createConfig({ root: import.meta.dirname, files: ${JSON.stringify([...files])} })\n`,
  )
}

export function plantProject(name: string): PlantedProject {
  // A unique tree per run, under the gitignored scratch/, so parallel or
  // interrupted runs never share state. scratch/ is not in git, so a fresh
  // checkout has none: the helper creates the folder it owns.
  mkdirSync(scratchRoot, { recursive: true })
  const root = mkdtempSync(join(scratchRoot, `lint-tree-${name}-`))

  // The repo's own tsconfig and package.json, copied verbatim: the tree
  // resolves the same aliases, and the layer gate reads the same declared
  // packages. Nothing here is hand-written a second time.
  copyFileSync(join(repoRoot, 'tsconfig.json'), join(root, 'tsconfig.json'))
  copyFileSync(join(repoRoot, 'package.json'), join(root, 'package.json'))

  // The real configuration, through the factory, anchored at this tree's root.
  const factoryImport = toPosix(relative(root, join(repoRoot, 'tooling', 'eslintConfig.ts')))
  const files = new Set(['tsconfig.json', 'package.json', 'eslint.config.ts'])

  return {
    root,
    add(relativePath: string, content: string): void {
      const file = join(root, relativePath)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`)
      files.add(toPosix(relativePath))
    },
    lint({ cwd = root }: { readonly cwd?: string } = {}): LintReport {
      // Planted trees are ignored by the parent repository. Hand their exact
      // file set to the factory instead of discovering the parent's files.
      writePlantedConfig(root, factoryImport, files)
      // The tree's planted roots are passed absolutely, so the invocation
      // works from a subdirectory too: there the config is still discovered
      // at the root, while the process working directory differs from it.
      // The roots are src and, when a case planted there, tests, so rules
      // scoped to the tests folder are proven the same way.
      const roots = lintedRoots
        .map((folder) => join(root, folder))
        .filter(existsSync)
        .map(toPosix)
      const run = spawnSync(process.execPath, [eslintBin, ...roots, '--format', 'json'], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        timeout: lintTimeoutMs,
      })
      // A failed spawn and a timed out one both land in error, so it is
      // checked before the exit status can be read.
      if (run.error !== undefined) {
        throw run.error
      }
      // ESLint exits 1 when it finds problems, which is the point here.
      // Anything above that means the run itself broke.
      if (run.status === null || run.status > 1) {
        throw new Error(`eslint exited with ${String(run.status)} in ${root}: ${run.stderr}`)
      }
      const results = JSON.parse(run.stdout) as Array<{
        filePath: string
        messages: LintMessage[]
      }>
      const report: LintReport = new Map()
      for (const result of results) {
        report.set(toPosix(relative(root, result.filePath)), result.messages)
      }
      return report
    },
    remove(): void {
      rmSync(root, { recursive: true, force: true })
    },
  }
}
