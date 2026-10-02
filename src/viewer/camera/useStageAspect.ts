import { useCallback, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

// The stage aspect at call time, kept current by the render that observed
// it: a request that arrives before the resize effect ran still reads the
// aspect of the last render. The reader is stable for the canvas's life.
export function useStageAspect(): () => number {
  const size = useThree((state) => state.size)
  const aspectRef = useRef(size.width / size.height)
  useEffect(() => {
    aspectRef.current = size.width / size.height
  }, [size])
  return useCallback(() => aspectRef.current, [])
}
