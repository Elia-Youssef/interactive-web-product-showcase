// The default messages the validation boundary reports, one row per zod
// issue kind: the input that raises it and the message the classic zod
// entry prints for it. The boundary's own test parses each row through the
// functional core, and a second test file parses it through the classic
// entry, each in a module graph of its own: the classic entry installs its
// locale in zod's process-wide configuration when imported, which would
// otherwise hide a boundary that passes none.

export type MessageKind =
  | 'invalid_type'
  | 'invalid_type_missing_key'
  | 'too_small_array'
  | 'too_big_array'
  | 'too_small_positive'
  | 'invalid_value'
  | 'invalid_format'
  | 'not_multiple_of'
  | 'unrecognized_keys'
  | 'invalid_union'
  | 'custom'

export type MessageRow = {
  readonly kind: MessageKind
  readonly input: unknown
  readonly message: string
}

export const defaultMessageRows: readonly MessageRow[] = [
  {
    kind: 'invalid_type',
    input: 5,
    message: 'Invalid input: expected string, received number',
  },
  {
    kind: 'invalid_type_missing_key',
    input: {},
    message: 'Invalid input: expected string, received undefined',
  },
  { kind: 'too_small_array', input: ['a'], message: 'Too small: expected array to have >=2 items' },
  {
    kind: 'too_big_array',
    input: ['a', 'b'],
    message: 'Too big: expected array to have <=1 items',
  },
  { kind: 'too_small_positive', input: 0, message: 'Too small: expected number to be >0' },
  {
    kind: 'invalid_value',
    input: 'red',
    message: 'Invalid option: expected one of "sage"|"graphite"',
  },
  {
    kind: 'invalid_format',
    input: 'A',
    message: 'Invalid string: must match pattern /^[a-z]+$/',
  },
  { kind: 'not_multiple_of', input: 3, message: 'Invalid number: must be a multiple of 2' },
  { kind: 'unrecognized_keys', input: { extra: 1 }, message: 'Unrecognized key: "extra"' },
  { kind: 'invalid_union', input: true, message: 'Invalid input' },
  { kind: 'custom', input: 1, message: 'Invalid input' },
]

// The first issue's message of a parse result, for either zod entry.
export function firstMessage(result: {
  readonly error?: { readonly issues: readonly { readonly message: string }[] }
}): string | undefined {
  return result.error?.issues[0]?.message
}
