// The raw-value rules over one declaration value or at-rule prelude. Each
// rule reads the source tokens of the text, so the gate reports what the
// author wrote: a normalized or expanded value would drop and invent the
// literals this gate exists to catch. Hit positions are character offsets
// into the scanned text.
import {
  isFunctionNode,
  isTokenNode,
  parseListOfComponentValues,
  walk,
} from '@csstools/css-parser-algorithms'
import type { ComponentValue, FunctionNode } from '@csstools/css-parser-algorithms'
import {
  isTokenDimension,
  isTokenHash,
  isTokenIdent,
  isTokenNumber,
  isTokenPercentage,
  tokenize,
} from '@csstools/css-tokenizer'
import type { CSSToken } from '@csstools/css-tokenizer'
import { isNamedColor } from './namedColors.ts'

export type RawKind =
  // A dimension with a unit, named by what the unit measures
  | 'length'
  | 'percentage'
  | 'time'
  | 'angle'
  | 'flex'
  | 'frequency'
  | 'resolution'
  // A dimension whose unit carries no dedicated kind
  | 'dimension'
  | 'color'
  | 'easing'

export type RawHit = {
  readonly kind: RawKind
  // The literal as written, a token text or a whole function call
  readonly literal: string
  // Character offset of the literal's first character in the scanned text
  readonly start: number
}

// The units whose dimension kind is named after what they measure. A unit
// outside these lists still fails, as a bare dimension.
const unitKindLists: ReadonlyArray<readonly [RawKind, string]> = [
  [
    'length',
    'px em rem ex ch cap ic lh rlh vw vh vi vb vmin vmax svw svh lvw lvh dvw dvh cqw cqh cqi cqb cqmin cqmax cm mm q in pt pc',
  ],
  ['time', 's ms'],
  ['angle', 'deg grad rad turn'],
  ['flex', 'fr'],
  ['frequency', 'hz khz'],
  ['resolution', 'dpi dpcm dppx x'],
]

const unitKinds: ReadonlyMap<string, RawKind> = new Map(
  unitKindLists.flatMap(([kind, units]) =>
    units.split(' ').map((unit): [string, RawKind] => [unit, kind]),
  ),
)

function dimensionKind(unit: string): RawKind {
  return unitKinds.get(unit.toLowerCase()) ?? 'dimension'
}

// A color function with any literal argument is raw: a color composed only
// of var() references is composed from tokens and passes.
const colorFunctions: ReadonlySet<string> = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'color-mix',
])

// The same for easings. The bare `linear` keyword is no function, so it
// passes; the linear() function takes literal stops and does not.
const easingFunctions: ReadonlySet<string> = new Set(['cubic-bezier', 'steps', 'linear'])

// Every raw literal the text carries, in position order. Tokens carry the
// standalone literals; the component value tree carries the functions with
// their arguments. Both read the same token stream, so a literal inside a
// var() fallback or a calc() is hit like any other.
export function rawValueHits(text: string): RawHit[] {
  const tokens = tokenize({ css: text })
  const hits = [...tokenHits(tokens), ...functionHits(parseListOfComponentValues(tokens), text)]
  return hits.sort((left, right) => left.start - right.start)
}

// A dimension or percentage token with a unit is a design value, unless it
// is zero: zero carries no design choice in any unit. A hash token is a
// color, and an ident that names a CSS color is one. Unitless numbers are
// no literals, and comments are never tokens a rule reads.
function tokenHits(tokens: readonly CSSToken[]): RawHit[] {
  const hits: RawHit[] = []
  for (const token of tokens) {
    if (isTokenDimension(token) && token[4].value !== 0) {
      hits.push({ kind: dimensionKind(token[4].unit), literal: token[1], start: token[2] })
    } else if (isTokenPercentage(token) && token[4].value !== 0) {
      hits.push({ kind: 'percentage', literal: token[1], start: token[2] })
    } else if (isTokenHash(token)) {
      hits.push({ kind: 'color', literal: token[1], start: token[2] })
    } else if (isTokenIdent(token) && isNamedColor(token[4].value)) {
      hits.push({ kind: 'color', literal: token[1], start: token[2] })
    }
  }
  return hits
}

function functionHits(componentValues: ComponentValue[], text: string): RawHit[] {
  const hits: RawHit[] = []
  walk(componentValues, (entry) => {
    if (!isFunctionNode(entry.node)) {
      return
    }
    const kind = functionKind(entry.node)
    if (kind !== undefined) {
      hits.push({
        kind,
        literal: sourceSpan(text, entry.node),
        start: entry.node.name[2],
      })
    }
  })
  return hits
}

// A color or easing function is raw when any argument is a literal: a
// number, a dimension, a percentage, a hash or a named color.
function functionKind(node: FunctionNode): RawKind | undefined {
  const name = node.getName().toLowerCase()
  const isColor = colorFunctions.has(name)
  const isEasing = easingFunctions.has(name)
  if (!isColor && !isEasing) {
    return undefined
  }
  let literal = false
  node.walk((entry) => {
    if (!isTokenNode(entry.node)) {
      return
    }
    const token = entry.node.value
    const isLiteral =
      isTokenNumber(token) ||
      isTokenDimension(token) ||
      isTokenPercentage(token) ||
      isTokenHash(token) ||
      (isTokenIdent(token) && isNamedColor(token[4].value))
    if (isLiteral) {
      literal = true
      return false
    }
  })
  return literal ? (isColor ? 'color' : 'easing') : undefined
}

// Token and function end offsets are inclusive, so the closing parenthesis
// needs the plus one.
function sourceSpan(text: string, node: FunctionNode): string {
  return text.slice(node.name[2], node.endToken[3] + 1)
}
