// The one way a stylesheet becomes an AST in this repo: every scan over
// owned stylesheets parses through here, so the scans cannot drift on
// syntax handling or error behavior. Malformed CSS throws, so a broken
// file fails its gate loudly instead of passing unscanned.
import postcss from 'postcss'
import type { AtRule, Declaration, Node, Root } from 'postcss'

// A span of verbatim source text inside a parsed stylesheet: the text a
// value rule scans, and the character offset its first character sits at
// within the whole file.
export type SourceText = {
  readonly text: string
  readonly start: number
}

export function parseStylesheet(css: string, from: string): Root {
  return postcss.parse(css, { from })
}

// The exact source text and start offset of a declaration value. postcss
// keeps a cleaned value on the node, with inline comments moved into raws,
// so the verbatim text is what gets scanned and the offsets it carries are
// file offsets.
export function declarationValueSource(decl: Declaration): SourceText {
  const between = decl.raws.between
  if (between === undefined) {
    throw new Error(`declaration "${decl.prop}" carries no source text to locate its value`)
  }
  return {
    text: decl.raws.value?.raw ?? decl.value,
    start: sourceOffset(decl) + decl.prop.length + between.length,
  }
}

// The same for the prelude of an at-rule: everything between the at
// keyword and the block, `@media (min-width: 600px)` and friends.
export function atRulePreludeSource(atrule: AtRule): SourceText {
  const afterName = atrule.raws.afterName ?? ''
  return {
    text: atrule.raws.params?.raw ?? atrule.params,
    start: sourceOffset(atrule) + 1 + atrule.name.length + afterName.length,
  }
}

// A 1-based line and column for a character offset, as the gates report
// positions.
export function lineColumnOf(css: string, offset: number): { line: number; column: number } {
  let line = 1
  let lineStart = 0
  for (let index = 0; index < offset; index += 1) {
    if (css.charCodeAt(index) === 10) {
      line += 1
      lineStart = index + 1
    }
  }
  return { line, column: offset - lineStart + 1 }
}

function sourceOffset(node: Node): number {
  const start = node.source?.start
  if (start === undefined) {
    throw new Error(`a parsed ${node.type} node carries no source position`)
  }
  return start.offset
}
