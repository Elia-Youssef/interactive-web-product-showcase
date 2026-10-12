import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { withOwnedSetupPage } from './ownedSetupPage'

function setup() {
  const page = Object.assign(new EventEmitter(), {
    closed: false,
    async close() {
      this.closed = true
    },
  })
  return {
    page,
    browser: {
      async newPage() {
        return page
      },
    },
  }
}

it('closes if attaching the setup observers fails before navigation', async () => {
  const { page, browser } = setup()
  const cause = new Error('observer attachment failed')
  const read = vi.fn(async () => 'eligible')
  vi.spyOn(page, 'on').mockImplementation(() => {
    throw cause
  })
  await expect(withOwnedSetupPage(browser, read)).rejects.toBe(cause)
  expect(page.closed).toBe(true)
  expect(read).not.toHaveBeenCalled()
})

it('observes a navigation error before the setup callback and closes on its verdict', async () => {
  const { page, browser } = setup()
  await expect(
    withOwnedSetupPage(browser, async (owned) => {
      owned.emit('pageerror', new Error('setup navigation failed'))
      return 'eligible'
    }),
  ).rejects.toThrow('setup page error gate: page error: Error: setup navigation failed')
  expect(page.closed).toBe(true)
  expect(page.listenerCount('pageerror')).toBe(0)
})

it('closes on a synchronous setup failure and removes its observers', async () => {
  const { page, browser } = setup()
  const cause = new Error('selection failed')
  await expect(
    withOwnedSetupPage(browser, () => {
      throw cause
    }),
  ).rejects.toBe(cause)
  expect(page.closed).toBe(true)
  expect(page.listenerCount('console')).toBe(0)
})

it('drains received console arguments while the setup page is still open', async () => {
  const { page, browser } = setup()
  let finish: (value: string) => void = () => undefined
  const argument = new Promise<string>((resolve) => {
    finish = resolve
  })
  const detach = page.off.bind(page)
  const stopping = new Promise<void>((resolve) => {
    vi.spyOn(page, 'off').mockImplementation((event, listener) => {
      const detached = detach(event, listener)
      if (event === 'pageerror') resolve()
      return detached
    })
  })
  const result = withOwnedSetupPage(browser, async (owned) => {
    owned.emit('console', {
      type: () => 'error',
      text: () => 'engine text',
      args: () => [{ evaluate: (render: (value: unknown) => string) => argument.then(render) }],
    })
    return 'eligible'
  })
  const verdict = expect(result).rejects.toThrow(
    'setup page error gate: console error: decoded setup error',
  )
  try {
    await stopping
    expect(page.closed).toBe(false)
  } finally {
    finish('decoded setup error')
    await verdict
  }
  expect(page.closed).toBe(true)
})
