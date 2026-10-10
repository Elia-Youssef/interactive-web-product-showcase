// Reads a response body stream into one buffer, reporting the bytes read so
// far and the transfer's known total as the chunks arrive. Pure stream
// plumbing, no timers: the caller owns the pace and the total. A signal that
// aborts mid-stream wins the race with the next chunk, rejects with the
// signal's own reason, and no report follows the rejection. Whatever ends
// the read early, an abort, a stream error or a reporting throw, cancels the
// reader with the cause so the source learns its bytes are no longer read.

import type { ByteProgress } from './loadLedger'

export async function readWithProgress(
  body: ReadableStream<Uint8Array>,
  total: number | null,
  onProgress: (reading: ByteProgress) => void,
  signal: AbortSignal | undefined,
): Promise<ArrayBuffer> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason)
  }
  const reader = body.getReader()
  const parts: Uint8Array[] = []
  let loaded = 0
  let detachAbort: () => void = () => undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    if (signal === undefined) {
      return
    }
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    detachAbort = () => signal.removeEventListener('abort', onAbort)
  })
  try {
    for (;;) {
      // The abort rides first, so a signal that fired before this read
      // settled wins even against a chunk that was already queued.
      const step = await Promise.race([aborted, reader.read()])
      if (step.done) {
        break
      }
      const chunk = step.value
      parts.push(chunk)
      loaded += chunk.byteLength
      onProgress({ loaded, total })
    }
  } catch (cause) {
    await reader.cancel(cause)
    throw cause
  } finally {
    detachAbort()
    reader.releaseLock()
  }
  const whole = new Uint8Array(loaded)
  let at = 0
  for (const part of parts) {
    whole.set(part, at)
    at += part.byteLength
  }
  return whole.buffer
}
