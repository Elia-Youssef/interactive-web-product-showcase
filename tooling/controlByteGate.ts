// The runner of the control byte gate: it reads every gated text file and
// reports each forbidden control character by file, line, column and byte.
// lint.ts calls it after the pointer gate in the same process, so one command
// reports all gates and fails on any of them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findControlBytes } from './controlBytes.ts'
import type { ControlByteFinding } from './controlBytes.ts'
import { listGatedTextFiles } from './gatedFiles.ts'

export function scanGatedFilesForControlBytes(root: string): ControlByteFinding[] {
  return listGatedTextFiles(root).flatMap((file) =>
    findControlBytes(file, readFileSync(join(root, file)).toString('utf8')),
  )
}
