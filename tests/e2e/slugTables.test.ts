// The per-product tables of the e2e support, held to the product set their
// consumer iterates, in both directions: a product without a row fails the
// spec that reads it, and a row for a product that left the set is dead
// weight that outlives the product. Each table registers here with the set
// it must match, and a missing row and a stale row both fail naming the
// table and the slug.
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { listFixtureProductSlugs } from '../../scripts/fixtureProducts.ts'
import { listShippedSlugs } from '../../scripts/shippedProducts.ts'
import { environmentParityBaselines } from './environmentParityBaselines'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

// The product sets a table can belong to: the shipped collection, or the
// harness set (the shipped collection plus the fixture products), as the
// specs that load them iterate.
type ProductSet = 'shipped' | 'harness'

async function slugsOf(set: ProductSet): Promise<string[]> {
  const shipped = await listShippedSlugs(ROOT)
  switch (set) {
    case 'shipped':
      return shipped
    case 'harness':
      return [...shipped, ...(await listFixtureProductSlugs(ROOT))].sort()
  }
}

// One slug-keyed table: its name for the failure message, its keys, and the
// set its consumer iterates.
type SlugTable = {
  readonly name: string
  readonly keys: readonly string[]
  readonly set: ProductSet
}

// Every slug-keyed table of the e2e support. A new one is added here.
const SLUG_TABLES: readonly SlugTable[] = [
  {
    name: 'environmentParityBaselines',
    keys: Object.keys(environmentParityBaselines),
    set: 'shipped',
  },
]

// What a table gets wrong against the set it must match: one message per
// missing row and per stale row, naming the table and the slug.
function slugTableProblems(table: SlugTable, slugs: readonly string[]): string[] {
  const keys = new Set(table.keys)
  const expected = new Set(slugs)
  return [
    ...slugs
      .filter((slug) => !keys.has(slug))
      .map((slug) => `${table.name}: no row for '${slug}' of the ${table.set} products`),
    ...table.keys
      .filter((key) => !expected.has(key))
      .map((key) => `${table.name}: stale row '${key}', not in the ${table.set} products`),
  ]
}

describe('slugTableProblems', () => {
  const table: SlugTable = { name: 'sample', keys: ['a', 'b'], set: 'shipped' }

  it('is empty when the keys equal the set', () => {
    expect(slugTableProblems(table, ['b', 'a'])).toEqual([])
  })

  it('names a missing row and a stale row, each with the table and the slug', () => {
    expect(slugTableProblems(table, ['a', 'c'])).toEqual([
      "sample: no row for 'c' of the shipped products",
      "sample: stale row 'b', not in the shipped products",
    ])
  })
})

describe('the slug-keyed tables of the e2e support', () => {
  it.each(SLUG_TABLES.map((table) => [table.name, table] as const))(
    '%s holds exactly the products of its set',
    async (_name, table) => {
      expect(slugTableProblems(table, await slugsOf(table.set))).toEqual([])
    },
  )
})
