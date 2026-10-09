// The dev server's fixture model middleware over a temp repo root: a
// fixture slug is answered with its model's bytes, a shipped slug falls
// through, a fixture without its model is a named 404, and every failure
// (a lookup that rejects, a file that fails to open) reaches next as the
// request's error instead of being dropped.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { fixtureModelsMiddleware, sendModel, type Next } from './devFixtureModels.ts'

// A response that records its status line and collects its body.
class RecordingResponse extends PassThrough {
  status: number | null = null
  readonly chunks: Buffer[] = []

  constructor() {
    super()
    this.on('data', (chunk: Buffer) => this.chunks.push(chunk))
  }

  writeHead(status: number): this {
    this.status = status
    return this
  }

  body(): string {
    return Buffer.concat(this.chunks).toString('utf8')
  }
}

// Runs one request and resolves with what the middleware did with it: the
// response finished, or next called with or without an error.
function run(
  root: string,
  url: string,
): Promise<{ readonly res: RecordingResponse; readonly next: 'none' | 'called' | unknown }> {
  const res = new RecordingResponse()
  return new Promise((resolve) => {
    res.on('finish', () => resolve({ res, next: 'none' }))
    fixtureModelsMiddleware(root)({ url }, res, (error?: unknown) =>
      resolve({ res, next: error === undefined ? 'called' : error }),
    )
  })
}

let root = ''

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function rootWith(fixtures: Readonly<Record<string, string | null>>): Promise<string> {
  root = await mkdtemp(path.join(tmpdir(), 'dev-fixture-models-'))
  for (const [slug, model] of Object.entries(fixtures)) {
    const dir = path.join(root, 'tests', 'fixtures', 'products', slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${slug}.fixtures.ts`), 'export const manifest = {}\n')
    if (model !== null) {
      await writeFile(path.join(dir, 'model.glb'), model)
    }
  }
  return root
}

describe('the fixture model middleware', () => {
  it('answers a fixture slug with its model bytes', async () => {
    const { res, next } = await run(
      await rootWith({ 'fixture-speaker': 'glb bytes' }),
      '/models/fixture-speaker/model.glb',
    )
    expect(next).toBe('none')
    expect(res.status).toBe(200)
    expect(res.body()).toBe('glb bytes')
  })

  it('passes a shipped slug and any other URL on to the server', async () => {
    const fixtureRoot = await rootWith({ 'fixture-speaker': 'glb bytes' })
    expect((await run(fixtureRoot, '/models/forma-one/model.glb')).next).toBe('called')
    expect((await run(fixtureRoot, '/index.html')).next).toBe('called')
  })

  it('answers a fixture slug without its model with a named 404', async () => {
    const { res, next } = await run(
      await rootWith({ 'fixture-speaker': null }),
      '/models/fixture-speaker/model.glb',
    )
    expect(next).toBe('none')
    expect(res.status).toBe(404)
    expect(res.body()).toMatch(/^no fixture product 'fixture-speaker' under /)
  })

  it('hands a lookup that rejects to next as the error', async () => {
    // A root no file system call accepts: the lookup's stat fails with an
    // error that is no missing file, so the lookup rejects.
    root = await mkdtemp(path.join(tmpdir(), 'dev-fixture-models-'))
    const { next } = await run(`${root}\0`, '/models/fixture-speaker/model.glb')
    expect(next).toMatchObject({ code: 'ERR_INVALID_ARG_VALUE' })
  })

  it('hands a model file that fails to open to next, before any status line', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'dev-fixture-models-'))
    const res = new RecordingResponse()
    const error = await new Promise<unknown>((resolve) => {
      const next: Next = (failure) => resolve(failure)
      sendModel(res, path.join(root, 'missing.glb'), next)
    })
    expect(error).toMatchObject({ code: 'ENOENT' })
    expect(res.status).toBeNull()
  })
})
