import { expect } from 'vitest'
import type { observeTaskStarts } from '@lib/async/taskStarts.fixtures'
import type { fakeSettle } from './finishApplier.fixtures'

// Each application starts synchronously with one settle, remains parked
// until that settle is released, and finishes before the next task starts.
export async function drainApplications(
  task: ReturnType<typeof observeTaskStarts>,
  fake: ReturnType<typeof fakeSettle>,
  applications: number,
): Promise<void> {
  for (let index = 0; index < applications; index += 1) {
    await task(index).started
    expect(task(index).atStart).toBe(index + 1)
    expect(fake.settleCalls()).toBe(index + 1)
    fake.release(index)
    await task(index).finished
  }
}
