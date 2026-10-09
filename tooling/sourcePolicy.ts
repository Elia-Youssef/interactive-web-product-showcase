// The source policy plugin: rules about which files may exist under src/,
// what their sources may spell, and which files their globs may import.
// The extension lists come from extensions.ts, so the rule and every
// glob that scopes it read the same data.
import type { Rule } from 'eslint'
import { extensionOf, hasExtension, scriptExtensions, sourceExtensions } from './extensions.ts'
import { reducedMotionQueryRule } from './reducedMotionRule.ts'
import { createGlobTargetsRule } from './globTargetsRule.ts'
import type { GlobImportSource } from './globImports.ts'

const knownSourceExtension: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Only declared source extensions may exist under src/' },
    schema: [],
    messages: {
      unexpected: `Under src/ only ${sourceExtensions.join(' and ')} files exist; "{{extension}}" is not a source extension here (tooling/extensions.ts).`,
    },
  },
  create(context) {
    return {
      Program(node) {
        const file = context.filename ?? ''
        if (hasExtension(file, scriptExtensions) && !hasExtension(file, sourceExtensions)) {
          context.report({
            node,
            messageId: 'unexpected',
            data: { extension: `.${extensionOf(file)}` },
          })
        }
      },
    }
  },
}

export function createSourcePolicyPlugin(root: string, source: GlobImportSource) {
  return {
    rules: {
      'known-source-extension': knownSourceExtension,
      'reduced-motion-query': reducedMotionQueryRule,
      'glob-targets': createGlobTargetsRule(root, source),
    },
  }
}
