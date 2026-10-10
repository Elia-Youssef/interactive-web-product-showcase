import { createContext, useContext } from 'react'
import type { BrowserRouter } from './browserRouter'

export const RouterContext = createContext<BrowserRouter | null>(null)

export function useRouter(): BrowserRouter {
  const router = useContext(RouterContext)
  if (router === null) {
    throw new Error('routing requires a router provided by the application root')
  }
  return router
}
