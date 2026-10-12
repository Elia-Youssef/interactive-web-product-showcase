import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@app/App'
import { BrowserRouter, RouterProvider } from '@app/routing'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from index.html')
}

const router = new BrowserRouter(window)

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router}>
      <App />
    </RouterProvider>
  </StrictMode>,
)
