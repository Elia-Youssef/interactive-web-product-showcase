import { productManifests } from '@products/index'
import { CollectionApp } from './CollectionApp'

// The app over the real product manifests.
export function App() {
  return <CollectionApp manifests={productManifests} />
}
