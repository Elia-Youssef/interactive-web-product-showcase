import { useEffect, useState } from 'react'
import type { ResourceHolds } from '@lib/async/resourceHolds'
import { FrameClock } from './FrameClock'

// The stage owns the clock. Its final release follows the existing hold
// contract, so a StrictMode effect replay cannot dispose a live clock.
export function useStageClock(holds: ResourceHolds<object>): FrameClock {
  const [clock] = useState(() => new FrameClock())
  useEffect(() => {
    holds.hold(clock)
    return () => holds.drop(clock, clock.dispose)
  }, [clock, holds])
  return clock
}
