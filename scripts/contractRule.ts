import type {
  AvailableContractRuleInput,
  ContractFact,
  ContractRule,
  ContractRuleGroup,
  ContractRuleInput,
  ContractRuleMessages,
} from './contractRules.ts'

// The declared dependencies constrain the check's type as well as its
// execution. A check cannot read facts it did not declare.
export function defineContractRule<Fact extends ContractFact>(rule: {
  readonly key: string
  readonly group: ContractRuleGroup
  readonly needs: readonly Fact[]
  readonly check: (input: Pick<ContractRuleInput, Fact>) => ContractRuleMessages
}): ContractRule {
  return {
    ...rule,
    evaluate: (input) => {
      if (hasFacts(input, rule.needs)) {
        return { kind: 'checked', messages: rule.check(input) }
      }
      return { kind: 'skipped', missing: rule.needs.filter((fact) => input[fact] === null) }
    },
  }
}

function hasFacts<Fact extends ContractFact>(
  input: AvailableContractRuleInput,
  needs: readonly Fact[],
): input is AvailableContractRuleInput & Pick<ContractRuleInput, Fact> {
  return needs.every((fact) => input[fact] !== null)
}
