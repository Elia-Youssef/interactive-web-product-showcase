// The planted lint suite: assembles the single case list from the case-group
// modules, plants both trees (violations and clean counterparts), lints them
// with the real configuration and removes them even when the run throws. What
// comes back is the evidence the test asserts on.
import { join } from 'node:path'
import { plantProject } from './lintTree.ts'
import type { LintReport, PlantedProject } from './lintTree.ts'
import { layers } from './layers.ts'
import { sampleElements, stylesheetName, targetModuleCode, valueImport } from './plantedShapes.ts'
import type { PlantedCase } from './plantedShapes.ts'
import { compositionRootCases, matrixCases } from './plantedMatrix.ts'
import {
  annotationImportCases,
  assertionEscapeCases,
  tsDirectiveCases,
  typeKeywordCases,
} from './plantedTypeRules.ts'
import {
  bannedPackageCases,
  cycleCases,
  devDependencyCases,
  escapeCases,
  extensionCases,
  externalsCases,
  foreignScriptCases,
  fixtureCases,
  stylesCases,
} from './plantedImportRules.ts'
import {
  consoleCases,
  hooksCases,
  pollBudgetCases,
  rendererCompileCases,
  sizeCases,
} from './plantedContentRules.ts'
import { stageCaptureCases } from './plantedCaptureRules.ts'
import { frameLoopCases } from './plantedFrameLoopRules.ts'
import { reducedMotionCases } from './plantedReducedMotionRules.ts'
import { globCases } from './plantedGlobRules.ts'

export type { PlantedCase } from './plantedShapes.ts'
export { LAYERS_RULE } from './plantedShapes.ts'

export function buildPlantedCases(): readonly PlantedCase[] {
  return [
    ...matrixCases(),
    ...compositionRootCases(),
    ...tsDirectiveCases(),
    ...assertionEscapeCases(),
    ...typeKeywordCases(),
    ...annotationImportCases(),
    ...cycleCases(),
    ...externalsCases(),
    ...devDependencyCases(),
    ...foreignScriptCases(),
    ...stylesCases(),
    ...escapeCases(),
    ...extensionCases(),
    ...bannedPackageCases(),
    ...fixtureCases(),
    ...sizeCases(),
    ...consoleCases(),
    ...hooksCases(),
    ...rendererCompileCases(),
    ...frameLoopCases(),
    ...pollBudgetCases(),
    ...stageCaptureCases(),
    ...reducedMotionCases(),
    ...globCases(),
  ]
}

// Plants the files every case imports: each layer's target, the stylesheet,
// the helper outside src/ and the far sides of the cycle and the one-way
// import.
function plantSupportFiles(project: PlantedProject): void {
  for (const layer of layers) {
    if (layer.artifact === 'stylesheet') {
      project.add(`src/${layer.folder}/${stylesheetName}`, '/* planted stylesheet */\n')
      continue
    }
    if (layer.elements === 'per-subfolder') {
      for (const element of sampleElements) {
        project.add(`src/${layer.folder}/${element}/index.ts`, targetModuleCode(layer))
        project.add(
          `src/${layer.folder}/${element}/internals.ts`,
          `export const layerTarget = '${layer.name}'\n`,
        )
      }
      continue
    }
    project.add(`src/${layer.folder}/target.ts`, targetModuleCode(layer))
  }
  project.add('tooling/helper.ts', 'export const helper = 1\n')
  project.add('src/lib/cycle-b.ts', valueImport('./cycle-a'))
  project.add('src/ui/cycle-tsx-b.tsx', valueImport('./cycle-tsx-a'))
  project.add('src/lib/one-way-b.ts', "export const layerTarget = 'one-way'\n")
  // The fixture module the fixture cases import: planted into both trees,
  // so the importing cases resolve their specifier and the fixture itself
  // lints clean in each tree under the fixture category.
  project.add(
    'src/lib/planted-target.fixtures.ts',
    "import { layerTarget } from './target'\nexport const plantedFixtureTarget = layerTarget\n",
  )
}

export type PlantedSuite = {
  violations: LintReport
  clean: LintReport
  // The violations tree, linted again from one of its subdirectories: the
  // evidence for the cases that prove the config anchors its own root.
  violationsFromSubdirectory?: LintReport
}

export async function plantAndLintCases(cases: readonly PlantedCase[]): Promise<PlantedSuite> {
  const violations = plantProject('violations')
  const clean = plantProject('clean')
  try {
    for (const project of [violations, clean]) {
      plantSupportFiles(project)
    }
    for (const plantedCase of cases) {
      const project = plantedCase.tree === 'violations' ? violations : clean
      project.add(plantedCase.file, plantedCase.code)
    }
    violations.configure()
    clean.configure()
    // The subdirectory run reuses the violations tree, and only happens when
    // a case needs it: eslint discovers the same config up from there, while
    // its working directory differs from the tree root.
    const needsSubdirectoryRun = cases.some(
      (plantedCase) => plantedCase.lintFrom === 'subdirectory',
    )
    // Each invocation has its own output and reads the planted config only.
    // Settle all children before cleanup, even when one invocation fails.
    const runs = await Promise.allSettled([
      violations.lint(),
      clean.lint(),
      needsSubdirectoryRun
        ? violations.lint({ cwd: join(violations.root, 'tooling') })
        : Promise.resolve(undefined),
    ])
    const reports = runs.map((run) => {
      if (run.status === 'rejected') throw run.reason
      return run.value
    })
    const [violationReport, cleanReport, subdirectoryReport] = reports
    if (violationReport === undefined || cleanReport === undefined) {
      throw new Error('the planted lint reports are missing')
    }
    return {
      violations: violationReport,
      ...(needsSubdirectoryRun ? { violationsFromSubdirectory: subdirectoryReport } : {}),
      clean: cleanReport,
    }
  } finally {
    violations.remove()
    clean.remove()
  }
}
