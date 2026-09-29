import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StageRemountPage } from './StageRemountPage'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from stage-remount.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <StageRemountPage />
  </StrictMode>,
)
