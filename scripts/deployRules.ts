// The deploy check of the built site, as pure logic: the list of files in
// dist/ and the text of its _headers file go in, findings come out. The
// host serves p/<slug>.html for /p/<slug> (an index.html in a folder would be
// redirected to a trailing slash, and the canonical URLs have none), takes
// its cache rules from _headers, and must not find a top-level 404.html,
// which would replace the app for unknown paths. The runner that lists the
// real dist/ is scripts/deployCheck.ts.
import { isHashedName } from '../tooling/outputNaming.ts'
import { checkCrawlFiles, type CrawlInput, type CrawlFinding } from './deployCrawl.ts'
import { checkSecurityHeaders, type SecurityFinding } from './deploySecurity.ts'

// Where a product's prerendered route file sits inside dist/, by slug.
export function routeFilePath(slug: string): string {
  return `p/${slug}.html`
}

// The build's per-product outputs, each naming its product by slug: the
// model folder the public folder copies, the prerendered route file, and
// the social card. Every one of them must belong to a shipped product, so a
// test-only product can never reach the deploy.
const PRODUCT_OUTPUT_SHAPES: readonly RegExp[] = [
  /^models\/([^/]+)\//,
  /^p\/([^/]+)\.html$/,
  /^social\/([^/]+)\.png$/,
]

// The slug a dist-relative file is the per-product output of, or null when
// it is no per-product output.
export function productOfOutput(file: string): string | null {
  for (const shape of PRODUCT_OUTPUT_SHAPES) {
    const slug = shape.exec(file)?.[1]
    if (slug !== undefined) {
      return slug
    }
  }
  return null
}

// The folder layout the route files must not use.
function oldRouteFilePath(slug: string): string {
  return `p/${slug}/index.html`
}

export type HeaderRule = {
  // The 1-based line of the path pattern in the _headers text.
  readonly line: number
  readonly pattern: string
  readonly headers: readonly { readonly name: string; readonly value: string }[]
}

export type DeployFinding =
  | CrawlFinding
  | SecurityFinding
  | { readonly kind: 'badRule'; readonly line: number; readonly detail: string }
  | { readonly kind: 'unhashedImmutable'; readonly file: string; readonly rule: string }
  | { readonly kind: 'staleRule'; readonly rule: string }
  | {
      readonly kind: 'overlappingRules'
      readonly file: string
      readonly header: string
      readonly rules: readonly string[]
    }
  | { readonly kind: 'topLevel404'; readonly file: string }
  | { readonly kind: 'missingRouteFile'; readonly slug: string; readonly file: string }
  | { readonly kind: 'oldRouteLayout'; readonly slug: string; readonly file: string }
  | { readonly kind: 'unshippedProductOutput'; readonly slug: string; readonly file: string }

type MutableRule = { line: number; pattern: string; headers: { name: string; value: string }[] }

// The _headers format: a path pattern on an unindented line, its headers as
// indented `Name: value` lines below, `#` comments, blank lines ignored. A
// pattern holds at most one `*` splat.
export function parseHeaders(text: string): {
  rules: HeaderRule[]
  findings: DeployFinding[]
} {
  const rules: MutableRule[] = []
  const findings: DeployFinding[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((raw, index) => {
    const line = index + 1
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) {
      return
    }
    if (!/^\s/.test(raw)) {
      const pattern = raw.trim()
      if (!pattern.startsWith('/')) {
        findings.push({
          kind: 'badRule',
          line,
          detail: `the path pattern '${pattern}' must start with /`,
        })
      } else if (pattern.split('*').length > 2) {
        findings.push({
          kind: 'badRule',
          line,
          detail: `the path pattern '${pattern}' has more than one *`,
        })
      }
      rules.push({ line, pattern, headers: [] })
      return
    }
    const current = rules.at(-1)
    const separator = raw.indexOf(':')
    if (current === undefined || separator < 1) {
      findings.push({
        kind: 'badRule',
        line,
        detail: `'${raw.trim()}' is not a header line of a rule`,
      })
      return
    }
    current.headers.push({
      name: raw.slice(0, separator).trim(),
      value: raw.slice(separator + 1).trim(),
    })
  })
  return { rules, findings }
}

// Whether a rule's pattern covers a dist-relative file. The splat matches
// any run of characters, slashes included.
export function ruleMatches(pattern: string, file: string): boolean {
  const target = `/${file}`
  const [head = '', tail] = pattern.split('*')
  if (tail === undefined) {
    return pattern === target
  }
  return (
    target.length >= head.length + tail.length && target.startsWith(head) && target.endsWith(tail)
  )
}

