// The boundary's default messages through the functional core, in a module
// graph that never loads the classic zod entry (see the fixtures).
import { z } from 'zod/mini'
import { describe, expect, it } from 'vitest'
import { parseWithMessages } from './validation'
import { defaultMessageRows, firstMessage, type MessageKind } from './validationMessages.fixtures'

const lowercase = /^[a-z]+$/

const schemas: Record<MessageKind, z.ZodMiniType> = {
  invalid_type: z.string(),
  invalid_type_missing_key: z.strictObject({ label: z.string() }),
  too_small_array: z.array(z.string()).check(z.minLength(2)),
  too_big_array: z.array(z.string()).check(z.maxLength(1)),
  too_small_positive: z.number().check(z.positive()),
  invalid_value: z.enum(['sage', 'graphite']),
  invalid_format: z.string().check(z.regex(lowercase)),
  not_multiple_of: z.number().check(z.multipleOf(2)),
  unrecognized_keys: z.strictObject({}),
  invalid_union: z.union([z.string(), z.number()]),
  custom: z.number().check(z.refine((value) => value > 1)),
}

describe('the validation boundary messages', () => {
  for (const row of defaultMessageRows) {
    it(`prints the classic message for ${row.kind}`, () => {
      expect(firstMessage(parseWithMessages(schemas[row.kind], row.input))).toBe(row.message)
    })
  }

  it("keeps a rule's own message over the default", () => {
    const named = z.string().check(z.regex(lowercase, { error: 'expected lowercase letters' }))
    expect(firstMessage(parseWithMessages(named, 'A'))).toBe('expected lowercase letters')
  })

  it("leaves zod's process-wide configuration without a locale", () => {
    expect(firstMessage(z.string().safeParse(5))).toBe('Invalid input')
  })
})
