// Vite's native expander requires real filenames. Its isolated tree contains
// only the caller's owned paths, never adjacent ignored or generated files.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export function createGlobFileTree(root: string, files: readonly string[]) {
  const parent = resolve(root, 'scratch')
  mkdirSync(parent, { recursive: true })
  const tree = mkdtempSync(join(parent, 'glob-files-'))
  const remove = () => {
    if (dirname(resolve(tree)) !== parent) throw new Error('Glob tree escaped its scratch owner')
    rmSync(tree, { recursive: true, force: true })
  }
  try {
    for (const file of new Set(files)) {
      const target = resolve(tree, file)
      const owned = relative(tree, target)
      if (!owned || owned.startsWith('..') || isAbsolute(owned)) {
        throw new Error(`Glob file is outside its namespace: ${file}`)
      }
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, file.endsWith('.json') ? '{}' : '')
    }
  } catch (error) {
    remove()
    throw error
  }
  return { root: tree, remove }
}
