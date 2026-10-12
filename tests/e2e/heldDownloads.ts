// A controllable byte stream for the downloads a load waits on: the
// environment map and the model. Init scripts wrap the page's fetch for the
// named paths only, read the real bytes with the original fetch, and serve
// them again as one streaming response whose slices the test releases by
// path. The wrapper carries the request's signal, so a cancelled read ahead
// errors its stream exactly as the network would, and the page cannot tell
// the held response from a slow connection except by its pace. The response
// either names the whole size in Content-Length, or names nothing, which is
// the unknown-total case.

import type { Page } from '@playwright/test'

export type HeldDownloadState = {
  readonly path: string
  readonly delivered: number
  readonly of: number
}

export type HeldDownloads = {
  // Whether every named path has been fetched for real and is held.
  readonly allHeld: () => Promise<boolean>
  // The held state of every held path, in hold order.
  readonly state: () => Promise<readonly HeldDownloadState[]>
  // Releases the next count slices of every held path, and answers the state
  // after the release.
  readonly release: (count: number) => Promise<readonly HeldDownloadState[]>
  // Releases every remaining slice of every held path.
  readonly releaseAll: () => Promise<void>
}

// How many slices a held download is cut into: enough that a readout's
// figure climbs through several whole percents between releases.
const SLICE_COUNT = 8

// One held download on the page: its slices, how many were delivered, the
// stream controller the releases enqueue into, and whether it closed.
export type HeldEntry = {
  delivered: number
  readonly slices: readonly Uint8Array[]
  controller: ReadableStreamDefaultController<Uint8Array> | null
  closed: boolean
}

// The slot the test drives the holds through, in the page itself.
declare global {
  interface Window {
    __heldDownloads?: {
      state(): HeldDownloadState[]
      release(path: string, count: number): void
    }
    __heldStreamOf?: (entry: HeldEntry, signal: AbortSignal | null) => ReadableStream<Uint8Array>
    __heldSlotOf?: (held: Map<string, HeldEntry>) => void
  }
}

// Defines the page's stream factory: a stream that produces nothing until
// the slot releases its slices, and errors the moment the request's signal
// aborts.
export function installHeldStreamFactory(): void {
  window.__heldStreamOf = (entry, signal) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        entry.controller = controller
        if (signal === null) {
          return
        }
        const onAbort = () => {
          if (!entry.closed) {
            entry.closed = true
            controller.error(signal.reason)
          }
        }
        if (signal.aborted) {
          onAbort()
        } else {
          signal.addEventListener('abort', onAbort, { once: true })
        }
      },
    })
}

// Defines the page's slot factory: the state the test reads and the release
// the test drives, over the holds the fetch wrapper records.
export function installHeldSlotFactory(): void {
  window.__heldSlotOf = (held) => {
    window.__heldDownloads = {
      state() {
        return [...held.entries()].map(([path, entry]) => ({
          path,
          delivered: entry.delivered,
          of: entry.slices.length,
        }))
      },
      release(path, count) {
        const entry = held.get(path)
        if (entry === undefined) {
          return
        }
        for (let i = 0; i < count; i += 1) {
          const slice = entry.slices[entry.delivered]
          if (slice === undefined) {
            break
          }
          entry.controller?.enqueue(slice)
          entry.delivered += 1
        }
        if (entry.delivered === entry.slices.length && !entry.closed) {
          entry.closed = true
          entry.controller?.close()
        }
      },
    }
  }
}

// Installs the wrapped fetch: the real bytes first, with the request's own
// init, then the held stream in their place, naming the whole size or
// nothing.
export function installHeldFetch(options: {
  readonly paths: readonly string[]
  readonly slices: number
  readonly withLength: boolean
}): void {
  const { paths, slices, withLength } = options
  const originalFetch = window.fetch.bind(window)
  const held = new Map<string, HeldEntry>()
  window.__heldSlotOf?.(held)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' || input instanceof URL
        ? new URL(input, location.origin)
        : new URL(input.url, location.origin)
    if (!paths.includes(url.pathname)) {
      return originalFetch(input, init)
    }
    const response = await originalFetch(input, init)
    if (!response.ok) {
      return response
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const sliceSize = Math.ceil(bytes.byteLength / slices)
    const parts: Uint8Array[] = []
    for (let at = 0; at < bytes.byteLength; at += sliceSize) {
      parts.push(bytes.slice(at, Math.min(at + sliceSize, bytes.byteLength)))
    }
    const entry: HeldEntry = { delivered: 0, slices: parts, controller: null, closed: false }
    held.set(url.pathname, entry)
    return new Response(window.__heldStreamOf?.(entry, init?.signal ?? null), {
      status: response.status,
      statusText: response.statusText,
      headers: withLength
        ? {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(bytes.byteLength),
          }
        : { 'Content-Type': 'application/octet-stream' },
    })
  }
}

export async function holdDownloads(
  page: Page,
  paths: readonly string[],
  { contentLength = true }: { readonly contentLength?: boolean } = {},
): Promise<HeldDownloads> {
  await page.addInitScript(installHeldStreamFactory)
  await page.addInitScript(installHeldSlotFactory)
  await page.addInitScript(installHeldFetch, {
    paths,
    slices: SLICE_COUNT,
    withLength: contentLength,
  })
  const state = async (): Promise<readonly HeldDownloadState[]> =>
    page.evaluate(() => window.__heldDownloads?.state() ?? [])
  return {
    async allHeld() {
      const current = await state()
      return (
        current.length === paths.length &&
        paths.every((path) => current.some((entry) => entry.path === path && entry.of > 0))
      )
    },
    state,
    async release(count) {
      await page.evaluate((release) => {
        const slot = window.__heldDownloads
        if (slot === undefined) {
          throw new Error('the held downloads slot is not installed')
        }
        for (const { path } of slot.state()) {
          slot.release(path, release)
        }
      }, count)
      return state()
    },
    async releaseAll() {
      await page.evaluate(() => {
        const slot = window.__heldDownloads
        if (slot === undefined) {
          throw new Error('the held downloads slot is not installed')
        }
        for (const { path, of } of slot.state()) {
          slot.release(path, of)
        }
      })
    },
  }
}
