export type PointerPosition = {
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
}

export type PointerStart = PointerPosition & {
  readonly isPrimary: boolean
  readonly button: number
}

type Gesture = {
  readonly start: PointerPosition
  readonly kind: 'pending' | 'drag'
  readonly consumer: Binding | null
}

type Binding = { readonly run: () => void }

// A canvas life owns one gesture and its focus decision. A stationary
// press is offered to its consumer before stage focus is committed; the
// first travel instead commits a drag's stage focus. Neither outcome is
// undone by the other, even when a drag returns to its starting point.
// A pending press belongs to its starting consumer's registration, so a
// retired or replacement consumer cannot inherit that input.
export class StagePointerGestures {
  private gesture: Gesture | null = null
  private focusStage: Binding | null = null
  private consumePress: Binding | null = null

  focusWith(focus: () => void): () => void {
    if (this.focusStage !== null) throw new Error('a canvas life has one stage focus target')
    const binding = { run: focus }
    this.focusStage = binding
    return () => {
      if (this.focusStage === binding) {
        this.gesture = null
        this.focusStage = null
      }
    }
  }

  consumePressWith(consume: () => void): () => void {
    if (this.consumePress !== null) throw new Error('a stage press has one consumer')
    const binding = { run: consume }
    this.consumePress = binding
    return () => {
      if (this.consumePress === binding) this.consumePress = null
    }
  }

  down(input: PointerStart): void {
    this.gesture = null
    if (!input.isPrimary || input.button !== 0) {
      this.useStage()
      return
    }
    this.gesture = { start: input, kind: 'pending', consumer: this.consumePress }
  }

  move(input: PointerPosition): void {
    const gesture = this.gesture
    if (gesture === null || gesture.start.pointerId !== input.pointerId) return
    if (gesture.kind === 'pending' && traveled(gesture.start, input)) {
      this.gesture = { ...gesture, kind: 'drag' }
      this.useStage()
    }
  }

  up(input: PointerPosition, onCanvas: boolean): void {
    const gesture = this.gesture
    if (gesture === null || gesture.start.pointerId !== input.pointerId) return
    this.gesture = null
    if (gesture.kind === 'drag') return
    const consumer = gesture.consumer
    if (
      onCanvas &&
      !traveled(gesture.start, input) &&
      consumer !== null &&
      consumer === this.consumePress
    ) {
      consumer.run()
    } else {
      this.useStage()
    }
  }

  cancel(pointerId: number): void {
    if (this.gesture?.start.pointerId === pointerId) this.gesture = null
  }

  private useStage(): void {
    if (this.focusStage === null) throw new Error('stage use requires its live keyboard target')
    this.focusStage.run()
  }
}

function traveled(start: PointerPosition, current: PointerPosition): boolean {
  return start.clientX !== current.clientX || start.clientY !== current.clientY
}
