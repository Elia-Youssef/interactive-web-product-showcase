// Literal validation and the union are pure: discovery belongs to the two
// installed Vite expanders, over the supplied file namespace.
import type { Rule } from 'eslint'

export type GlobCall = Extract<Rule.Node, { type: 'CallExpression' }>
type GlobArgument = GlobCall['arguments'][number]
type GlobValue = GlobArgument | Extract<Rule.Node, { type: 'Property' }>['value']
export type GlobExpansion =
  | { readonly kind: 'targets'; readonly files: readonly string[] }
  | { readonly kind: 'problem'; readonly message: string }
export type GlobRequest = { readonly kind: 'request'; readonly argumentsCode: string }
export type GlobModes = { readonly javascript: GlobExpansion; readonly native: GlobExpansion }
export type GlobImportSource = ReadonlyMap<string, GlobExpansion>

export function isGlobCall(node: GlobCall): boolean {
  const callee = node.callee
  return (
    !node.optional &&
    callee.type === 'MemberExpression' &&
    !callee.optional &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'glob' &&
    callee.object.type === 'MetaProperty' &&
    callee.object.meta.name === 'import' &&
    callee.object.property.name === 'meta'
  )
}

export function globImportKey(importer: string, call: GlobCall): string {
  const range = call.range
  if (range === undefined) throw new Error('The glob parser supplied no call range')
  return `${importer}:${range[0]}:${range[1]}`
}

function literalPattern(node: GlobValue | null | undefined): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.raw
  }
  return undefined
}

function literalSource(node: GlobArgument | null | undefined): string | undefined {
  const literal = literalPattern(node)
  if (literal === undefined) return undefined
  // Preserve raw template spelling because both Vite parsers read it.
  return node?.type === 'TemplateLiteral' ? `\`${literal}\`` : JSON.stringify(literal)
}

function matchingOptions(node: GlobArgument | undefined): string | undefined {
  const options: Record<string, boolean | string> = { eager: true }
  if (node === undefined) return JSON.stringify(options)
  if (node.type !== 'ObjectExpression') return undefined
  for (const property of node.properties) {
    if (property.type !== 'Property' || property.computed || property.kind !== 'init')
      return undefined
    const key =
      property.key.type === 'Identifier' ? property.key.name : literalPattern(property.key)
    if (key === undefined) return undefined
    if (key === 'exhaustive' || key === 'caseSensitive') {
      if (property.value.type !== 'Literal' || typeof property.value.value !== 'boolean') {
        return undefined
      }
      options[key] = property.value.value
    } else if (key === 'base') {
      const base = literalPattern(property.value)
      if (base === undefined) return undefined
      options.base = base
    }
  }
  return JSON.stringify(options)
}

export function readGlobImport(call: GlobCall): GlobRequest | GlobExpansion {
  const argument = call.arguments[0]
  const elements = argument?.type === 'ArrayExpression' ? argument.elements : [argument]
  const options = matchingOptions(call.arguments[1])
  if (call.arguments.length < 1 || call.arguments.length > 2 || options === undefined) {
    return { kind: 'problem', message: 'Glob arguments and matching options must be literal.' }
  }
  const sources: string[] = []
  for (const element of elements) {
    const literal = literalPattern(element)
    const source = literalSource(element)
    if (literal === undefined || source === undefined) {
      return { kind: 'problem', message: 'Every glob pattern must be a string literal.' }
    }
    const path = literal.startsWith('!') ? literal.slice(1) : literal
    if (!path.startsWith('/') && !path.startsWith('./') && !path.startsWith('../')) {
      return { kind: 'problem', message: 'Glob paths must start with /, ./ or ../.' }
    }
    sources.push(source)
  }
  return { kind: 'request', argumentsCode: `[${sources.join(',')}], ${options}` }
}

export function expandGlobImports(
  call: GlobCall,
  importer: string,
  files: readonly string[],
  modes: GlobModes,
): GlobExpansion {
  const request = readGlobImport(call)
  if (request.kind !== 'request') return request
  if (modes.javascript.kind === 'problem') return modes.javascript
  if (modes.native.kind === 'problem') return modes.native
  const owned = new Set(files)
  return {
    kind: 'targets',
    files: [...new Set([...modes.javascript.files, ...modes.native.files])]
      .filter((file) => file !== importer && owned.has(file))
      .sort(),
  }
}
