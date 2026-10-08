import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { fixtureModelPathOf, isFixtureProductSlug } from '../scripts/fixtureProducts.ts'

// The dev server's fixture models. The fixture products keep their model
// files beside their manifests under tests/fixtures/products, outside the
// public folder, so no build can ship one; the dev server and the e2e
// server answer the fixture slug at the model URL every product loads by
// (productModelUrl), which makes the harness load a fixture exactly like a
// shipped product. The plugin applies to the dev server only: a build and
// a preview of the dist output never see it, and the model URL of a fixture
// slug has no shipped file behind it.

// The repo root: the parent of the tooling folder this file lives in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

// The model URL every product loads by (src/lib/product/modelUrl.ts), as a
// route: /models/<slug>/model.glb.
const MODEL_URL = /^\/models\/([A-Za-z0-9-]+)\/model\.glb$/

function sendFile(res: ServerResponse, file: string): void {
  res.writeHead(200, { 'content-type': 'model/gltf-binary' })
  createReadStream(file).pipe(res)
}

function notFound(res: ServerResponse, slug: string): void {
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end(`no fixture product '${slug}' under ${fixtureModelPathOf(ROOT, slug)}`)
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://fixtures.invalid')
  const match = MODEL_URL.exec(url.pathname)
  if (match === null) {
    next()
    return
  }
  const slug = match[1] ?? ''
  const file = fixtureModelPathOf(ROOT, slug)
  if (await isFixtureProductSlug(ROOT, slug)) {
    if (await isFile(file)) {
      sendFile(res, file)
    } else {
      // A fixture slug whose model file is missing is that fixture's own
      // breakage, named at its path.
      notFound(res, slug)
    }
    return
  }
  // A shipped slug falls through to the server's own static serving.
  next()
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

export function devFixtureModelsPlugin(): Plugin {
  return {
    name: 'viewer-fixture-models',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next)
      })
    },
  }
}
