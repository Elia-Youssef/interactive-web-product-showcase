import { mkdtempSync, rmdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CompletedDockBehaviors } from './completedDockBehaviors'

it('retains completed assertions across workers without sharing another layout or run', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dock-completions-'))
  const file = join(directory, 'layout.jsonl')
  try {
    const first = new CompletedDockBehaviors()
    first.resume(file)
    first.add('open')
    first.add('readability')

    const replacement = new CompletedDockBehaviors()
    replacement.resume(file)
    expect([...replacement]).toEqual(['open', 'readability'])
    replacement.add('switch')

    const another = new CompletedDockBehaviors()
    another.resume(join(directory, 'another-layout.jsonl'))
    expect(another.size).toBe(0)
    const nextRun = new CompletedDockBehaviors()
    nextRun.resume(join(directory, 'another-run.jsonl'))
    expect(nextRun.size).toBe(0)

    const later = new CompletedDockBehaviors()
    later.resume(file)
    expect([...later]).toEqual(['open', 'readability', 'switch'])
  } finally {
    unlinkSync(file)
    rmdirSync(directory)
  }
})
