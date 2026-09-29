// The report format: what a reader sees per product and for the run.
// Pinned exactly, because the wording is what an audit reads.
import { describe, expect, it } from 'vitest'
import { checkResult, skippedCheck, type ProductValidation } from './validateChecks.ts'
import { formatProductReport, formatRunSummary } from './validateReport.ts'

function validationWith(checks: ProductValidation['checks']): ProductValidation {
  return { slug: 'fixture-speaker', checks }
}

describe('formatProductReport', () => {
  it('shows each passing group as its detail line', () => {
    const report = formatProductReport(
      validationWith([
        checkResult('manifest', `slug 'fixture-speaker'`, []),
        checkResult('budgets', '1.00 KB of 4.00 MB (0.0%), no textures, 5 draw calls of 50', []),
      ]),
    )
    expect(report).toBe(
      [
        'product: fixture-speaker',
        `  manifest: slug 'fixture-speaker'`,
        '  budgets: 1.00 KB of 4.00 MB (0.0%), no textures, 5 draw calls of 50',
        '',
      ].join('\n'),
    )
  })

  it('lists violations and warnings under their group', () => {
    const report = formatProductReport(
      validationWith([
        checkResult('hotspots', '2 manifest hotspots', [
          `no HS_dial node for manifest hotspot 'dial'`,
        ]),
        checkResult(
          'cameras',
          'found CAM_home, CAM_side',
          [],
          [`camera CAM_side has no manifest hotspot 'side'`],
        ),
        skippedCheck('encoding', 'the model did not read'),
      ]),
    )
    expect(report).toBe(
      [
        'product: fixture-speaker',
        `  hotspots: 2 manifest hotspots`,
        `    1 violation:`,
        `      - no HS_dial node for manifest hotspot 'dial'`,
        '  cameras: found CAM_home, CAM_side',
        '    1 warning:',
        `      * camera CAM_side has no manifest hotspot 'side'`,
        '  encoding: skipped: the model did not read',
        '',
      ].join('\n'),
    )
  })
})

describe('formatRunSummary', () => {
  it('passes with no violations and notes warnings', () => {
    const summary = formatRunSummary([
      validationWith([checkResult('cameras', 'found CAM_home', [], ['a warning'])]),
    ])
    expect(summary).toBe('validate passed: 1 product, no violations, 1 warning')
  })

  it('fails naming the violation and warning counts', () => {
    const summary = formatRunSummary([
      validationWith([checkResult('hotspots', '2 manifest hotspots', ['a violation'])]),
      validationWith([checkResult('cameras', 'no cameras', ['one', 'two'], ['a warning'])]),
    ])
    expect(summary).toBe('validate failed: 3 violations in 2 products, 1 warning')
  })
})
