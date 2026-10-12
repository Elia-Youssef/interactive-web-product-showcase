// One contract for every choice-valued environment setting: unset falls back
// to the default, a set value must be one of the listed choices, and one
// mistake throws one message naming the variable, the choices and the raw
// value. It stays pure (an env record in, a choice out, no Node APIs) so any
// tool config can import it, the sibling of the integer contract.
export interface EnvChoice<Choice extends string> {
  variable: string
  default: Choice
  choices: readonly Choice[]
}

export function resolveEnvChoice<Choice extends string>(
  setting: EnvChoice<Choice>,
  env: Record<string, string | undefined>,
): Choice {
  const raw = env[setting.variable]
  if (raw === undefined) {
    return setting.default
  }
  const choice = setting.choices.find((candidate) => candidate === raw)
  if (choice === undefined) {
    throw new Error(
      `${setting.variable} must be one of ${setting.choices.join(', ')}, but got "${raw}"`,
    )
  }
  return choice
}
