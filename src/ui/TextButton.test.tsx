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

test('an unavailable TextButton announces the wait and stays focusable', () => {
  const html = renderToString(<TextButton unavailable>See inside</TextButton>)

  expect(html).toContain('aria-disabled="true"')
  expect(html).not.toMatch(/\sdisabled[=\s/>]/)
})

test('an available TextButton carries no announced wait', () => {
  const html = renderToString(<TextButton>See inside</TextButton>)

  expect(html).not.toContain('aria-disabled')
})

test('an unavailable TextButton ignores activation, an available one answers it', () => {
  const press = () => {}

  const waiting = TextButton({ children: 'See inside', unavailable: true, onClick: press })
  expect(waiting.props.onClick).toBeUndefined()

  const available = TextButton({ children: 'See inside', onClick: press })
  expect(available.props.onClick).toBe(press)
})
