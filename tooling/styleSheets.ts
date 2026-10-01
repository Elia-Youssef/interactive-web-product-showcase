// The gated stylesheet list: the gated files, filtered to the style
// extensions. Git stays the only authority, so a stylesheet in a new folder
// is scanned without anyone editing a hand-kept list.
import { hasExtension, styleExtensions } from './extensions.ts'
import { listGatedFiles } from './gatedFiles.ts'

export function gatedStyleSheets(root: string): string[] {
  return listGatedFiles(root).filter((file) => hasExtension(file, styleExtensions))
}
