// The configuration prepares calls with the same parser the rule visits.
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { isGlobCall } from './globImports.ts'
import type { GlobCall } from './globImports.ts'
import { extensionGlob, scriptExtensions } from './extensions.ts'

export function globCalls(source: string, filename = 'glob.ts'): GlobCall[] {
  const calls: GlobCall[] = []
  const messages = new Linter().verify(
    source,
    [
      {
        files: [`**/*.${extensionGlob(scriptExtensions)}`],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: {
          glob: {
            rules: {
              calls: {
                create() {
                  return {
                    CallExpression(node) {
                      if (isGlobCall(node)) calls.push(node)
                    },
                  }
                },
              },
            },
          },
        },
        rules: { 'glob/calls': 'error' },
      },
    ],
    { filename },
  )
  if (messages.length > 0) throw new Error(JSON.stringify(messages))
  return calls
}
