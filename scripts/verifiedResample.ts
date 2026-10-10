import type { Transform } from '@gltf-transform/core'
import { resample } from '@gltf-transform/functions'
import { ready, resample as resampleWASM, type Interpolation } from 'keyframe-resample'
import { sample, vectorsMatch, type AnimationCurve } from './preservationCurve.ts'

function withinTolerance(
  before: AnimationCurve,
  after: AnimationCurve,
  tolerance: number,
): boolean {
  return before.times.every((time) =>
    (before.interpolation === 'STEP' ? [false, true] : [false]).every((leftLimit) =>
      vectorsMatch(
        sample(before, time, leftLimit),
        sample(after, time, leftLimit),
        tolerance,
        before.path === 'rotation',
      ),
    ),
  )
}

// The installed greedy resampler only checks each removal locally. Verify
// its complete curve before allowing compaction; otherwise restore the
// entire channel. Keeping its callback preserves accessor cleanup and order.
export function verifiedResample(tolerance: number): Transform {
  return resample({
    ready,
    tolerance,
    resample: (times: Float32Array, values: Float32Array, interpolation: Interpolation) => {
      const originalTimes = times.slice()
      const originalValues = values.slice()
      const components = values.length / times.length
      const count = resampleWASM(times, values, interpolation, tolerance)
      if (count === originalTimes.length) return count
      const before: AnimationCurve = {
        interpolation: interpolation === 'step' ? 'STEP' : 'LINEAR',
        path: interpolation === 'slerp' ? 'rotation' : 'translation',
        components,
        times: Array.from(originalTimes),
        values: Array.from(originalValues),
      }
      const after = {
        ...before,
        times: Array.from(times.subarray(0, count)),
        values: Array.from(values.subarray(0, count * components)),
      }
      if (withinTolerance(before, after, tolerance)) return count
      times.set(originalTimes)
      values.set(originalValues)
      return originalTimes.length
    },
  })
}
