import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { BrowserRouter } from './browserRouter'
import { RouterContext } from './routerContext'
import { createRouterLifetime } from './routerLifetime'

export function RouterProvider({
  router,
  children,
}: {
  readonly router: BrowserRouter
  readonly children: ReactNode
}) {
  const [hold] = useState(() => createRouterLifetime())
  useEffect(() => hold(router), [hold, router])
  return <RouterContext value={router}>{children}</RouterContext>
}
