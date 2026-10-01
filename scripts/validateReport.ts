// The validate run's report: one block per product naming what was checked
// and every violation and warning, then the run summary. Violations fail
// the gate; warnings and skipped groups only tell the reader why.
import {
  countViolations,
  countWarnings,
  type CheckResult,
  type ProductValidation,
} from './validateChecks.ts'

const VIOLATION_MARKER = '- '
const WARNING_MARKER = '* '

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function formatCheck(check: CheckResult): string {
  const lines = [`  ${check.name}: ${check.detail}`]
  if (check.violations.length > 0) {
    lines.push(`    ${plural(check.violations.length, 'violation')}:`)
    for (const violation of check.violations) {
      lines.push(`      ${VIOLATION_MARKER}${violation}`)
    }
  }
  if (check.warnings.length > 0) {
    lines.push(`    ${plural(check.warnings.length, 'warning')}:`)
    for (const warning of check.warnings) {
      lines.push(`      ${WARNING_MARKER}${warning}`)
    }
  }
  return lines.join('\n')
}

export function formatProductReport(validation: ProductValidation): string {
  const lines = [`product: ${validation.slug}`]
  for (const check of validation.checks) {
    lines.push(formatCheck(check))
  }
  return `${lines.join('\n')}\n`
}

export function formatRunSummary(validations: readonly ProductValidation[]): string {
  const violations = validations.reduce((sum, validation) => sum + countViolations(validation), 0)
  const warnings = validations.reduce((sum, validation) => sum + countWarnings(validation), 0)
  const products = plural(validations.length, 'product')
  const warningNote = warnings === 0 ? '' : `, ${plural(warnings, 'warning')}`
  if (violations > 0) {
    return `validate failed: ${plural(violations, 'violation')} in ${products}${warningNote}`
  }
  return `validate passed: ${products}, no violations${warningNote}`
}
