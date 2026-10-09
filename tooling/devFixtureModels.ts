import { createReadStream } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { fixtureModelPathOf, isFixtureProductSlug } from '../scripts/fixtureProducts.ts'
import { isFile } from '../scripts/fsErrors.ts'

// The dev server's fixture models. The fixture products keep their model
// files beside their manifests under tests/fixtures/products, outside the
// public folder, so no build can ship one; the dev server and the e2e
// server answer the fixture slug at the model URL every product loads by
// (productModelUrl), which makes the harness load a fixture exactly like a
// shipped product. The plugin applies to the dev server only: a build and
// a preview of the dist output never see it, and the model URL of a fixture
// slug has no shipped file behind it. Every failure reaches the server's
// own error handling through next: a rejected lookup and a failed read
// alike, never a dropped promise or a stream with no error handler.

// The repo root: the parent of the tooling folder this file lives in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

// The model URL every product loads by (src/lib/product/modelUrl.ts), as a
// route: /models/<slug>/model.glb.
const MODEL_URL = /^\/models\/([A-Za-z0-9-]+)\/model\.glb$/

// What the middleware reads of a request and writes to a response: the
// URL, and a writable body with its status line.
export type ModelRequest = Pick<IncomingMessage, 'url'>
export type ModelResponse = NodeJS.WritableStream & {
  writeHead(status: number, headers: Readonly<Record<string, string>>): unknown
}
export type Next = (error?: unknown) => void

// Streams the model file into the response. The status line goes out only
// once the file has opened, so a file that fails to open reaches next with
// its error and the server answers it as an error, not as a model.
export function sendModel(res: ModelResponse, file: string, next: Next): void {
  const stream = createReadStream(file)
  stream.on('error', next)
  stream.on('open', () => {
    res.writeHead(200, { 'content-type': 'model/gltf-binary' })
    stream.pipe(res)
  })
}

function notFound(res: ModelResponse, root: string, slug: string): void {
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end(`no fixture product '${slug}' under ${fixtureModelPathOf(root, slug)}`)
}

async function handle(
  root: string,
  req: ModelRequest,
  res: ModelResponse,
  next: Next,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://fixtures.invalid')
  const match = MODEL_URL.exec(url.pathname)
  if (match === null) {
    next()
    return
  }
  const slug = match[1] ?? ''
  if (!(await isFixtureProductSlug(root, slug))) {
    // A shipped slug falls through to the server's own static serving.
    next()
    return
  }
  const file = fixtureModelPathOf(root, slug)
  if (await isFile(file)) {
    sendModel(res, file, next)
  } else {
    // A fixture slug whose model file is missing is that fixture's own
    // breakage, named at its path.
    notFound(res, root, slug)
  }
}

// The middleware over one repo root: every rejection of the lookup goes to
// next as the request's error.
export function fixtureModelsMiddleware(
  root: string,
): (req: ModelRequest, res: ModelResponse, next: Next) => void {
  return (req, res, next) => {
    handle(root, req, res, next).catch(next)
  }
}

export function devFixtureModelsPlugin(): Plugin {
  return {
    name: 'viewer-fixture-models',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(fixtureModelsMiddleware(ROOT))
    },
  }
}
