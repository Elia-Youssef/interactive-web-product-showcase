// The two ways a control of this library waits. A control that can become
// unavailable while it may hold focus (it waits in reaction to its own
// activation, or to a state that can change under the focus) never takes
// the native disabled attribute: the browser would answer it by dropping
// focus on the body, and a keyboard user loses their place. It is
// unavailable instead: it announces the wait through aria-disabled, stays
// in the tab order, and its activation does nothing, while the disabled
// look comes from the same tokens the native state uses. The native
// attribute remains for controls whose unavailable window can never
// overlap focus.

export type UnavailableProps = {
  // Whether the control waits while it may hold focus.
  readonly unavailable?: boolean
}

// The attributes a waiting control carries: the announced wait, and no
// native disabled, so the focus and the tab order stay on it. Spread over
// the element the primitive renders.
export function unavailableAttributes(unavailable: boolean | undefined): {
  'aria-disabled': true | undefined
} {
  return { 'aria-disabled': unavailable ? true : undefined }
}

// Whether the control must ignore its own activation. The browser ignores
// activation for a natively disabled control; the primitive ignores it for
// an unavailable one, where click, Enter and Space all arrive as click.
export function ignoresActivation(props: { disabled?: boolean; unavailable?: boolean }): boolean {
  return props.disabled === true || props.unavailable === true
}

// The key hold a waiting range input takes: a native input moves to its
// keys by their default action, so the hold is the key half of the
// activation the primitive ignores.
export function stopKeyAction(event: { preventDefault(): void }): void {
  event.preventDefault()
}
