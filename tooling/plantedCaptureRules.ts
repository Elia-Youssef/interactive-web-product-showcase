// Planted cases for the raw-capture ban: the capture spellings that escape a
// call-level selector, the exempt module itself, and the proof that the
// exempt path keeps the folder's other bans.
import { pollStandIn } from './plantedContentRules.ts'
import type { PlantedCase } from './plantedShapes.ts'

// Stand-ins for the runner's capture APIs, declared in the planted files, so
// the cases need no installed test runner in the planted tree. Each case
// declares only the stand-ins it uses, so no unused name trips the folder's
// own rules beside the one under test.
const pageStandIn = 'declare const page: { screenshot(options?: unknown): Promise<Uint8Array> }\n'
const snapshotStandIn =
  'declare const expect: { (page: unknown): { toHaveScreenshot(name: string, options?: unknown): Promise<void> } }\n'

function captureCase(
  title: string,
  tree: 'violations' | 'clean',
  file: string,
  code: string,
): PlantedCase {
  return {
    title,
    tree,
    file,
    code,
    expectedRuleIds: tree === 'violations' ? ['no-restricted-syntax'] : [],
  }
}

const rawScreenshotCall = `export async function planted(): Promise<void> {\n  await page.screenshot({ mask: [] })\n}\n`
const rawSnapshotCall = `export async function planted(): Promise<void> {\n  await expect(page).toHaveScreenshot('planted.png')\n}\n`
const stringScreenshotCall = `export async function planted(): Promise<void> {\n  await page['screenshot']({ mask: [] })\n}\n`
const liftedScreenshotCall = `export async function planted(): Promise<void> {\n  const raw = page.screenshot.bind(page)\n  await raw({ mask: [] })\n}\n`
const stringSnapshotCall = `export async function planted(): Promise<void> {\n  await expect(page)['toHaveScreenshot']('planted.png')\n}\n`
const barePollCall = `export async function planted(): Promise<void> {\n  await expect.poll(() => 1).toBe(1)\n}\n`

// The raw-capture ban binds every test file but the capture module itself:
// the same calls lint clean at the exempt path, and they are the module's to
// make. The exempt path keeps the folder's other bans, so a poll without its
// budget planted there is still reported.
export function stageCaptureCases(): PlantedCase[] {
  return [
    captureCase(
      'a raw page screenshot in a spec',
      'violations',
      'tests/e2e/raw-screenshot.spec.ts',
      `${pageStandIn}${rawScreenshotCall}`,
    ),
    captureCase(
      'a raw visual snapshot assertion in a spec',
      'violations',
      'tests/e2e/raw-visual-snapshot.spec.ts',
      `${pageStandIn}${snapshotStandIn}${rawSnapshotCall}`,
    ),
    captureCase(
      'a screenshot call through a string property in a spec',
      'violations',
      'tests/e2e/string-screenshot.spec.ts',
      `${pageStandIn}${stringScreenshotCall}`,
    ),
    captureCase(
      'a lifted screenshot method in a spec',
      'violations',
      'tests/e2e/lifted-screenshot.spec.ts',
      `${pageStandIn}${liftedScreenshotCall}`,
    ),
    captureCase(
      'a visual snapshot through a string property in a spec',
      'violations',
      'tests/e2e/string-visual-snapshot.spec.ts',
      `${pageStandIn}${snapshotStandIn}${stringSnapshotCall}`,
    ),
    captureCase(
      'the capture module itself takes the raw captures',
      'clean',
      'tests/e2e/stageCapture.ts',
      `${pageStandIn}${snapshotStandIn}${rawScreenshotCall}${rawSnapshotCall}`,
    ),
    captureCase(
      'the capture module still answers to the poll budget rule',
      'violations',
      'tests/e2e/stageCapture.ts',
      `${pollStandIn}${barePollCall}`,
    ),
  ]
}
