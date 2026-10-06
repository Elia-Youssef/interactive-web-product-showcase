// One contract for every integer-valued environment setting: unset falls
// back to the default, a set value must be a plain decimal integer inside
// the range, and one mistake throws one message naming the variable, the
// allowed range and the raw value. It stays pure (an env record in, a number
// out, no Node APIs) so any tool config can import it.
export interface EnvInteger {
  variable: string
  default: number
  min: number
  max: number
}

// Number() accepts more than these settings ever mean: surrounding spaces,
// hex like 0x14AB, exponent forms. The shape is pinned first, so only plain
// decimal digits reach the range check.
const integerShape = /^\d+$/

export function resolveEnvInteger(
  setting: EnvInteger,
  env: Record<string, string | undefined>,
): number {
  const raw = env[setting.variable]
  if (raw === undefined) {
    return setting.default
  }
  // One mistake, one message: a value outside the range, or not a plain
  // decimal number at all, fails right here. An empty value errors too,
  // instead of silently falling back to the default.
  const value = integerShape.test(raw) ? Number(raw) : Number.NaN
  if (Number.isNaN(value) || value < setting.min || value > setting.max) {
    throw new Error(
      `${setting.variable} must be an integer from ${setting.min} to ${setting.max}, but got "${raw}"`,
    )
  }
  return value
}
