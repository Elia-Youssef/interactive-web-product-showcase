// How many browsers run the e2e matrix at once. Every test holds a GPU
// context, and the GPU and the software-rendered WebKit build are the
// bounded resource, not the CPU count Playwright sizes its default from: at
// the default of half the cores (16 here), context creation failed and
// WebKit stopped presenting frames, while a cap of 6 ran the whole matrix
// green in about a minute. Set VIEWER_E2E_WORKERS lower on a shared machine.
import { resolveEnvInteger } from './envInteger.ts'

export const e2eWorkers = {
  variable: 'VIEWER_E2E_WORKERS',
  default: 6,
  min: 1,
  max: 6,
} as const

export function resolveE2EWorkers(env: Record<string, string | undefined>): number {
  return resolveEnvInteger(e2eWorkers, env)
}
