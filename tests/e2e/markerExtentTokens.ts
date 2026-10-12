import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStylesheet } from '../../tooling/styleParse.ts'
import { tokenSourcePath } from '../../tooling/tokenSource.ts'
import { readMarkerExtent } from '../../src/lib/hotspots/cardLayout'
import type { MarkerExtent } from '../../src/lib/hotspots/markerBox'

// The marker extent the stylesheets declare, read in Node for the specs
// that choose their subjects before a page exists: the token source's
// root-level custom properties, each var() reference resolved, handed to
// the viewer's own extent reader. So the facts and the runtime read the
// same tokens through the same reader, and no length is written twice.
// The marker tokens sit at the root level, outside every breakpoint block;
// a token the reader needs that only a breakpoint declares fails here.

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

export async function readMarkerExtentTokens(): Promise<MarkerExtent> {
  const css = await readFile(path.join(ROOT, tokenSourcePath), 'utf8')
  const declared = new Map<string, string>()
  parseStylesheet(css, tokenSourcePath).each((node) => {
    if (node.type !== 'rule' || node.selector !== ':root') {
      return
    }
    node.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) {
        declared.set(decl.prop, decl.value.trim())
      }
    })
  })
  return readMarkerExtent({ getPropertyValue: (property) => resolved(declared, property, []) })
}

// One custom property's value with its var() reference followed to the
// declaration it names. The marker tokens are a plain length or a whole
// var() of another token; any other shape is a token that changed shape.
function resolved(
  declared: ReadonlyMap<string, string>,
  property: string,
  seen: readonly string[],
): string {
  const value = declared.get(property)
  if (value === undefined) {
    throw new Error(`the token source declares no root-level ${property}`)
  }
  if (seen.includes(property)) {
    throw new Error(`the token ${property} refers back to itself through ${seen.join(', ')}`)
  }
  const reference = /^var\((--[\w-]+)\)$/.exec(value)
  return reference?.[1] === undefined
    ? value
    : resolved(declared, reference[1], [...seen, property])
}
