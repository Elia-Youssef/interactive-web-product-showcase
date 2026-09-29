// The raw value rules over planted CSS strings: every rule class gets
// failing and passing rows, and the rows pin the reported position,
// property, kind and literal. The core takes a path and a stylesheet text,
// so nothing here touches the file system.

import { describe, expect, test } from 'vitest'
import { namedColors } from './namedColors.ts'
import { findRawValues } from './styleRawValues.ts'
import type { RawValueFinding } from './styleRawValues.ts'
import { allValueRows, plantedPath } from './styleValueRows.ts'

describe('the raw design value rules', () => {
  for (const row of allValueRows) {
    test(row.title, () => {
      const expected: RawValueFinding[] = row.expected.map((finding) => ({
        path: row.path ?? plantedPath,
        ...finding,
        kind: finding.kind as RawValueFinding['kind'],
      }))
      expect(findRawValues(row.path ?? plantedPath, row.css)).toEqual(expected)
    })
  }
})

describe('the named color list', () => {
  test('holds every CSS Color 4 name', () => {
    expect(namedColors.size).toBe(148)
  })
})
