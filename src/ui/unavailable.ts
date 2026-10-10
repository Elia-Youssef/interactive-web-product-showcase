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

// The value keys of a range input: the keys whose default action moves its
// value, the set the HTML range state and the slider pattern's keyboard
// interactions agree on. The set is the hold's whole extent: a waiting
// range input holds exactly these keys, and every other key, Tab and
// Shift+Tab among them, keeps its default and reaches the page.
export const rangeValueKeys: ReadonlySet<string> = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
])

// The key hold a waiting range input takes, the key half of the activation
// the primitive ignores: a range input moves to its value keys by their
// default action, so the hold prevents exactly those.
export function holdValueKey(event: { key: string; preventDefault(): void }): void {
  if (rangeValueKeys.has(event.key)) {
    event.preventDefault()
  }
}

// The change hold a waiting field takes, the change half of the activation
// it ignores: the change event arrives answered by nothing, which is the
// word a controlled field takes in place of the readonly attribute, and
// the value the caller holds is never moved by it.
export function ignoreChange(): void {}
