// Every dev server and test runner takes its port from this one pool, so
// parallel checkouts never collide. It stays pure (an env record in, a port
// out, no Node or Vite APIs) so any tool config can import it.
import { resolveEnvInteger } from './envInteger.ts'

export const devPort = {
  variable: 'VIEWER_PORT',
  default: 5290,
  min: 5290,
  max: 5294,
} as const

export function resolveDevPort(env: Record<string, string | undefined>): number {
  return resolveEnvInteger(devPort, env)
}
