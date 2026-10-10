import { describe, expect, it } from 'vitest'
import type { ByteProgress } from './loadLedger'
import { readWithProgress } from './readWithProgress'

// The stream reader of one transfer's bytes, over streams the test builds:
// the event sequence follows the chunks, an unknown total passes through as
// null, and an abort mid-stream rejects with the signal's own reason and
// reports nothing after it.

function tracker(): {
  readonly readings: readonly ByteProgress[]
  readonly record: (reading: ByteProgress) => void
} {
  const readings: ByteProgress[] = []
  return { readings, record: (reading) => readings.push({ ...reading }) }
}

describe('readWithProgress', () => {
  it('reports the bytes read so far with each chunk and answers the whole buffer', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.enqueue(new Uint8Array([4, 5]))
        controller.close()
      },
    })
    const { readings, record } = tracker()

    const bytes = await readWithProgress(stream, 5, record, undefined)

    expect(bytes.byteLength).toBe(5)
    expect([...new Uint8Array(bytes)]).toEqual([1, 2, 3, 4, 5])
    expect(readings).toEqual([
      { loaded: 3, total: 5 },
      { loaded: 5, total: 5 },
    ])
  })

  it('carries an unknown total through as null', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      },
    })
    const { readings, record } = tracker()

    await readWithProgress(stream, null, record, undefined)

    expect(readings).toEqual([{ loaded: 1, total: null }])
  })

  it('answers an empty buffer for a body that is already closed', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })
    const { readings, record } = tracker()

    const bytes = await readWithProgress(stream, 0, record, undefined)

    expect(bytes.byteLength).toBe(0)
    expect(readings).toEqual([])
  })

  it('rejects mid-stream with the signal reason and reports nothing after it', async () => {
    const reason = new Error('the read ahead is cancelled')
    const cancel = new AbortController()
    let openGate: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        await gate
        controller.enqueue(new Uint8Array([3, 4]))
        controller.close()
      },
    })
    const { readings, record } = tracker()
    const reading = readWithProgress(stream, 4, record, cancel.signal)
    // Let the first chunk travel through the stream and its report land.
    for (let depth = 0; depth < 20 && readings.length < 1; depth += 1) {
      await Promise.resolve()
    }
    expect(readings).toEqual([{ loaded: 2, total: 4 }])

    cancel.abort(reason)
    await expect(reading).rejects.toBe(reason)

    openGate()
    for (let depth = 0; depth < 20; depth += 1) {
      await Promise.resolve()
    }
    expect(readings).toEqual([{ loaded: 2, total: 4 }])
  })

  it('cancels the source with the signal reason when the read aborts mid-stream', async () => {
    const reason = new Error('the read ahead is cancelled')
    const cancel = new AbortController()
    const cancelled: unknown[] = []
    const gate = new Promise<void>(() => undefined)
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        await gate
        controller.enqueue(new Uint8Array([3, 4]))
        controller.close()
      },
      cancel(cause) {
        cancelled.push(cause)
      },
    })
    const { readings, record } = tracker()
    const reading = readWithProgress(stream, 4, record, cancel.signal)
    for (let depth = 0; depth < 20 && readings.length < 1; depth += 1) {
      await Promise.resolve()
    }

    cancel.abort(reason)
    await expect(reading).rejects.toBe(reason)
    expect(cancelled).toEqual([reason])
  })

  it('cancels the source with the error a report throws', async () => {
    const thrown = new Error('the reporter is gone')
    const cancelled: unknown[] = []
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
      },
      cancel(cause) {
        cancelled.push(cause)
      },
    })
    const reading = readWithProgress(
      stream,
      1,
      () => {
        throw thrown
      },
      undefined,
    )

    await expect(reading).rejects.toBe(thrown)
    expect(cancelled).toEqual([thrown])
  })

  it('rejects at once when the signal has already aborted', async () => {
    const reason = new Error('gone')
    const cancel = new AbortController()
    cancel.abort(reason)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      },
    })
    const { readings, record } = tracker()

    await expect(readWithProgress(stream, 1, record, cancel.signal)).rejects.toBe(reason)
    expect(readings).toEqual([])
  })
})
