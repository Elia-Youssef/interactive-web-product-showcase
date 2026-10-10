import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Texture } from 'three/webgpu'
import type { KeyedLoad } from '@lib/async/keyedLoads'
import { createStageEnvironmentLoads, type StageEnvironmentLoads } from './stageEnvironmentLoads'
import { useStageHolds } from './stageHoldsContext'

// The stage's environment entry, in context. The provider renders above the
// stage's canvas lives, so the loads live as long as the stage does: one
// load per environment file per stage, and a canvas life the stage replaces
// re-reads the live entry instead of loading again. The environment is stage
// furniture, not content: had the loads lived one canvas life long, every
// replacement canvas would have suspended the whole stage content on the
// environment again and restarted the product life that canvas was showing.
// The provider itself never suspends, so its state outlives the suspended
// reader that awaits the texture: a component that suspends on its first
// render never commits, and state it owns itself would restart its load on
// every retry.
//
// The entry's texture is the stage's decoded data, never handed to a
// renderer: each canvas life draws through a texture of its own over the
// same source (canvasLifeEnvironment.ts), so a retired renderer keeps no
// reference to anything the stage outlives it with.
const StageEnvironmentEntryContext = createContext<KeyedLoad<Texture> | null | undefined>(undefined)

// The environment entry a stage's environment component reads its texture
// from. Only the stage's provider can supply it; an environment rendered
// anywhere else fails with a named error instead of a load no stage owns.
export function useStageEnvironmentEntry(): KeyedLoad<Texture> | null {
  const entry = useContext(StageEnvironmentEntryContext)
  if (entry === undefined) {
    throw new Error(
      'the stage environment needs the stage environment provider: render it inside the stage',
    )
  }
  return entry
}

// Starts the stage's environment entry for the file and holds it in the
// same committed effect. An abandoned render starts no work. Holds keep
// StrictMode replay on the same entry, and release late results on unmount.
// The hold lasts for the stage's whole life: its release disposes the
// loaded texture and forgets the entry, so a later stage loads a fresh
// texture instead of reusing a disposed one. A load that failed created no
// texture, so its release has nothing to dispose, and its failure is not
// this release's to report: the reader's use() of the same promise throws
// it into the stage's error boundary.
function useStageEnvironmentHeldEntry(
  loads: StageEnvironmentLoads,
  file: string,
): KeyedLoad<Texture> | null {
  const holds = useStageHolds()
  const [held, setHeld] = useState<KeyedLoad<Texture> | null>(null)
  useEffect(() => {
    const entry = loads.read(file)
    holds.hold(entry)
    setHeld(entry)
    return () => holds.drop(entry, () => loads.release(entry))
  }, [loads, file, holds])
  return held?.key === file ? held : null
}

// Provides the entry for the file, read from the stage's own loads.
function LoadedStageEnvironment({
  file,
  children,
}: {
  readonly file: string
  readonly children: ReactNode
}) {
  const [loads] = useState(createStageEnvironmentLoads)
  const entry = useStageEnvironmentHeldEntry(loads, file)
  return (
    <StageEnvironmentEntryContext.Provider value={entry}>
      {children}
    </StageEnvironmentEntryContext.Provider>
  )
}

// The stage's environment around its canvas lives. A stage that can mount
// no canvas (an invalid backend request) has no environment to read, so it
// passes no file and loads nothing.
export function StageEnvironmentProvider({
  file,
  children,
}: {
  readonly file: string | null
  readonly children: ReactNode
}) {
  if (file === null) {
    return children
  }
  return <LoadedStageEnvironment file={file}>{children}</LoadedStageEnvironment>
}
