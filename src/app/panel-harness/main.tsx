// Dev-only entry of the panel harness (panel-harness.html). The app shell
// and src/main.tsx are untouched: this page mounts the collection loader,
// the store provider and the panel on their own, for visual review and
// the e2e evidence.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@styles/global.css'
import { PanelHarness } from './PanelHarness'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from panel-harness.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <PanelHarness />
  </StrictMode>,
)
