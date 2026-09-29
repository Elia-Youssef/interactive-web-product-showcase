// The shared shape of the planted rows for the raw value rules, and the
// single list the test iterates. The rows themselves live in their rule
// family modules, so the table grows without anyone rewriting the runner.
import { colorValueRows } from './styleColorValueRows.ts'
import type { RawKind } from './styleRawRules.ts'
import { sizeValueRows } from './styleSizeValueRows.ts'

export type ExpectedFinding = {
  readonly line: number
  readonly column: number
  readonly property: string
  readonly kind: RawKind
  readonly literal: string
}

export type Row = {
  readonly title: string
  readonly css: string
  // The path the gate scans under, when the row is not about a component
  // stylesheet
  readonly path?: string
  // The findings in file order; empty means the planted CSS passes
  readonly expected: readonly ExpectedFinding[]
}

// The stylesheet path every component row is scanned under.
export const plantedPath = 'src/ui/planted.module.css'

export const allValueRows: readonly Row[] = [...sizeValueRows, ...colorValueRows]
