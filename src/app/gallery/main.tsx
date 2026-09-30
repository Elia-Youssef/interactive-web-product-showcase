// Dev-only entry of the UI primitives gallery (gallery.html). The app shell
// and src/main.tsx are untouched: this page exists for the look review and
// the later visual tests.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@styles/global.css'
import { Gallery } from './Gallery'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from gallery.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
)
