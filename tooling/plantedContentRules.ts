// Content probes: file and function size, the console policy and the React
// hooks rules.
import { exportLines, longFunction } from './plantedShapes.ts'
import type { PlantedCase } from './plantedShapes.ts'

export function sizeCases(): PlantedCase[] {
  return [
    {
      title: 'a 251-line file',
      tree: 'violations',
      file: 'src/lib/too-long.ts',
      code: exportLines(251),
      expectedRuleIds: ['max-lines'],
    },
    {
      title: 'a 250-line file',
      tree: 'clean',
      file: 'src/lib/at-limit.ts',
      code: exportLines(250),
      expectedRuleIds: [],
    },
    {
      title: 'a 51-line function',
      tree: 'violations',
      file: 'src/lib/too-long-function.ts',
      code: longFunction(47),
      expectedRuleIds: ['max-lines-per-function'],
    },
    {
      title: 'a 50-line function',
      tree: 'clean',
      file: 'src/lib/at-limit-function.ts',
      code: longFunction(46),
      expectedRuleIds: [],
    },
    {
      title: 'a long arrange-and-assert body in a test file',
      tree: 'clean',
      file: 'src/lib/long-test-function.test.ts',
      code: longFunction(80),
      expectedRuleIds: [],
    },
    {
      title: 'an overlong test file still fails the file limit',
      tree: 'violations',
      file: 'src/lib/too-long.test.ts',
      code: exportLines(251),
      expectedRuleIds: ['max-lines'],
    },
  ]
}

export function consoleCases(): PlantedCase[] {
  return [
    {
      title: 'console.log',
      tree: 'violations',
      file: 'src/app/uses-console-log.ts',
      code: "export function planted(): void {\n  console.log('planted')\n}\n",
      expectedRuleIds: ['no-console'],
    },
    {
      title: 'console.warn and console.error stay for loud boundaries',
      tree: 'clean',
      file: 'src/app/logs-at-boundary.ts',
      code: "export function planted(): void {\n  console.warn('planted')\n  console.error('planted')\n}\n",
      expectedRuleIds: [],
    },
    {
      title: 'an empty object pattern in production code',
      tree: 'violations',
      file: 'src/lib/empty-pattern.ts',
      code: 'export function planted({}): number {\n  return 1\n}\n',
      expectedRuleIds: ['no-empty-pattern'],
    },
  ]
}

const badHooks = [
  "import { useState } from 'react'",
  '',
  'export function BadHooks({ flag }: { flag: boolean }) {',
  '  if (flag) {',
  '    const [value] = useState(0)',
  '    return <main>{value}</main>',
  '  }',
  '  return <main>planted</main>',
  '}',
  '',
].join('\n')

const badDeps = [
  "import { useEffect, useState } from 'react'",
  '',
  'export function BadDeps() {',
  '  const [count, setCount] = useState(0)',
  '  useEffect(() => {',
  '    setCount(count + 1)',
  '  }, [])',
  '  return <main>{count}</main>',
  '}',
  '',
].join('\n')

const goodHooks = [
  "import { useEffect, useState } from 'react'",
  '',
  'export function GoodHooks() {',
  '  const [count, setCount] = useState(0)',
  '  useEffect(() => {',
  '    setCount(count + 1)',
  '  }, [count])',
  '  return <main>{count}</main>',
  '}',
  '',
].join('\n')

export function hooksCases(): PlantedCase[] {
  return [
    {
      title: 'a conditionally called hook',
      tree: 'violations',
      file: 'src/app/bad-hooks.tsx',
      code: badHooks,
      expectedRuleIds: ['react-hooks/rules-of-hooks'],
    },
    {
      title: 'a missing effect dependency',
      tree: 'violations',
      file: 'src/app/bad-deps.tsx',
      code: badDeps,
      expectedRuleIds: ['react-hooks/exhaustive-deps'],
    },
    {
      title: 'disciplined hooks',
      tree: 'clean',
      file: 'src/app/good-hooks.tsx',
      code: goodHooks,
      expectedRuleIds: [],
    },
  ]
}

// The renderer compile walk the frame path replaces. Both spellings of the
// scene compile are banned in src; the compute compile is a different walk
// over compute pipelines the stage never builds, so it stays allowed and
// pins the selector to exact names.
export function rendererCompileCases(): PlantedCase[] {
  return [
    {
      title: 'a renderer compileAsync call',
      tree: 'violations',
      file: 'src/viewer/uses-compile-async.ts',
      code: 'export function planted(renderer: { compileAsync(): Promise<void> }): Promise<void> {\n  return renderer.compileAsync()\n}\n',
      expectedRuleIds: ['no-restricted-syntax'],
    },
    {
      title: 'a renderer compile call, the installed alias of compileAsync',
      tree: 'violations',
      file: 'src/viewer/uses-compile-alias.ts',
      code: 'export function planted(renderer: { compile(): Promise<void> }): Promise<void> {\n  return renderer.compile()\n}\n',
      expectedRuleIds: ['no-restricted-syntax'],
    },
    {
      title: 'a compute compile call is not the scene compile walk',
      tree: 'clean',
      file: 'src/viewer/uses-compute-compile.ts',
      code: 'export function planted(renderer: { compileComputeAsync(): Promise<void> }): Promise<void> {\n  return renderer.compileComputeAsync()\n}\n',
      expectedRuleIds: [],
    },
  ]
}
