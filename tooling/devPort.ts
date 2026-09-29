// Every dev server and test runner takes its port from this one pool, so
// parallel checkouts never collide. It stays pure (an env record in, a port
// out, no Node or Vite APIs) so any tool config can import it.
export const devPort = {
  variable: 'VIEWER_PORT',
  default: 5290,
  min: 5290,
  max: 5294,
} as const

// Number() accepts more than this project ever means by a port: surrounding
// spaces, hex like 0x14AB, exponent forms. The shape is pinned first, so only
// plain decimal digits reach the range check.
const portShape = /^\d+$/

export function resolveDevPort(env: Record<string, string | undefined>): number {
  const raw = env[devPort.variable]
  if (raw === undefined) {
    return devPort.default
  }
  // One mistake, one message: a value outside the pool, or not a plain
  // decimal number at all, fails right here. An empty value errors too,
  // instead of silently binding the pool default.
  const value = portShape.test(raw) ? Number(raw) : Number.NaN
  if (Number.isNaN(value) || value < devPort.min || value > devPort.max) {
    throw new Error(
      `${devPort.variable} must be an integer from ${devPort.min} to ${devPort.max}, but got "${raw}"`,
    )
  }
  return value
}