function setsImmutable(rule: HeaderRule): boolean {
  return rule.headers.some(
    (header) =>
      header.name.toLowerCase() === 'cache-control' && /\bimmutable\b/i.test(header.value),
  )
}

export type DeployInput = {
  // Every file of dist/, relative to it, with forward slashes.
  readonly files: readonly string[]
  readonly headersText: string
  // The slugs of the products that carry a meta block.
  readonly metaSlugs: readonly string[]
  // The slugs of the shipped products, the only ones a per-product output
  // may name.
  readonly shippedSlugs: readonly string[]
  readonly crawl: CrawlInput
}

export function checkDeploy(input: DeployInput): DeployFinding[] {
  const { rules, findings } = parseHeaders(input.headersText)
  const fileSet = new Set(input.files)

  const matched = new Map<string, HeaderRule[]>()
  for (const rule of rules) {
    const hits = input.files.filter((file) => ruleMatches(rule.pattern, file))
    if (hits.length === 0) {
      findings.push({ kind: 'staleRule', rule: rule.pattern })
    }
    for (const file of hits) {
      matched.set(file, [...(matched.get(file) ?? []), rule])
      if (setsImmutable(rule) && !isHashedName(file)) {
        findings.push({ kind: 'unhashedImmutable', file, rule: rule.pattern })
      }
    }
  }

  for (const [file, fileRules] of matched) {
    const owners = new Map<string, string[]>()
    for (const rule of fileRules) {
      for (const name of new Set(rule.headers.map((header) => header.name.toLowerCase()))) {
        owners.set(name, [...(owners.get(name) ?? []), rule.pattern])
      }
    }
    for (const [header, patterns] of owners) {
      if (patterns.length > 1) {
        findings.push({ kind: 'overlappingRules', file, header, rules: patterns })
      }
    }
  }

  if (fileSet.has('404.html')) {
    findings.push({ kind: 'topLevel404', file: '404.html' })
  }
  for (const slug of input.metaSlugs) {
    const file = routeFilePath(slug)
    if (!fileSet.has(file)) {
      findings.push({ kind: 'missingRouteFile', slug, file })
    }
    const old = oldRouteFilePath(slug)
    if (fileSet.has(old)) {
      findings.push({ kind: 'oldRouteLayout', slug, file: old })
    }
  }
  findings.push(...unshippedOutputs(input))
  findings.push(...checkSecurityHeaders(rules), ...checkCrawlFiles(input.crawl, fileSet))
  return findings
}

// The per-product outputs that name no shipped product.
function unshippedOutputs(input: DeployInput): DeployFinding[] {
  const shipped = new Set(input.shippedSlugs)
  return input.files.flatMap((file): DeployFinding[] => {
    const slug = productOfOutput(file)
    return slug !== null && !shipped.has(slug)
      ? [{ kind: 'unshippedProductOutput', slug, file }]
      : []
  })
}

export function describeFinding(finding: DeployFinding): string {
  switch (finding.kind) {
    case 'requiredSecurityHeader':
      return `_headers ${finding.header}: ${finding.detail}`
    case 'missingCrawlFile':
      return `dist/${finding.file} is missing`
    case 'invalidRobots':
      return 'dist/robots.txt must allow all paths and name the site sitemap'
    case 'invalidSitemap':
      return 'dist/sitemap.xml is malformed'
    case 'straySitemapUrl':
      return `dist/sitemap.xml stray URL '${finding.url}': not a built route on the site host`
    case 'missingSitemapUrl':
      return `dist/sitemap.xml is missing the built route '${finding.url}'`
    case 'duplicateSitemapUrl':
      return `dist/sitemap.xml repeats '${finding.url}'`
    case 'badRule':
      return `_headers line ${finding.line}: ${finding.detail}`
    case 'unhashedImmutable':
      return `dist/${finding.file} is marked immutable by the rule '${finding.rule}' but has no content hash in its name`
    case 'staleRule':
      return `the _headers rule '${finding.rule}' matches no file in dist/`
    case 'overlappingRules':
      return `dist/${finding.file} is matched by ${finding.rules.map((rule) => `'${rule}'`).join(' and ')}, which both set ${finding.header}`
    case 'topLevel404':
      return `dist/${finding.file} exists: unknown paths would no longer reach the app`
    case 'missingRouteFile':
      return `dist/${finding.file} is missing for the product '${finding.slug}'`
    case 'oldRouteLayout':
      return `dist/${finding.file} exists for the product '${finding.slug}': route files are p/<slug>.html`
    case 'unshippedProductOutput':
      return `dist/${finding.file} belongs to '${finding.slug}', which is no shipped product`
  }
}
