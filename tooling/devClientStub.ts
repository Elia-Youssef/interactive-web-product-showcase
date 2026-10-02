import type { Plugin } from 'vite'

// What the e2e server serves in place of Vite's dev client. Vite injects the
// client into every page, and every CSS-bearing module imports it for the
// style injection, so no server-side switch can keep the client off the
// page: with the WebSocket endpoint removed the client still loads, and its
// refused connection attempts land in the browser console, where the console
// gate fails the owning test. This module takes the client's place: the same
// exports the served modules import, with the style injection the page
// needs, and no socket, no reconnect polling and no console output. An e2e
// page therefore opens no HMR WebSocket at all, and no page can observe a
// connection failure that was never attempted.

const CLIENT_ENTRY = '/@vite/client'

// The module served at the client entry's URL. Plain browser JavaScript,
// mirroring the real client's surface: updateStyle and removeStyle keep
// their element contract (one style element per module id, the dev id
// attribute, the csp nonce when the page declares one), createHotContext
// returns the object transformed code assigns to import.meta.hot, with
// every method a no-op, and injectQuery keeps the real client's rule for
// dynamic import urls that could not be analyzed.
const stubSource = `
const sheetsById = new Map()

function stylesheetNonce() {
  return document.querySelector("meta[property=csp-nonce]")?.nonce
}

export function updateStyle(id, content) {
  let sheet = sheetsById.get(id)
  if (!sheet) {
    sheet = document.createElement("style")
    sheet.setAttribute("type", "text/css")
    sheet.setAttribute("data-vite-dev-id", id)
    const nonce = stylesheetNonce()
    if (nonce) sheet.setAttribute("nonce", nonce)
    document.head.appendChild(sheet)
    sheetsById.set(id, sheet)
  }
  sheet.textContent = content
}

export function removeStyle(id) {
  const sheet = sheetsById.get(id)
  if (sheet) {
    sheet.remove()
    sheetsById.delete(id)
  }
}

const hotDataByPath = new Map()

export function createHotContext(ownerPath) {
  let data = hotDataByPath.get(ownerPath)
  if (!data) {
    data = {}
    hotDataByPath.set(ownerPath, data)
  }
  return {
    data,
    accept() {},
    acceptExports() {},
    prune() {},
    dispose() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  }
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url
  const pathname = url.replace(/[?#].*$/, "")
  const { search, hash } = new URL(url, "http://vite.dev")
  return \`\${pathname}?\${queryToInject}\${search ? \`&\` + search.slice(1) : ""}\${hash || ""}\`
}

export class ErrorOverlay extends HTMLElement {}
`

// The stub source for a request URL, or null when the URL is not the client
// entry and the request must pass through. The query is not part of the
// entry's address, and the base joins like any served URL's.
export function devClientStubResponse(url: string, base = '/'): string | null {
  const entry = new URL(CLIENT_ENTRY, `http://localhost${base}`).pathname
  const path = url.split('?')[0] ?? ''
  return path === entry ? stubSource : null
}

export function devClientStubPlugin(): Plugin {
  return {
    name: 'dev-client-stub',
    // A middleware, not a resolve or load hook: Vite resolves the client
    // entry with its native resolver before any user plugin hook runs, so a
    // hook never wins. Registered this way the middleware answers every
    // request for the entry URL, the page script tag and the served modules'
    // imports alike, in front of Vite's own transform middleware.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const stub = devClientStubResponse(req.url ?? '', server.config.base)
        if (stub === null) {
          next()
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/javascript')
        res.end(stub)
      })
    },
  }
}
