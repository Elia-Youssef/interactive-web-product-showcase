// Public API of the dismiss domain: the pure layer stack the escape owner
// runs, and the owner that composes it with the listener's lifecycle.
// Everything else in this folder is internal and reached only through this
// file.

export { createEscapeStack } from './escapeStack'
export type { EscapeLayer, EscapeStack } from './escapeStack'
export { createEscapeOwner } from './escapeOwner'
export type { EscapeKeyEvent, EscapeOwner, KeyTarget } from './escapeOwner'
