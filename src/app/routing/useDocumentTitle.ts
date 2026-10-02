import { useEffect } from 'react'

// Names the document after the page that is shown, from one effect per
// rendered page. The static index.html title stays the pre-script
// fallback and is never read back.
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
