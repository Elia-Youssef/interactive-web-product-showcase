import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TextButton } from './TextButton'

test('TextButton renders a native button of type button', () => {
  const html = renderToString(<TextButton>Reset</TextButton>)

  expect(html).toMatch(/^<button\b/)
  expect(html).toContain('type="button"')
})

test('TextButton renders the caller label as given', () => {
  const html = renderToString(<TextButton>See inside</TextButton>)

  expect(html).toContain('See inside')
})

test('A plain TextButton is an action, so it announces no pressed state', () => {
  const html = renderToString(<TextButton>Reset</TextButton>)

  expect(html).not.toContain('aria-pressed')
})

test('TextButton with selected={false} reports not pressed', () => {
  const html = renderToString(<TextButton selected={false}>See inside</TextButton>)

  expect(html).toContain('aria-pressed="false"')
})

test('TextButton with selected reports pressed', () => {
  const html = renderToString(<TextButton selected>See inside</TextButton>)

  expect(html).toContain('aria-pressed="true"')
})

test('TextButton with selected="mixed" reports a mixed pressed state', () => {
  const html = renderToString(<TextButton selected="mixed">See inside</TextButton>)

  expect(html).toContain('aria-pressed="mixed"')
})
