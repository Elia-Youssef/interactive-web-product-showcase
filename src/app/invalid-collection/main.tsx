// Dev-only entry (invalid-collection.html): the app itself over a
// deliberately broken manifest list, so the typed error screen is reachable
// in a browser without touching the real products. It is absent from the
// production build, whose only input is index.html.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CollectionApp } from '../CollectionApp'
import { invalidManifests } from './invalidManifests'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from invalid-collection.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <CollectionApp manifests={invalidManifests} />
  </StrictMode>,
)
