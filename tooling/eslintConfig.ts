// The ESLint configuration as a factory over the repo root, so the planted
// lint trees run precisely these rules anchored at their own root. The root
// locates the package.json whose declared packages the layer gate trusts.
import js from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import type { Linter } from 'eslint'
import {
  extensionGlob,
  jsxExtensions,
  scriptExtensions,
  sourceExtensions,
  testFileGlob,
  testFileMarkers,
} from './extensions.ts'
import { layerConfigs } from './eslintLayers.ts'
import { sourcePolicyPlugin } from './sourcePolicy.ts'

const SCRIPT_GLOB = `**/*.${extensionGlob(scriptExtensions)}`
const SRC_SCRIPT_GLOB = `src/**/*.${extensionGlob(scriptExtensions)}`
const JSX_GLOB = `**/*.${extensionGlob(jsxExtensions)}`
const TEST_GLOB = testFileGlob(testFileMarkers, sourceExtensions)

// The extensions the import-x cycle rule must parse with the TypeScript
// parser: every source extension the gate accepts, derived, so a new source
// kind is parsable for cycles the moment the extension list admits it.
const TS_PARSER_EXTENSIONS = sourceExtensions.map((extension) => `.${extension}`)

// One options object feeds both resolver settings keys: import-x reads its own
// key, the boundaries plugin reads the classic one. Aliases come from the
// tsconfig the resolver discovers next to each linted file.
const tsResolverOptions = { alwaysTryTypes: true }

// Double assertion is the escape hatch the type checker cannot see through:
// x as unknown as T, x as never as T and their angle-bracket forms. One
// selector per nesting shape catches the whole family.
const doubleAssertionSelectors = [
  ['TSAsExpression', 'TSAsExpression'],
  ['TSAsExpression', 'TSTypeAssertion'],
  ['TSTypeAssertion', 'TSAsExpression'],
  ['TSTypeAssertion', 'TSTypeAssertion'],
].flatMap(([outer, inner]) =>
  ['TSUnknownKeyword', 'TSNeverKeyword'].map(
    (keyword) =>
      `${outer}[expression.type='${inner}'][expression.typeAnnotation.type='${keyword}']`,
  ),
)

function parserConfigs(): Linter.Config[] {
  return [
    {
      files: [SCRIPT_GLOB],
      languageOptions: { parser: tseslint.parser },
    },
    {
      files: [JSX_GLOB],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    },
    {
      files: ['src/**'],
      languageOptions: { globals: globals.browser },
    },
    {
      files: ['tooling/**', 'scripts/**', 'tests/**', '*.config.ts'],
      languageOptions: { globals: globals.node },
    },
  ]
}

function sharedRulesConfig(): Linter.Config {
  return {
    files: [SCRIPT_GLOB],
    // Only the rules are registered for react-hooks: the plugin's nested
    // config groups do not fit the flat Plugin shape, and this config owns
    // the wiring.
    plugins: { 'import-x': importX, 'react-hooks': { rules: reactHooks.rules } },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver(tsResolverOptions)],
      'import/resolver': { typescript: tsResolverOptions },
      // no-cycle parses the files it traverses, so it must know the TS parser
      // owns the source extensions.
      'import-x/parsers': { '@typescript-eslint/parser': TS_PARSER_EXTENSIONS },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],
      // disallowTypeAnnotations bans typeof import('...') and friends in type
      // space, so every cross-module type reference goes through an import
      // statement the layer gate can see.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: true },
      ],
      'no-restricted-syntax': [
        'error',
        ...doubleAssertionSelectors.map((selector) => ({
          selector,
          message:
            'Double assertion through unknown or never breaks type safety. Narrow the value at its source instead.',
        })),
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-empty-pattern': 'error',
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'import-x/no-cycle': 'error',
    },
  }
}

function srcPolicyConfig(): Linter.Config {
  return {
    files: [SRC_SCRIPT_GLOB],
    plugins: { 'source-policy': sourcePolicyPlugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Imports inside src/ carry no script extension; the root tool
      // configs keep theirs for the loaders that need them.
      'import-x/extensions': ['error', 'never'],
      'source-policy/known-source-extension': 'error',
    },
  }
}

// Test files are exempt from the function limit only: long arrange and
// assert bodies are the shape of a test. The file limit still applies.
function testExemptionConfig(): Linter.Config {
  return {
    files: [TEST_GLOB],
    rules: { 'max-lines-per-function': 'off' },
  }
}

// Fixture functions in the tests folder that deliberately take no fixtures
// still destructure an object: the test-runner convention for an empty
// dependency set. The relaxation stays in the folder, so production code
// keeps the plain rule above.
function testsFolderConfig(): Linter.Config {
  return {
    files: ['tests/**'],
    rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
  }
}

export function createConfig({ root }: { root: string }) {
  return defineConfig(
    ...parserConfigs(),
    js.configs.recommended,
    tseslint.configs.recommended,
    sharedRulesConfig(),
    srcPolicyConfig(),
    testExemptionConfig(),
    testsFolderConfig(),
    ...layerConfigs(root),
    // Formatting belongs to Prettier: every stylistic ESLint rule goes off.
    prettier,
  )
}
