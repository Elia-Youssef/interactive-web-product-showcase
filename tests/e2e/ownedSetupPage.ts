import { observePageErrors } from './pageErrors'

type SetupPage = Parameters<typeof observePageErrors>[0] & { close(): Promise<unknown> }

// A setup page has the same error contract as a fixture page, including
// errors emitted during navigation and asynchronous console argument reads.
export async function withOwnedSetupPage<P extends SetupPage, T>(
  browser: { newPage(): Promise<P> },
  read: (page: P) => Promise<T>,
): Promise<T> {
  const page = await browser.newPage()
  try {
    const observer = observePageErrors(page)
    const result = await Promise.resolve()
      .then(() => read(page))
      .then(
        (value) => ({ kind: 'read' as const, value }),
        (cause: unknown) => ({ kind: 'failed' as const, cause }),
      )
    await observer.stop()
    const verdict = observer.ledger.verdict()
    if (verdict.unexpected.length > 0 || verdict.unmet.length > 0) {
      throw new AggregateError(
        result.kind === 'failed' ? [result.cause] : [],
        `setup page error gate: ${[...verdict.unexpected, ...verdict.unmet].join('\n')}`,
      )
    }
    if (result.kind === 'failed') throw result.cause
    return result.value
  } finally {
    await page.close()
  }
}
