import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { findRawValues } from './styleRawValues.ts'

const file = 'src/ui/RaMark.module.css'
const css = readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8')

test('the mark uses one ring mask, token tints and scaled token glows', () => {
  expect(css.match(/url\(/g)).toHaveLength(1)
  expect(css).toContain("url('/brand/ra-ring.png')")
  expect(css).toContain('background-color: var(--white)')
  expect(css).toContain('background-color: var(--red)')
  expect(css).toContain('fill: var(--white)')
  expect(findRawValues(file, css)).toEqual([])
})

test('a hard coded sweep tint is rejected by the unchanged stylesheet gate', () => {
  const broken = css.replace('background-color: var(--red)', 'background-color: #de0b00')
  expect(broken).not.toBe(css)
  expect(findRawValues(file, broken)).toContainEqual(
    expect.objectContaining({ kind: 'color', literal: '#de0b00' }),
  )
})
