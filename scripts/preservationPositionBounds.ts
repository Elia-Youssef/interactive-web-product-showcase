import { POSITION_QUANTIZE_BITS } from './settings.ts'

// quantize.ts replicates high bits into the unused Int16 low bits rather
// than rounding onto the storage grid. Enumerate that finite grid to bound
// its deviation from the ideal quantized value at the shared precision.
function replicationBound(): number {
  const bits = POSITION_QUANTIZE_BITS - 1
  const levels = Math.pow(2, bits) - 1
  const storageLevels = Math.pow(2, 15) - 1
  const low = 15 - bits
  const high = 2 * bits - 15
  let bound = 0
  for (let value = 0; value <= levels; value += 1) {
    const replicated = (value << low) | (value >> high)
    bound = Math.max(bound, Math.abs(replicated / storageLevels - value / levels))
  }
  return bound
}

const POSITION_REPLICATION_BOUND = replicationBound()

export function positionComponentBound(halfExtent: number): number {
  const levels = Math.pow(2, POSITION_QUANTIZE_BITS - 1) - 1
  return halfExtent * (Math.pow(2, -24) + 1 / (2 * levels) + POSITION_REPLICATION_BOUND)
}
