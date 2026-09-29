// The raw design value gate, as a pure core: a path and the stylesheet
// text in, every raw color, size, duration, angle or easing out. No file
// system, so the tests plant strings. The token source is exempt by its
// constant: it is the one file a literal may be written in.
import {
  atRulePreludeSource,
  declarationValueSource,
  lineColumnOf,
  parseStylesheet,
} from './styleParse.ts'
import { rawValueHits } from './styleRawRules.ts'
import type { RawKind } from './styleRawRules.ts'
import { isTokenSource } from './tokenSource.ts'

export type RawValueFinding = {
  readonly path: string
  readonly line: number
  readonly column: number
  readonly property: string
  readonly kind: RawKind
  readonly literal: string
}

// The at-rules whose prelude states a condition. A breakpoint or support
// query written with a literal bypasses the tokens the same way a
// declaration value does. Other preludes name things, a keyframes or layer
// name, an import path, and carry no design values.
const preludeAtRules: ReadonlySet<string> = new Set(['media', 'container', 'supports'])

export function findRawValues(path: string, css: string): RawValueFinding[] {
  if (isTokenSource(path)) {
    return []
  }
  const root = parseStylesheet(css, path)
  const findings: RawValueFinding[] = []
  root.walkDecls((decl) => {
    collectFindings(path, css, decl.prop, declarationValueSource(decl), findings)
  })
  root.walkAtRules((atrule) => {
    if (!preludeAtRules.has(atrule.name.toLowerCase())) {
      return
    }
    collectFindings(
      path,
      css,
      `@${atrule.name.toLowerCase()}`,
      atRulePreludeSource(atrule),
      findings,
    )
  })
  return findings.sort(byPosition)
}

function collectFindings(
  path: string,
  css: string,
  property: string,
  source: { readonly text: string; readonly start: number },
  findings: RawValueFinding[],
): void {
  for (const hit of rawValueHits(source.text)) {
    const { line, column } = lineColumnOf(css, source.start + hit.start)
    findings.push({ path, line, column, property, kind: hit.kind, literal: hit.literal })
  }
}

function byPosition(left: RawValueFinding, right: RawValueFinding): number {
  return left.line - right.line || left.column - right.column
}
