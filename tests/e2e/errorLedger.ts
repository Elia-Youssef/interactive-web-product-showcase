// The console gate bookkeeping, as a pure module: recorded error texts in,
// error expectations in, a verdict out. The Playwright fixture is a thin
// adapter that feeds it from the page events and asserts on its verdict, so
// every rule of the gate is unit-testable without a browser.

// How many errors an expectation consumes: an exact count, or any positive
// number, for failures whose line count varies by browser and by React's
// dev-mode double effects.
export type ErrorTimes = number | 'one-or-more'

export type ErrorExpectation = {
  readonly pattern: RegExp
  readonly times: ErrorTimes
  matched: number
}

export type LedgerVerdict = {
  // Recorded errors no expectation consumed
  readonly unexpected: readonly string[]
  // One line per expectation that did not see its count
  readonly unmet: readonly string[]
}

export type ErrorLedger = {
  record(text: string): void
  expect(pattern: RegExp, options?: { readonly times?: ErrorTimes }): void
  verdict(): LedgerVerdict
}

// The g and y flags carry match state between calls through lastIndex, so a
// reused pattern could miss on its second use. Every registered pattern is a
// copy that never carries them.
function stablePattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
}

function capacityOf(times: ErrorTimes): number {
  return times === 'one-or-more' ? Number.POSITIVE_INFINITY : times
}

function expectationLabel(expectation: ErrorExpectation): string {
  const wanted =
    expectation.times === 'one-or-more' ? 'at least one' : `exactly ${expectation.times}`
  return `/${expectation.pattern.source}/ expected ${wanted}, matched ${expectation.matched}`
}

// An unknown count must fail loudly instead of silently consuming nothing.
function declaredTimes(options: { readonly times?: ErrorTimes } | undefined): ErrorTimes {
  const times = options?.times ?? 1
  if (times === 'one-or-more') {
    return times
  }
  if (typeof times === 'number' && Number.isInteger(times) && times >= 1) {
    return times
  }
  throw new Error(
    `an error expectation takes { times: n } with n >= 1 or { times: 'one-or-more' }, got ${JSON.stringify(times)}`,
  )
}

export function createErrorLedger(): ErrorLedger {
  const expectations: ErrorExpectation[] = []
  // Errors that arrived before any expectation could consume them, in
  // arrival order
  const unconsumed: string[] = []

  function hasCapacity(expectation: ErrorExpectation): boolean {
    return expectation.matched < capacityOf(expectation.times)
  }

  return {
    record(text) {
      const expectation = expectations.find(
        (candidate) => hasCapacity(candidate) && candidate.pattern.test(text),
      )
      if (expectation === undefined) {
        unconsumed.push(text)
        return
      }
      expectation.matched += 1
    },
    expect(pattern, options) {
      const expectation: ErrorExpectation = {
        pattern: stablePattern(pattern),
        times: declaredTimes(options),
        matched: 0,
      }
      // Errors that already arrived belong to this expectation when they
      // match: consume them before the test body continues.
      while (hasCapacity(expectation)) {
        const index = unconsumed.findIndex((text) => expectation.pattern.test(text))
        if (index === -1) {
          break
        }
        unconsumed.splice(index, 1)
        expectation.matched += 1
      }
      expectations.push(expectation)
    },
    verdict() {
      return {
        unexpected: [...unconsumed],
        unmet: expectations
          .filter((expectation) => {
            const satisfied =
              expectation.times === 'one-or-more'
                ? expectation.matched >= 1
                : expectation.matched === expectation.times
            return !satisfied
          })
          .map(expectationLabel),
      }
    },
  }
}
