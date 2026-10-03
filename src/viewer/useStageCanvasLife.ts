import { useCallback, useEffect, useReducer } from 'react'
import { applyStageCanvasEvent, initialStageCanvasLife } from './stageCanvasLife'

// The stage's canvas life wired to the store: a product life that starts
// (the product status turning loading) on a stage that has not failed is
// the content arrival a retired canvas waits for. Returns the epoch the
// canvas is keyed by and the retirement report of the canvas mounted at
// that epoch, stable for the mount.
export function useStageCanvasLife(
  productLoading: boolean,
  stageFailed: boolean,
): { readonly epoch: number; readonly retire: () => void } {
  const [life, dispatch] = useReducer(applyStageCanvasEvent, initialStageCanvasLife)
  const { epoch } = life

  useEffect(() => {
    if (productLoading && !stageFailed) {
      dispatch({ kind: 'content-arrived' })
    }
  }, [productLoading, stageFailed])

  const retire = useCallback(() => dispatch({ kind: 'retired', epoch }), [epoch])
  return { epoch, retire }
}
