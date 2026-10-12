// The frame loop rule of src/, in one place for the lint configuration and
// its planted proof. Every way to run code on the engine's frame loop
// directly (R3F's frame loop entries, a dynamic import of R3F that reaches
// them, R3F's own subscription list, the renderer's animation loop, the
// browser's frame callback) runs it where a throw escapes as a page error
// and fails nothing. Content code runs its frame work through the stage's
// frame path instead, which owns what a frame throws; only the stage's
// frame modules subscribe to the loop itself.

const frameLoopMessage =
  "Frame work runs through the stage's frame path (useStageFrame and usePresentedFrame in src/viewer/stageFrameContext.ts), which owns what a frame throws."

export const frameLoopRestriction = {
  name: '@react-three/fiber',
  importNames: ['useFrame', 'addEffect', 'addAfterEffect', 'addTail'],
  message: frameLoopMessage,
}

// The doors past the import rule, one selector each, named so the planted
// proof plants one violation per door.
export const frameLoopSyntaxRestrictions = [
  {
    name: 'dynamic-import',
    selector: "ImportExpression[source.value='@react-three/fiber']",
    message: frameLoopMessage,
  },
  {
    name: 'internal-subscribe',
    selector:
      "MemberExpression[property.name='subscribe']:matches([object.name='internal'], [object.property.name='internal'])",
    message: frameLoopMessage,
  },
  {
    name: 'animation-loop',
    selector: "MemberExpression[property.name='setAnimationLoop']",
    message: frameLoopMessage,
  },
  {
    name: 'animation-frame',
    selector: "Identifier[name='requestAnimationFrame']",
    message: frameLoopMessage,
  },
] as const

export type FrameLoopSyntaxName = (typeof frameLoopSyntaxRestrictions)[number]['name']

// The stage's frame modules: the frame path's own callback hooks and the
// stage's present, the two places that subscribe to R3F's frame loop.
export const stageFrameModules = [
  'src/viewer/stageFrameContext.ts',
  'src/viewer/StagePresenter.tsx',
]

// Whether a namespace import of the package reaches restricted names: the
// rule reports every namespace import of a package it restricts names of,
// since a namespace reaches each of them.
export function namespaceImportRestricted(specifier: string): boolean {
  return specifier === frameLoopRestriction.name
}
