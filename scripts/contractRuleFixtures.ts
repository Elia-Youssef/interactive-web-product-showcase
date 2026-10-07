// The rule table's fixture input: the manifest the contract rule fixtures
// run against, parsed through the real schema, and the input assembled over
// a fixture document. One place builds what every rule suite reads.
import type { Document } from '@gltf-transform/core'
import { parseProduct } from '../src/lib/product/index.ts'
import { readContractModelFacts } from './contractFacts.ts'
import { readProductStructure } from './structure.ts'
import type { ContractRuleInput } from './contractRules.ts'
import { cameraContract } from './validateFixtures.ts'

// The manifest the contract rule fixtures run against: the fixture
// document's own hotspots and finishes, so the default document is the
// passing case of every rule.
const RULE_FIXTURE_INPUT = {
  slug: 'fixture-speaker',
  number: 2,
  category: 'Audio',
  brand: 'Sample',
  model: 'Speaker',
  eyebrow: 'Compact speaker / 002',
  tagline: 'A quiet box that fills the room.',
  intro: ['One line.'],
  finishes: [
    { variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' },
    { variant: 'graphite', label: 'Graphite', swatch: '#2B2E2C' },
  ],
  hotspots: [
    {
      id: 'driver',
      eyebrow: 'A closer look',
      title: 'Full-range driver',
      bullets: ['Behind the grille'],
    },
    {
      id: 'knob',
      eyebrow: 'On top',
      title: 'Volume knob',
      bullets: ['Machined aluminum'],
    },
  ],
  explode: { clip: 'Explode', label: 'See inside' },
} as const

// The rule table's input over a fixture document: the parsed fixture
// manifest, the document's structure and contract facts, and the real
// camera contract bridge.
export function contractRuleInputOf(doc: Document): ContractRuleInput {
  return {
    manifest: parseProduct(RULE_FIXTURE_INPUT, 'fixture'),
    structure: readProductStructure(doc),
    facts: readContractModelFacts(doc),
    contract: cameraContract,
  }
}

// The manifest of the rule fixtures, with the camera block a case sets.
export function ruleFixtureManifest(camera?: { minDistance?: number; maxDistance?: number }) {
  return parseProduct({ ...RULE_FIXTURE_INPUT, camera }, 'fixture')
}
