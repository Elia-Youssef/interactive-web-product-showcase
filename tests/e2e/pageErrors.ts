import { consoleErrorText, pageErrorText } from './errorMessages.ts'
import type { ConsoleErrorMessage } from './errorMessages.ts'
import { createErrorLedger } from './errorLedger.ts'

type ConsoleErrorEvent = ConsoleErrorMessage & { type(): string }
type ErrorPage = {
  on(event: 'console', listener: (message: ConsoleErrorEvent) => void): unknown
  on(event: 'pageerror', listener: (error: Error) => void): unknown
  off(event: 'console', listener: (message: ConsoleErrorEvent) => void): unknown
  off(event: 'pageerror', listener: (error: Error) => void): unknown
}

type RecordedError = { kind: 'recorded' } | { kind: 'failed'; cause: unknown }

// Argument reads run asynchronously in the page. Every received error is
// held until it is recorded or its read fails; teardown drains the reads
// before asking the ledger for a verdict. A failed read fails the gate too.
export function observePageErrors(page: ErrorPage) {
  const ledger = createErrorLedger()
  const pending: Promise<RecordedError>[] = []

  const onConsole = (message: ConsoleErrorEvent): void => {
    if (message.type() !== 'error') {
      return
    }
    pending.push(
      consoleErrorText(message).then(
        (text) => {
          ledger.record(`console error: ${text}`)
          return { kind: 'recorded' }
        },
        (cause: unknown) => ({ kind: 'failed', cause }),
      ),
    )
  }
  const onPageError = (error: Error): void => {
    ledger.record(`page error: ${pageErrorText(error)}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  return {
    ledger,
    async stop(): Promise<void> {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      const results = await Promise.all(pending)
      const failed = results.filter((result) => result.kind === 'failed')
      if (failed.length > 0) {
        throw new AggregateError(
          failed.map((result) => result.cause),
          'the console gate could not read every received error',
        )
      }
    },
  }
}
