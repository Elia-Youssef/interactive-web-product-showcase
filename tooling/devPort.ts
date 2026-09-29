// Every dev server and test runner takes its port from this one pool, so
// parallel checkouts never collide. It stays pure (an env record in, a port
// out, no Node or Vite APIs) so any tool config can import it.
export const devPort = {
  variable: 'VIEWER_PORT',
  default: 5290,
  min: 5290,
  max: 5294,
} as const

export function resolveDevPort(env: Record<string, string | undefined>): number {
  const raw = env[devPort.variable]
  if (raw === undefined || raw === '') {
    return devPort.default
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < devPort.min || value > devPort.max) {
    throw new Error(
      `${devPort.variable} must be an integer from ${devPort.min} to ${devPort.max}, but got "${raw}"`,
    )
  }
  return value
}
