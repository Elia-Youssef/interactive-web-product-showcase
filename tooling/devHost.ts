// The loopback address the e2e server binds and every e2e page opens. It is
// a literal address, not the name "localhost": the OS resolver orders that
// name per connection and the server binds one address family of it, so a
// client that lands on the other family only works through its own silent
// fallback. A literal address has no resolver in the path: the server binds
// it, the browser opens it, and both engines see the same bytes. IPv4 over
// IPv6 because the IPv6 loopback is absent on hosts with IPv6 disabled,
// while the IPv4 loopback exists wherever the tool runs. The human dev
// server keeps Vite's default host and is untouched by this module.
export const devHost = {
  address: '127.0.0.1',
} as const

// The one mark of a Vite process serving the e2e matrix. The Playwright web
// server sets it; a dev server started by hand does not, and keeps Vite's
// defaults: the localhost host and the live HMR client.
export const e2eServer = {
  variable: 'VIEWER_E2E_SERVER',
  value: '1',
} as const

// A set-but-wrong value is a mistake about which server is starting, so it
// fails here instead of silently running the human configuration.
export function isE2EServer(env: Record<string, string | undefined>): boolean {
  const raw = env[e2eServer.variable]
  if (raw === undefined) {
    return false
  }
  if (raw !== e2eServer.value) {
    throw new Error(`${e2eServer.variable} only takes "${e2eServer.value}", but got "${raw}"`)
  }
  return true
}

// The base URL every e2e page opens, from the same address the server binds.
export function e2eBaseURL(port: number): string {
  return `http://${devHost.address}:${port}`
}
