import { describe, expect, it } from 'vitest'
import type { ProductFailure } from '@lib/product'
import { productFailureCopy, productFailureDisplay } from './failureMessage'
import { productFailureFixtures as failures } from './failureMessage.fixtures'

// The lines one display shows: the reason, then every problem entry.
function linesOf(failure: ProductFailure): readonly string[] {
  const display = productFailureDisplay(failure)
  return [display.reason, ...(display.problems ?? [])]
}

describe('productFailureDisplay', () => {
  it('names the model URL and the loader message of a load failure', () => {
    const display = productFailureDisplay(failures.load)
    expect(display.reason).toContain(failures.load.url)
    expect(display.reason).toContain(failures.load.message)
    expect(display.problems).toBeUndefined()
  })

  it('lists every model contract problem under its heading, with its node when it names one', () => {
    expect(productFailureDisplay(failures['model-contract'])).toEqual({
      reason: productFailureCopy.modelContract,
      problems: [
        `${failures['model-contract'].problems[0]?.node}: ${failures['model-contract'].problems[0]?.message}`,
        failures['model-contract'].problems[1]?.message,
      ],
    })
  })

  it('lists every finish mapping problem under its heading, at its mesh and primitive', () => {
    expect(productFailureDisplay(failures['finish-contract'])).toEqual({
      reason: productFailureCopy.finishContract,
      problems: [
        `mesh 2 primitive 0: ${failures['finish-contract'].problems[0]?.message}`,
        failures['finish-contract'].problems[1]?.message,
      ],
    })
  })

  it('lists every camera rule the authored cameras break under its heading', () => {
    expect(productFailureDisplay(failures['camera-contract'])).toEqual({
      reason: productFailureCopy.cameraContract,
      problems: failures['camera-contract'].problems.map((problem) => problem.message),
    })
  })

  // The rule the display owns for the whole class: a problem entry becomes
  // a list item the alert renders, never text that carries its own bullet
  // character, so no diagnostic line can reach the alert dash prefixed.
  it('starts no reason and no problem entry with a dash, over every kind', () => {
    for (const failure of Object.values(failures)) {
      for (const line of linesOf(failure)) {
        expect(line.startsWith('-'), line).toBe(false)
      }
    }
  })

  it.each(Object.values(failures))('carries the facts of a $kind failure', (failure) => {
    const facts = 'problems' in failure ? failure.problems.map((p) => p.message) : [failure.message]
    const lines = linesOf(failure)
    for (const fact of facts) {
      expect(
        lines.some((line) => line.includes(fact)),
        fact,
      ).toBe(true)
    }
  })

  it.each(Object.values(failures))(
    'uses undefined only for the absent list of $kind',
    (failure) => {
      const problems = productFailureDisplay(failure).problems
      if ('problems' in failure) {
        expect(problems).toHaveLength(failure.problems.length)
      } else {
        expect(problems).toBeUndefined()
      }
    },
  )

  it('gives every kind its own heading', () => {
    const headings = Object.values(failures).map(
      (failure) => productFailureDisplay(failure).reason.split(':')[0],
    )
    expect(new Set(headings).size).toBe(headings.length)
  })
})
