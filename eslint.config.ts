// The ESLint entrypoint for CLI and editor runs. The rules themselves live in
// tooling/eslintConfig.ts as a factory over the repo root; the planted lint
// trees call the same factory against their own roots.
import { createConfig } from './tooling/eslintConfig.ts'

export default createConfig({ root: import.meta.dirname })
