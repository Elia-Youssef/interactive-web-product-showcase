import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

// Playwright replaces a worker after a failure. Its successor must retain
// completed assertions from earlier cases in this run, but no earlier run.
export class CompletedDockBehaviors extends Set<string> {
  private file: string | undefined

  resume(file: string): void {
    this.file = file
    if (!existsSync(file)) return
    for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
      const behavior: unknown = JSON.parse(line)
      if (typeof behavior !== 'string') throw new Error('invalid dock completion record')
      super.add(behavior)
    }
  }

  override add(behavior: string): this {
    if (this.file === undefined) throw new Error('dock completion records are not initialized')
    mkdirSync(dirname(this.file), { recursive: true })
    appendFileSync(this.file, `${JSON.stringify(behavior)}\n`)
    return super.add(behavior)
  }
}
