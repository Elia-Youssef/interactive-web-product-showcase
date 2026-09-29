// The owned stylesheet list: the files git owns, filtered to the style
// extensions. Git stays the only authority, so a stylesheet in a new folder
// is scanned without anyone editing a hand-kept list.
import { hasExtension, styleExtensions } from './extensions.ts'
import { listOwnedFiles } from './ownedFiles.ts'

export function ownedStyleSheets(root: string): string[] {
  return listOwnedFiles(root).filter((file) => hasExtension(file, styleExtensions))
}
