// Type-safety probes: the escapes the type checker must never be silenced
// with, and the import-annotation form that hides a dependency from the layer
// gate.
import { typeImport } from './plantedShapes.ts'
import type { PlantedCase } from './plantedShapes.ts'

export function tsDirectiveCases(): PlantedCase[] {
  return [
    {
      title: '@ts-ignore',
      tree: 'violations',
      file: 'src/app/uses-ts-ignore.ts',
      code: '// @ts-ignore\nexport const planted: string = 1\n',
      expectedRuleIds: ['@typescript-eslint/ban-ts-comment'],
    },
    {
      title: '@ts-nocheck',
      tree: 'violations',
      file: 'src/app/uses-ts-nocheck.ts',
      code: '// @ts-nocheck\nexport const planted: string = 1\n',
      expectedRuleIds: ['@typescript-eslint/ban-ts-comment'],
    },
    {
      title: '@ts-expect-error without a description',
      tree: 'violations',
      file: 'src/app/uses-bare-expect-error.ts',
      code: '// @ts-expect-error\nexport const planted: string = 1\n',
      expectedRuleIds: ['@typescript-eslint/ban-ts-comment'],
    },
    {
      title: 'a described @ts-expect-error stays allowed',
      tree: 'clean',
      file: 'src/app/described-expect-error.ts',
      code: '// @ts-expect-error the planted type mismatch is deliberate\nexport const planted: string = 1\n',
      expectedRuleIds: [],
    },
  ]
}

export function assertionEscapeCases(): PlantedCase[] {
  return [
    {
      title: 'double assertion through unknown',
      tree: 'violations',
      file: 'src/app/uses-double-assertion.ts',
      code: 'export const planted = 1 as unknown as string\n',
      expectedRuleIds: ['no-restricted-syntax'],
    },
    {
      title: 'double assertion through never',
      tree: 'violations',
      file: 'src/app/uses-never-assertion.ts',
      code: 'export const planted = 1 as never as string\n',
      expectedRuleIds: ['no-restricted-syntax'],
    },
    {
      title: 'double assertion with angle brackets',
      tree: 'violations',
      file: 'src/app/uses-angle-assertion.ts',
      code: 'export const planted = <string>(<unknown>1)\n',
      expectedRuleIds: ['no-restricted-syntax'],
    },
    {
      title: 'double assertion mixing both syntaxes',
      tree: 'violations',
      file: 'src/app/uses-mixed-assertion.ts',
      code: 'export const planted = <string>(1 as unknown)\n',
      expectedRuleIds: ['no-restricted-syntax'],
    },
  ]
}

export function typeKeywordCases(): PlantedCase[] {
  return [
    {
      title: 'explicit any',
      tree: 'violations',
      file: 'src/app/uses-any.ts',
      code: 'export const planted: any = 1\n',
      expectedRuleIds: ['@typescript-eslint/no-explicit-any'],
    },
    {
      title: 'non-null assertions',
      tree: 'violations',
      file: 'src/app/uses-non-null.ts',
      code: 'export function first(items: string[]): string {\n  return items[0]!\n}\n',
      expectedRuleIds: ['@typescript-eslint/no-non-null-assertion'],
    },
  ]
}

export function annotationImportCases(): PlantedCase[] {
  return [
    {
      title: 'an import() type annotation hiding the dependency',
      tree: 'violations',
      file: 'src/ui/type-query.ts',
      code: `export type Planted = typeof import('@store/target')\n`,
      expectedRuleIds: ['@typescript-eslint/consistent-type-imports'],
    },
    {
      title: 'a type-only dependency through a real import statement',
      tree: 'clean',
      file: 'src/ui/type-import.ts',
      code: typeImport('@lib/target'),
      expectedRuleIds: [],
    },
  ]
}
