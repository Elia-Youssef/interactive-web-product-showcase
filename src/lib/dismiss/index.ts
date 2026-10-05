// Public API of the dismiss domain: the pure layer stack the escape owner
// runs. Everything else in this folder is internal and reached only
// through this file.

export { createEscapeStack } from './escapeStack'
export type { EscapeLayer, EscapeStack } from './escapeStack'
