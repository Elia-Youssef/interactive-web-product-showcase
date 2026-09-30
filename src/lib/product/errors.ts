// The typed errors of the product domain and the one formatter every error
// in this module shares. No zod here: the schema-facing mapping lives in
// parse.ts, and these types stay usable on their own by the UI's error state.

export type ProductIssue = {
  path: string
  message: string
}

export type CollectionProblem = {
  // The label of the manifest or product involved, or null when the problem
  // is about the collection itself.
  product: string | null
  // The field path inside that product, or null for collection-level problems.
  path: string | null
  message: string
}

// The slice of a zod refinement context the schema checks use, kept structural
// so the checks stay testable without zod.
export type IssueSink = {
  addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void
}

// Paths render object keys with a dot and array positions with brackets:
// ['hotspots', 1, 'bullets'] becomes 'hotspots[1].bullets'.
export function formatFieldPath(path: readonly PropertyKey[]): string {
  let rendered = ''
  for (const key of path) {
    if (typeof key === 'number') {
      rendered += `[${key}]`
    } else {
      rendered += rendered === '' ? String(key) : `.${String(key)}`
    }
  }
  return rendered
}

function formatIssueLine(issue: ProductIssue): string {
  return `- ${issue.path}: ${issue.message}`
}

export class ManifestError extends Error {
  // The product label the error is named by: the slug when it is valid,
  // otherwise the manifest's source.
  readonly label: string
  readonly issues: readonly ProductIssue[]

  constructor(label: string, issues: readonly ProductIssue[]) {
    super(`Invalid product manifest for '${label}':\n${issues.map(formatIssueLine).join('\n')}`)
    this.name = 'ManifestError'
    this.label = label
    this.issues = issues
  }
}

function formatProblemLine(problem: CollectionProblem): string {
  const product = problem.product === null ? '' : `${problem.product}: `
  const field = problem.path === null ? '' : `${problem.path}: `
  return `- ${product}${field}${problem.message}`
}

export class CollectionError extends Error {
  readonly problems: readonly CollectionProblem[]

  constructor(problems: readonly CollectionProblem[]) {
    super(`Invalid product collection:\n${problems.map(formatProblemLine).join('\n')}`)
    this.name = 'CollectionError'
    this.problems = problems
  }
}
