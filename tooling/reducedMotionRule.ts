// The reduced motion rule of src/, in one place for the lint configuration
// and its planted proof. The visitor's reduced motion preference has one
// owner module, which spells the media query; a second spelling anywhere
// else is a second preference that can drift out of the first. The rule
// reads string and template literals, the only places a query can be
// spelled for the browser, and matches the media feature's own name, in any
// case and whatever spacing surrounds it, and no other feature: the
// reduced data and reduced transparency features stay free.
import type { Rule } from 'eslint'

// The module that owns the preference, and its own test, which pins the
// query's value.
const ownerModule = 'src/lib/motion/reducedMotion.ts'
export const reducedMotionOwners = [ownerModule, 'src/lib/motion/reducedMotion.test.ts']

// The media feature's name, case-insensitive like CSS media features, and
// ended where a longer feature name would go on.
export const reducedMotionFeature = /prefers-reduced-motion(?![\w-])/i

export const reducedMotionQueryRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'The reduced motion media query is spelled only in its owner module' },
    schema: [],
    messages: {
      spelled: `The reduced motion media query is spelled only in its owner module (${ownerModule}); read the preference through it.`,
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && reducedMotionFeature.test(node.value)) {
          context.report({ node, messageId: 'spelled' })
        }
      },
      TemplateElement(node) {
        if (reducedMotionFeature.test(node.value.raw)) {
          context.report({ node, messageId: 'spelled' })
        }
      },
    }
  },
}
