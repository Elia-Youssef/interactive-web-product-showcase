import { vi } from 'vitest'
import { TaskChain } from './taskChain'
import { deferredSignal } from './deferredSignal.fixtures'

type TaskObservation = { started: Promise<void>; finished: Promise<void>; atStart: unknown }

const push = TaskChain.prototype.push

// Observe the real chain without advancing a clock: the start signal lands
// after the task's synchronous body, and the finish signal after its result.
// The snapshot is captured before any continuation, so even an extra
// microtask before the promised synchronous work fails at this boundary.
export function observeTaskStarts(read: () => unknown = () => undefined) {
  const tasks: TaskObservation[] = []
  vi.spyOn(TaskChain.prototype, 'push').mockImplementation(function (this: TaskChain, task) {
    const started = deferredSignal()
    const finished = deferredSignal()
    const observation: TaskObservation = {
      started: started.promise,
      finished: finished.promise,
      atStart: undefined,
    }
    tasks.push(observation)
    return push.call(this, () => {
      const result = task()
      observation.atStart = read()
      started.resolve()
      void result.then(finished.resolve, finished.resolve)
      return result
    })
  })
  return (index: number) => {
    const task = tasks[index]
    if (task === undefined) {
      throw new Error(`no task was pushed at index ${index}`)
    }
    return task
  }
}
