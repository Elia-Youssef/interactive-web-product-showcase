// The rows for the color rules and the easing rules: hash literals, named
// colors, color functions over their arguments, and easing functions.
// Failing and passing rows sit next to each other, so a rule cannot learn
// to pass everything.
import type { Row } from './styleValueRows.ts'

export const colorValueRows: readonly Row[] = [
  {
    title: 'a hash value is raw',
    css: '  color: #fff;\n',
    expected: [{ line: 1, column: 10, property: 'color', kind: 'color', literal: '#fff' }],
  },
  {
    title: 'a hash in a selector is no color, a named color in a value is',
    css: '#root {\n  color: red;\n}\n',
    expected: [{ line: 2, column: 10, property: 'color', kind: 'color', literal: 'red' }],
  },
  {
    title: 'transparent and currentcolor are no color literals',
    css: '  color: transparent;\n  border-color: currentcolor;\n',
    expected: [],
  },
  {
    title: 'a color function composed only of var references passes',
    css: '  background-image: linear-gradient(\n    rgb(var(--white-rgb) / var(--backdrop-grid-alpha)) var(--backdrop-grid-line),\n    transparent var(--backdrop-grid-line)\n  );\n',
    expected: [],
  },
  {
    title: 'a color function with literals is raw, as a whole',
    css: '  background-color: rgb(16 18 18);\n',
    expected: [
      {
        line: 1,
        column: 21,
        property: 'background-color',
        kind: 'color',
        literal: 'rgb(16 18 18)',
      },
    ],
  },
  {
    title: 'a color function reports its function and its own literals',
    css: '  background-color: hsl(120deg 100% 50%);\n',
    expected: [
      {
        line: 1,
        column: 21,
        property: 'background-color',
        kind: 'color',
        literal: 'hsl(120deg 100% 50%)',
      },
      {
        line: 1,
        column: 25,
        property: 'background-color',
        kind: 'angle',
        literal: '120deg',
      },
      {
        line: 1,
        column: 32,
        property: 'background-color',
        kind: 'percentage',
        literal: '100%',
      },
      {
        line: 1,
        column: 37,
        property: 'background-color',
        kind: 'percentage',
        literal: '50%',
      },
    ],
  },
  {
    title: 'a color mix of var references passes',
    css: '  background-color: color-mix(in oklab, var(--a), var(--b));\n',
    expected: [],
  },
  {
    title: 'a color mix with a literal share is raw',
    css: '  background-color: color-mix(in srgb, var(--a) 50%, var(--b));\n',
    expected: [
      {
        line: 1,
        column: 21,
        property: 'background-color',
        kind: 'color',
        literal: 'color-mix(in srgb, var(--a) 50%, var(--b))',
      },
      {
        line: 1,
        column: 49,
        property: 'background-color',
        kind: 'percentage',
        literal: '50%',
      },
    ],
  },
  {
    title: 'a hash in a var fallback is raw',
    css: '  color: var(--x, #fff);\n',
    expected: [{ line: 1, column: 19, property: 'color', kind: 'color', literal: '#fff' }],
  },
  {
    title: 'a color literal next to a var reference is raw',
    css: '  border-color: var(--hairline) #fff;\n',
    expected: [{ line: 1, column: 33, property: 'border-color', kind: 'color', literal: '#fff' }],
  },
  {
    title: 'important does not hide the literal',
    css: '  color: red !important;\n',
    expected: [{ line: 1, column: 10, property: 'color', kind: 'color', literal: 'red' }],
  },
  {
    title: 'a hash inside a url is no color literal',
    css: '  mask: url(#frame);\n',
    expected: [],
  },
  {
    title: 'a cubic bezier easing is raw',
    css: '  transition-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);\n',
    expected: [
      {
        line: 1,
        column: 31,
        property: 'transition-timing-function',
        kind: 'easing',
        literal: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
      },
    ],
  },
  {
    title: 'a steps easing is raw',
    css: '  transition-timing-function: steps(4, jump-none);\n',
    expected: [
      {
        line: 1,
        column: 31,
        property: 'transition-timing-function',
        kind: 'easing',
        literal: 'steps(4, jump-none)',
      },
    ],
  },
  {
    title: 'the linear keyword is no easing function',
    css: '  transition-timing-function: linear;\n',
    expected: [],
  },
  {
    title: 'the linear function with stops is raw',
    css: '  transition-timing-function: linear(0, 0.5, 1);\n',
    expected: [
      {
        line: 1,
        column: 31,
        property: 'transition-timing-function',
        kind: 'easing',
        literal: 'linear(0, 0.5, 1)',
      },
    ],
  },
  {
    title: 'an easing over var references passes',
    css: '  transition-timing-function: cubic-bezier(var(--a), var(--b), var(--c), var(--d));\n',
    expected: [],
  },
]
