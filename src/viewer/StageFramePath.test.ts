import { describe, expect, it, vi } from 'vitest'
import { StageFramePath } from './StageFramePath'

function framePath() {
  const resume = vi.fn<() => void>()
  const retired = vi.fn<() => void>()
  return { path: new StageFramePath({ invalidate: resume, retired }), resume, retired }
}

const fault = new Error('the frame broke')

function throwing(): never {
  throw fault
}

describe('StageFramePath', () => {
  it('runs every step while nothing has failed', () => {
    const { path } = framePath()
    path.own('stage', vi.fn())
    const step = vi.fn()

    expect(path.run('content', step)).toBe(true)
    expect(path.run('content', step)).toBe(true)
    expect(step).toHaveBeenCalledTimes(2)
  })

  it('reports a throwing step to the content owner once, with the error it threw', () => {
    const { path } = framePath()
    const stage = vi.fn()
    const product = vi.fn()
    path.own('stage', stage)
    path.own('content', product)

    expect(path.run('content', throwing)).toBe(false)
    expect(path.run('content', throwing)).toBe(false)

    expect(product).toHaveBeenCalledOnce()
    expect(product).toHaveBeenCalledWith(fault)
    expect(stage).not.toHaveBeenCalled()
  })

  it('lets the content scope win whatever order the owners registered in', () => {
    const { path } = framePath()
    const stage = vi.fn()
    const product = vi.fn()
    // A child's effects run before its parent's, so the product registers
    // first.
    path.own('content', product)
    path.own('stage', stage)

    path.run('content', throwing)

    expect(product).toHaveBeenCalledOnce()
    expect(stage).not.toHaveBeenCalled()
  })

  it('carries a thrown value that is not an Error as an Error', () => {
    const { path } = framePath()
    const owner = vi.fn<(error: Error) => void>()
    path.own('stage', owner)

    path.run('content', () => {
      throw 'a string'
    })

    expect(owner.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    expect(owner.mock.calls[0]?.[0]?.message).toBe('a string')
  })

  it('stops presenting after a failure: no later step runs while halted', () => {
    const { path } = framePath()
    path.own('stage', vi.fn())
    const later = vi.fn()

    path.run('content', throwing)

    expect(path.run('content', later)).toBe(false)
    expect(later).not.toHaveBeenCalled()
  })

  it('presents again once the failed owner lets go, and asks for the frame that shows it', () => {
    const { path, resume } = framePath()
    path.own('stage', vi.fn())
    const releaseProduct = path.own('content', vi.fn())
    const later = vi.fn()

    path.run('content', throwing)
    expect(resume).not.toHaveBeenCalled()
    releaseProduct()

    expect(resume).toHaveBeenCalledOnce()
    expect(path.run('content', later)).toBe(true)
    expect(later).toHaveBeenCalledOnce()
  })

  it('reports a failure after the product left to the stage owner', () => {
    const { path } = framePath()
    const stage = vi.fn()
    path.own('stage', stage)
    const product = vi.fn()
    const releaseProduct = path.own('content', product)

    path.run('content', throwing)
    releaseProduct()
    path.run('content', throwing)

    expect(product).toHaveBeenCalledOnce()
    expect(stage).toHaveBeenCalledOnce()
  })

  it('stays halted when an owner other than the failed one lets go', () => {
    const { path, resume } = framePath()
    const releaseStage = path.own('stage', vi.fn())
    path.own('content', vi.fn())

    path.run('content', throwing)
    releaseStage()

    expect(resume).not.toHaveBeenCalled()
    expect(path.run('content', vi.fn())).toBe(false)
  })

  it('binds a release to its own registration, so it resumes once and frees the scope', () => {
    const { path, resume } = framePath()
    const releaseProduct = path.own('content', vi.fn())

    path.run('content', throwing)
    releaseProduct()
    releaseProduct()

    expect(resume).toHaveBeenCalledOnce()
    expect(() => path.own('content', vi.fn())).not.toThrow()
  })

  it('fails loudly on a second owner for a scope that already has one', () => {
    const { path } = framePath()
    path.own('content', vi.fn())

    expect(() => path.own('content', vi.fn())).toThrow(/already have an owner/)
  })

  it('rethrows a failure no owner is registered for, so it is never swallowed', () => {
    const { path } = framePath()

    expect(() => path.run('content', throwing)).toThrow(fault)
  })

  it('retires the path for good when the present throws, and tells the stage once', () => {
    const { path, resume, retired } = framePath()
    const product = vi.fn()
    const releaseProduct = path.own('content', product)

    expect(path.present(throwing)).toBe(false)
    expect(path.present(vi.fn())).toBe(false)
    releaseProduct()

    expect(product).toHaveBeenCalledOnce()
    expect(product).toHaveBeenCalledWith(fault)
    expect(retired).toHaveBeenCalledOnce()
    expect(resume).not.toHaveBeenCalled()
    expect(path.run('content', vi.fn())).toBe(false)
    expect(path.present(vi.fn())).toBe(false)
  })

  it('tells the stage nothing for a content step that throws, which only halts', () => {
    const { path, retired } = framePath()
    path.own('content', vi.fn())

    path.run('content', throwing)

    expect(retired).not.toHaveBeenCalled()
    expect(path.present(vi.fn())).toBe(false)
  })

  it('owes a new listener one frame and fails loudly on a stale release', () => {
    const { path, resume } = framePath()
    const release = path.listen('content', vi.fn())

    expect(resume).toHaveBeenCalledOnce()
    release()
    expect(release).toThrow(/stale/)
  })

  it('reports a step to the owner of the scope it names: stage code fails the stage under a presented product', () => {
    const { path } = framePath()
    const stage = vi.fn()
    const product = vi.fn()
    path.own('stage', stage)
    path.own('content', product)

    expect(path.run('stage', throwing)).toBe(false)

    expect(stage).toHaveBeenCalledOnce()
    expect(stage).toHaveBeenCalledWith(fault)
    expect(product).not.toHaveBeenCalled()
  })

  it('hands a failure of a scope with no owner to the broader scope', () => {
    const { path } = framePath()
    const stage = vi.fn()
    path.own('stage', stage)

    path.run('content', throwing)

    expect(stage).toHaveBeenCalledOnce()
  })

  it('reports the present to the narrowest owned scope, which cannot tell whose object threw', () => {
    const { path } = framePath()
    const stage = vi.fn()
    const product = vi.fn()
    path.own('stage', stage)
    path.own('content', product)

    path.present(throwing)

    expect(product).toHaveBeenCalledOnce()
    expect(stage).not.toHaveBeenCalled()
  })

  it('runs a listener as code of its own scope', () => {
    const { path } = framePath()
    const stage = vi.fn()
    const product = vi.fn()
    path.own('stage', stage)
    path.own('content', product)
    path.listen('stage', throwing)

    path.runListeners()

    expect(stage).toHaveBeenCalledOnce()
    expect(product).not.toHaveBeenCalled()
  })

  it('tells its retirement subscribers once, and a halt tells them nothing', () => {
    const { path } = framePath()
    path.own('stage', vi.fn())
    const subscriber = vi.fn()
    const unsubscribe = path.subscribeRetirement(subscriber)

    path.run('content', throwing)
    expect(subscriber).not.toHaveBeenCalled()
    expect(path.isRetired).toBe(false)

    const fresh = framePath()
    fresh.path.own('stage', vi.fn())
    const freshSubscriber = vi.fn()
    fresh.path.subscribeRetirement(freshSubscriber)
    fresh.path.present(throwing)
    fresh.path.present(throwing)
    expect(freshSubscriber).toHaveBeenCalledOnce()
    expect(fresh.path.isRetired).toBe(true)
    unsubscribe()
  })

  it('stops telling a retirement subscriber that unsubscribed', () => {
    const { path } = framePath()
    path.own('stage', vi.fn())
    const subscriber = vi.fn()
    path.subscribeRetirement(subscriber)()

    path.present(throwing)

    expect(subscriber).not.toHaveBeenCalled()
  })
})
