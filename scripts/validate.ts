// The validate step: checks every shipped product model against its
// manifest and the budgets, so a broken export or manifest fails the gate
// naming the product and the problem.
//
//   pnpm assets:validate            validate every shipped product
//   pnpm assets:validate <slug>     validate one product
//
// Products are discovered in both directions: the union of
// the public/models folders and the src/products/<slug>.manifest.ts files.
// Either half alone still names the product, and its missing side is that
// product's violation. The step reads committed models only, so it runs
// identically in a fresh clone. Exit is non-zero on any violation; warnings
// never fail the gate.
import { fileURLToPath } from 'node:url'
import { loadParseProduct } from './manifestIo.ts'
import { productPaths, repoPath } from './productPaths.ts'
import { listShippedSlugs } from './shippedProducts.ts'
import { validateShippedProduct } from './validateProduct.ts'
import { countViolations, type ProductValidation } from './validateChecks.ts'
import { formatProductReport, formatRunSummary } from './validateReport.ts'

// The repo root: the parent of the scripts folder this file lives in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

function writeLine(text: string): void {
  process.stdout.write(`${text}\n`)
}

function writeError(text: string): void {
  process.stderr.write(`${text}\n`)
}

async function resolveSlugs(argv: readonly string[]): Promise<string[]> {
  if (argv.length === 0) {
    return listShippedSlugs(ROOT)
  }
  if (argv.length === 1) {
    const slug = argv[0] ?? ''
    const slugs = await listShippedSlugs(ROOT)
    if (!slugs.includes(slug)) {
      const paths = productPaths(ROOT, slug)
      throw new Error(
        `No shipped product '${slug}': expected the model of ` +
          `${repoPath(ROOT, paths.modelGlb)} or the manifest of ` +
          `${repoPath(ROOT, paths.manifestFile)}`,
      )
    }
    return [slug]
  }
  throw new Error(`Usage: pnpm assets:validate [slug] (got ${argv.length} arguments)`)
}

export async function main(argv: readonly string[]): Promise<void> {
  const slugs = await resolveSlugs(argv)
  const parseProduct = await loadParseProduct()
  const validations: ProductValidation[] = []
  for (const slug of slugs) {
    validations.push(await validateShippedProduct(ROOT, slug, parseProduct))
  }
  for (const validation of validations) {
    writeLine(formatProductReport(validation))
  }
  writeLine(formatRunSummary(validations))
  const violations = validations.reduce((sum, validation) => sum + countViolations(validation), 0)
  if (violations > 0) {
    process.exitCode = 1
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  writeError(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
