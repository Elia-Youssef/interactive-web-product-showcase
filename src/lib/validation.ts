// The one validation-issue logic every schema boundary shares: the parse
// with the boundary's default messages, field path formatting and the
// mapping of zod issues to structured (path, message) form. Pure: no React,
// no three, nothing else from src/.
import type { z } from 'zod/mini'
import { en } from 'zod/locales'

// The default messages of every rule that names no error of its own: zod's
// English locale, the messages the classic zod entry prints. The functional
// core ships none, and the locale is passed with each parse instead of being
// installed in zod's process-wide configuration, so the boundary's messages
// never depend on what else configured zod first.
const englishMessages = en().localeError

// Parses at a validation boundary, with the default messages above.
export function parseWithMessages<Schema extends z.ZodMiniType>(
  schema: Schema,
  raw: unknown,
): z.core.util.SafeParseResult<z.output<Schema>> {
  return schema.safeParse(raw, { error: englishMessages })
}

export type ValidationIssue = {
  path: string
  message: string
}

// Paths render object keys with a dot and array positions with brackets:
// ['hotspots', 1, 'bullets'] becomes 'hotspots[1].bullets'.
export function formatFieldPath(path: readonly PropertyKey[]): string {
  let rendered = ''
  for (const key of path) {
    if (typeof key === 'number') {
      rendered += `[${key}]`
    } else {
      rendered += rendered === '' ? String(key) : `.${String(key)}`
    }
  }
  return rendered
}

const UNKNOWN_KEY_MESSAGE = 'unknown key'

// Maps zod issues to the structured (path, message) form the errors carry.
// An unrecognized key reports once per key, with the key appended to the path.
export function issuesFromZod(issues: readonly z.core.$ZodIssue[]): ValidationIssue[] {
  const mapped: ValidationIssue[] = []
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        mapped.push({ path: formatFieldPath([...issue.path, key]), message: UNKNOWN_KEY_MESSAGE })
      }
      continue
    }
    mapped.push({ path: formatFieldPath(issue.path), message: issue.message })
  }
  return mapped
}
