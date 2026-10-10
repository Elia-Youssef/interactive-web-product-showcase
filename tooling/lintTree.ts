// Plants throwaway project trees under the gitignored scratch/ and lints them
// with the real ESLint configuration, so the lint rule suite proves the exact
// rules the lint gate runs. Each run gets its own unique tree, and the trees
// never touch the real src/.
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
import { execFixtureFile } from './subprocess.fixtures.ts'

export type LintMessage = {
  ruleId: string | null
  severity: number
  message: string
  line: number
}

// Relative file path inside the planted tree, POSIX style
export type LintReport = Map<string, LintMessage[]>

type PlantedLintOptions = { readonly cwd?: string; readonly files?: readonly string[] }

export type PlantedProject = {
  readonly root: string
  add(relativePath: string, content: string): void
  configure(): void
  lint(options?: PlantedLintOptions): Promise<LintReport>
  remove(): void
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratchRoot = join(repoRoot, 'scratch')
const eslintBin = join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
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

async function lintPlantedRoots(root: string, cwd: string, roots: string[]): Promise<LintReport> {
  const { stdout } = await execFixtureFile(
    process.execPath,
    [eslintBin, ...roots, '--format', 'json'],
    { cwd, maxBuffer: 32 * 1024 * 1024 },
  ).catch((error: unknown) => {
    // ESLint exits 1 for planted violations. Every other failure,
    // including a killed child, must reject the fixture.
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 1 &&
      'stdout' in error &&
      typeof error.stdout === 'string'
    ) {
      return { stdout: error.stdout }
    }
    throw error
  })
  const results = JSON.parse(stdout) as Array<{
    filePath: string
    messages: LintMessage[]
  }>
  const report: LintReport = new Map()
  for (const result of results) {
    report.set(toPosix(relative(root, result.filePath)), result.messages)
  }
  return report
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
    configure(): void {
      // Planted trees are ignored by the parent repository. Hand their exact
      // file set to the factory instead of discovering the parent's files.
      writePlantedConfig(root, factoryImport, files)
    },
    async lint({ cwd = root, files: selectedFiles }: PlantedLintOptions = {}): Promise<LintReport> {
      // Targets resolve from the planted tree even when config discovery
      // starts from a subdirectory. Root runs include the tests folder when
      // present, so its scoped rules are covered too.
      const targets =
        selectedFiles ?? lintedRoots.filter((folder) => existsSync(join(root, folder)))
      const roots = targets.map((file) => toPosix(join(root, file)))
      return lintPlantedRoots(root, cwd, roots)
    },
    remove(): void {
      rmSync(root, { recursive: true, force: true })
    },
  }
}
