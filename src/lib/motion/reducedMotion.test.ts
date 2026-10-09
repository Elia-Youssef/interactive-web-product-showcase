import { describe, expect, it } from 'vitest'
import { reducedMotionQuery } from './reducedMotion'

// The owner pins the query's value here. That no other source spells it is
// the lint rule's charge, over every linted file.
describe('the reduced motion query', () => {
  it('is the query the one-shot read and the subscription follow', () => {
    expect(reducedMotionQuery).toBe('(prefers-reduced-motion: reduce)')
  })
})
