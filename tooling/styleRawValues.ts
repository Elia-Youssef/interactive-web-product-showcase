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

// Every at-rule prelude is scanned, with no list of at-rules: a literal in
// a media, container or supports condition, or in a custom media
// definition, bypasses the tokens the same way a declaration value does.
// Preludes that only name things (a keyframes or layer name, an import
// path) carry no literal tokens, so they pass by the same rules.
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
