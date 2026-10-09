// The rule table's fixture input: the manifest the contract rule fixtures
// run against, parsed through the real schema, and the input assembled over
// a fixture document. One place builds what every rule suite reads.
import type { Document } from '@gltf-transform/core'
import { parseProduct } from '../src/lib/product/index.ts'
import { readContractModelFacts } from './contractFacts.ts'
import { readHomeFitFacts } from './homeFitFacts.ts'
import { readProductStructure } from './structure.ts'
import { deriveStorageBounds } from './storageBounds.ts'
import { declaredPositionStorage, declaredTranslationOutputs } from './storageFacts.ts'
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

// The manifest input of the rule fixtures under another slug: what a suite
// writes beside a planted model file, so the validate step reads a product
// whose words match the fixture document.
export function ruleFixtureManifestInputOf(slug: string) {
  return { ...RULE_FIXTURE_INPUT, slug }
}

// The rule table's input over a fixture document: the parsed fixture
// manifest, the document's structure, contract and home-fit facts, and the
// storage the fixture declares (an in-memory document stands for an
// optimized file, so its storage is declared, not read). The storage bounds
// are derived, never picked: the same derivation the validate step runs,
// so a rule suite holds its rules against the pipeline's own numbers.
export async function contractRuleInputOf(doc: Document): Promise<ContractRuleInput> {
  const structure = readProductStructure(doc)
  return {
    manifest: parseProduct(RULE_FIXTURE_INPUT, 'fixture'),
    structure,
    facts: readContractModelFacts(doc),
    homeFit: readHomeFitFacts(doc, structure.animationChannels),
    storage: {
      positions: declaredPositionStorage(doc),
      translationOutputs: declaredTranslationOutputs(doc),
    },
    storageBounds: await deriveStorageBounds(),
    contract: cameraContract,
  }
}

// The manifest of the rule fixtures, with the camera block a case sets.
export function ruleFixtureManifest(camera?: { minDistance?: number; maxDistance?: number }) {
  return parseProduct({ ...RULE_FIXTURE_INPUT, camera }, 'fixture')
}
