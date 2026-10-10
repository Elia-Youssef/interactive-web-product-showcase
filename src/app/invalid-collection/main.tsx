// Dev-only entry (invalid-collection.html): the app itself over a
// deliberately broken manifest list, so the typed error screen is reachable
// in a browser without touching the real products. It is absent from the
// production build, whose only input is index.html.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CollectionApp } from '../CollectionApp'
import { invalidManifests } from './invalidManifests'
import { BrowserRouter, RouterProvider } from '../routing'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from invalid-collection.html')
}

const router = new BrowserRouter(window)

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router}>
      <CollectionApp manifests={invalidManifests} />
    </RouterProvider>
  </StrictMode>,
)
