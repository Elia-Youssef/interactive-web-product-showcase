// The rows for the rules over sizes, durations, angles and flex fractions,
// and over the at-rule preludes that state conditions. Failing and passing
// rows sit next to each other, so a rule cannot learn to pass everything.
import type { Row } from './styleValueRows.ts'
import { tokenSourcePath } from './tokenSource.ts'

export const sizeValueRows: readonly Row[] = [
  {
    title: 'a dimension length is raw',
    css: '  padding: 12px;\n',
    expected: [{ line: 1, column: 12, property: 'padding', kind: 'length', literal: '12px' }],
  },
  {
    title: 'a duration is raw',
    css: '  transition-duration: 250ms;\n',
    expected: [
      { line: 1, column: 24, property: 'transition-duration', kind: 'time', literal: '250ms' },
    ],
  },
  {
    title: 'a percentage is raw',
    css: '  inline-size: 50%;\n',
    expected: [
      { line: 1, column: 16, property: 'inline-size', kind: 'percentage', literal: '50%' },
    ],
  },
  {
    title: 'an angle is raw',
    css: '  rotate: 90deg;\n',
    expected: [{ line: 1, column: 11, property: 'rotate', kind: 'angle', literal: '90deg' }],
  },
  {
    title: 'flex fractions are raw, each at its own column',
    css: '  grid-template-columns: 1fr 2fr;\n',
    expected: [
      { line: 1, column: 26, property: 'grid-template-columns', kind: 'flex', literal: '1fr' },
      { line: 1, column: 30, property: 'grid-template-columns', kind: 'flex', literal: '2fr' },
    ],
  },
  {
    title: 'a value composed of var references passes',
    css: '  color: var(--off);\n  inline-size: var(--size-fill);\n',
    expected: [],
  },
  {
    title: 'a calc with a literal is raw',
    css: '  inline-size: calc(100% - var(--panel-width-min));\n',
    expected: [
      { line: 1, column: 21, property: 'inline-size', kind: 'percentage', literal: '100%' },
    ],
  },
  {
    title: 'a calc over var references passes',
    css: '  border-radius: calc(var(--size-sheet-handle-height) / 2);\n',
    expected: [],
  },
  {
    title: 'a var fallback is part of the value',
    css: '  inset-block-start: var(--x, 8px);\n',
    expected: [
      { line: 1, column: 31, property: 'inset-block-start', kind: 'length', literal: '8px' },
    ],
  },
  {
    title: 'a custom property definition is checked',
    css: ':root {\n  --lift: 4px;\n  --shadow: var(--x);\n}\n',
    expected: [{ line: 2, column: 11, property: '--lift', kind: 'length', literal: '4px' }],
  },
  {
    title: 'a media query with pixels is raw, the custom media name passes',
    css: '@media (min-width: 600px) {\n  .a { color: var(--off); }\n}\n\n@media (--vp-phone) {\n  .b { color: var(--off); }\n}\n',
    expected: [{ line: 1, column: 20, property: '@media', kind: 'length', literal: '600px' }],
  },
  {
    title: 'a container query with pixels is raw',
    css: '@container (min-width: 600px) {\n  .a { color: var(--off); }\n}\n',
    expected: [{ line: 1, column: 24, property: '@container', kind: 'length', literal: '600px' }],
  },
  {
    title: 'a supports query with a value is raw',
    css: '@supports (padding: 4px) {\n  .a { color: var(--off); }\n}\n',
    expected: [{ line: 1, column: 21, property: '@supports', kind: 'length', literal: '4px' }],
  },
  {
    title: 'a custom media definition outside the tokens is raw',
    css: '@custom-media --vp-probe (min-width: 600px);\n',
    expected: [
      { line: 1, column: 38, property: '@custom-media', kind: 'length', literal: '600px' },
    ],
  },
  {
    title: 'preludes that only name things pass',
    css: "@import '../styles/tokens.css';\n@keyframes fade-in {\n  from { opacity: 0; }\n}\n@layer base;\n",
    expected: [],
  },
  {
    title: 'a shorthand reports each literal once, at its own column',
    css: '  padding: 12px 8px 4px 2px;\n',
    expected: [
      { line: 1, column: 12, property: 'padding', kind: 'length', literal: '12px' },
      { line: 1, column: 17, property: 'padding', kind: 'length', literal: '8px' },
      { line: 1, column: 21, property: 'padding', kind: 'length', literal: '4px' },
      { line: 1, column: 25, property: 'padding', kind: 'length', literal: '2px' },
    ],
  },
  {
    title: 'zero carries no design choice in any unit',
    css: '  margin: 0 0px 0% 0s 0deg 0fr;\n',
    expected: [],
  },
  {
    title: 'literals inside comments never count',
    css: '/* 12px #fff red 90deg */\n.a {\n  color: var(--off); /* 8px */\n}\n',
    expected: [],
  },
  {
    title: 'the token source is exempt by its constant',
    path: tokenSourcePath,
    css: ':root {\n  --x: 12px;\n}\n@media (min-width: 600px) {}\n',
    expected: [],
  },
  {
    title: 'unitless numbers are no literals',
    css: '  flex: 1;\n  opacity: 0.5;\n  line-height: 0.95;\n  font-weight: 800;\n  z-index: 2;\n',
    expected: [],
  },
]
