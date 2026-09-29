import { frameRecordCapacity } from './frameStats'
import type { FrameRecord } from './frameStats'

// A preallocated ring buffer of frame records. The per-frame writer
// allocates nothing: push writes into the numbers of a pair of typed arrays
// that exist once, from construction on. Reading is the display's business
// and happens at its cadence, never per frame.
export class FrameRing {
  private readonly atMs: Float64Array
  private readonly tickMs: Float64Array
  private start = 0
  private count = 0

  constructor(capacity: number = frameRecordCapacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`FrameRing capacity must be a positive integer, got ${capacity}`)
    }
    this.atMs = new Float64Array(capacity)
    this.tickMs = new Float64Array(capacity)
  }

  push(atMs: number, tickMs: number): void {
    const capacity = this.atMs.length
    const index = (this.start + this.count) % capacity
    this.atMs[index] = atMs
    this.tickMs[index] = tickMs
    if (this.count < capacity) {
      this.count += 1
    } else {
      this.start = (this.start + 1) % capacity
    }
  }

  // The live records, oldest first. Each call builds a fresh list on
  // purpose: the samples returned to the reader must not alias slots the
  // writer is about to overwrite.
  records(): FrameRecord[] {
    const capacity = this.atMs.length
    const records: FrameRecord[] = []
    for (let position = 0; position < this.count; position += 1) {
      const index = (this.start + position) % capacity
      const atMs = this.atMs[index]
      const tickMs = this.tickMs[index]
      if (atMs === undefined || tickMs === undefined) {
        throw new Error(`FrameRing read slot ${index} outside its capacity of ${capacity}`)
      }
      records.push({ atMs, tickMs })
    }
    return records
  }
}
