// Frame loop probes: content code never runs on the engine's frame loop
// directly, through any of R3F's frame loop entries or any door past the
// import rule, so a frame that throws always lands on the stage's frame
// path. Every entry and every door is planted as a violation; an import of
// another R3F name, and every entry and door in the stage's frame modules,
// stay clean, which pins the rule to exact names and exact paths.
import {
  frameLoopRestriction,
  frameLoopSyntaxRestrictions,
  stageFrameModules,
  type FrameLoopSyntaxName,
} from './frameLoopRule.ts'
import type { PlantedCase } from './plantedShapes.ts'

function frameLoopImport(names: string): string {
  return `import { ${names} } from '@react-three/fiber'\nexport const planted = [${names}]\n`
}

// One planted use per syntax door, each a whole module.
const syntaxDoorCode: Readonly<Record<FrameLoopSyntaxName, string>> = {
  'dynamic-import': `export const planted = import('@react-three/fiber')\n`,
  'internal-subscribe': `export function planted(state: { internal: { subscribe(): void } }): void {\n  state.internal.subscribe()\n}\n`,
  'animation-loop': `export function planted(renderer: { setAnimationLoop(loop: null): void }): void {\n  renderer.setAnimationLoop(null)\n}\n`,
  'animation-frame': `export const planted = requestAnimationFrame(() => undefined)\n`,
}

// Every door at once, with every entry imported, for the exempt modules.
function everyFrameLoopUse(): string {
  const names = frameLoopRestriction.importNames.join(', ')
  const doors = frameLoopSyntaxRestrictions
    .map(({ name }, index) => syntaxDoorCode[name].replaceAll('planted', `plantedDoor${index}`))
    .join('')
  return `import { ${names} } from '@react-three/fiber'\nexport const planted = [${names}]\n${doors}`
}

export function frameLoopCases(): PlantedCase[] {
  return [
    ...frameLoopRestriction.importNames.map((name): PlantedCase => ({
      title: `a content module importing ${name} from R3F`,
      tree: 'violations',
      file: `src/viewer/uses-${name}.ts`,
      code: frameLoopImport(name),
      expectedRuleIds: ['no-restricted-imports'],
    })),
    {
      title: 'a content module importing R3F as a namespace',
      tree: 'violations',
      file: 'src/viewer/uses-fiber-namespace.ts',
      code: `import * as fiber from '@react-three/fiber'\nexport const planted = fiber\n`,
      expectedRuleIds: ['no-restricted-imports'],
    },
    ...frameLoopSyntaxRestrictions.map(({ name }): PlantedCase => ({
      title: `a content module reaching the frame loop through the ${name} door`,
      tree: 'violations',
      file: `src/viewer/uses-${name}.ts`,
      code: syntaxDoorCode[name],
      expectedRuleIds: ['no-restricted-syntax'],
    })),
    {
      title: 'a content module importing another R3F name',
      tree: 'clean',
      file: 'src/viewer/uses-three-state.ts',
      code: frameLoopImport('useThree'),
      expectedRuleIds: [],
    },
    ...stageFrameModules.map((file): PlantedCase => ({
      title: `the stage frame module ${file} using every frame loop entry and door`,
      tree: 'clean',
      file,
      code: everyFrameLoopUse(),
      expectedRuleIds: [],
    })),
  ]
}
