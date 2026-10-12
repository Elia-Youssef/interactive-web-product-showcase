// The pinned default messages are the classic zod entry's own, parsed in a
// module graph of their own (see the fixtures).
import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { defaultMessageRows, firstMessage, type MessageKind } from './validationMessages.fixtures'

const schemas: Record<MessageKind, z.ZodType> = {
  invalid_type: z.string(),
  invalid_type_missing_key: z.strictObject({ label: z.string() }),
  too_small_array: z.array(z.string()).min(2),
  too_big_array: z.array(z.string()).max(1),
  too_small_positive: z.number().positive(),
  invalid_value: z.enum(['sage', 'graphite']),
  invalid_format: z.string().regex(/^[a-z]+$/),
  not_multiple_of: z.number().multipleOf(2),
  unrecognized_keys: z.strictObject({}),
  invalid_union: z.union([z.string(), z.number()]),
  custom: z.number().refine((value) => value > 1),
}

describe('the classic zod entry', () => {
  for (const row of defaultMessageRows) {
    it(`prints the pinned message for ${row.kind}`, () => {
      expect(firstMessage(schemas[row.kind].safeParse(row.input))).toBe(row.message)
    })
  }
})
