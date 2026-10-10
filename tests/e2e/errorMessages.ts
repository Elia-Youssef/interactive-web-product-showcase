// Browser probes show that Firefox renders a page-logged Error as "Error"
// even when its own name and message are correct. Read logged values in
// their page instead. Native browser errors have no arguments in the same
// probes (Chromium's failed resource load), so their text is the only content.
export type ConsoleErrorMessage = {
  args(): readonly { evaluate(render: (value: unknown) => string): Promise<string> }[]
  text(): string
}

export async function consoleErrorText(message: ConsoleErrorMessage): Promise<string> {
  const args = message.args()
  if (args.length === 0) {
    return message.text()
  }
  const values = await Promise.all(
    args.map((arg) =>
      arg.evaluate((value) =>
        value instanceof Error ? `${value.name}: ${value.message}` : String(value),
      ),
    ),
  )
  return values.join(' ')
}

// Rejection probes show WebKit wrapping the original "name: message" in
// a new error named "Unhandled Promise Rejection". Only that wrapper is
// unwrapped; a normal error's message can itself contain another error name.
function unwrapPromiseRejection(error: Pick<Error, 'name' | 'message'>) {
  const separator = error.message.indexOf(': ')
  if (error.name === 'Unhandled Promise Rejection' && separator > 0) {
    return {
      name: error.message.slice(0, separator),
      message: error.message.slice(separator + 2),
    }
  }
  return error
}

export function pageErrorText(error: Pick<Error, 'name' | 'message'>): string {
  const raised = unwrapPromiseRejection(error)
  return `${raised.name}: ${raised.message}`
}
