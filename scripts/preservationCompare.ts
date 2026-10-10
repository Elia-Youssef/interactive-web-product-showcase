import type { Document } from '@gltf-transform/core'
import { readPreservationFacts, type PreservationFacts } from './preservationReader.ts'
import {
  findStructureLosses,
  findSingleAnimationViolations,
  readProductStructure,
} from './structure.ts'
import { trackMatches } from './preservationAnimation.ts'
import type { PreservedMaterial } from './preservationMaterials.ts'

function equalNumbers(
  a: readonly number[],
  b: readonly number[],
  bounds: readonly number[] = [],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (value, index) =>
        Number.isFinite(value) &&
        Number.isFinite(b[index]) &&
        Math.abs(value - (b[index] ?? NaN)) <= (bounds[index % bounds.length] ?? 0),
    )
  )
}

function uniqueBy<T>(values: readonly T[], keyOf: (value: T) => string): Map<string, T> {
  const result = new Map<string, T>()
  for (const value of values) {
    const key = keyOf(value)
    if (result.has(key)) throw new Error(`ambiguous preservation identity ${key}`)
    result.set(key, value)
  }
  return result
}

function compareSets<T>(
  before: readonly T[],
  after: readonly T[],
  keyOf: (value: T) => string,
  matches: (a: T, b: T) => boolean,
  label: string,
): string[] {
  const a = uniqueBy(before, keyOf)
  const b = uniqueBy(after, keyOf)
  const losses: string[] = []
  for (const [key, value] of a) {
    const output = b.get(key)
    if (output === undefined || !matches(value, output)) losses.push(`${label} changed: ${key}`)
  }
  for (const key of b.keys()) if (!a.has(key)) losses.push(`${label} added: ${key}`)
  return losses
}

function materialMatches(
  before: PreservationFacts,
  input: PreservedMaterial,
  output: PreservedMaterial,
): boolean {
  if (input === null || output === null) return input === output
  if (input.signature !== output.signature) return false
  return (
    input.name === output.name ||
    before.materialAliases.some(
      (entry) => entry.name === input.name && entry.aliases.includes(output.name),
    )
  )
}

function primitivesMatch(
  before: PreservationFacts,
  a: PreservationFacts['primitives'][number],
  b: PreservationFacts['primitives'][number],
): boolean {
  if (
    !equalNumbers(a.bounds, b.bounds, a.positionBounds) ||
    !materialMatches(before, a.material, b.material)
  )
    return false
  return (
    compareSets(
      a.assignments,
      b.assignments,
      (mapping) => mapping.variant,
      (input, output) => materialMatches(before, input.material, output.material),
      'variant assignment',
    ).length === 0
  )
}

export function findSemanticLosses(before: PreservationFacts, after: PreservationFacts): string[] {
  return [
    ...compareSets(
      before.rests,
      after.rests,
      (rest) => rest.name,
      (a, b) =>
        equalNumbers(a.matrix, b.matrix) ||
        (b.quantized && a.encodedMatrix !== null && equalNumbers(a.encodedMatrix, b.matrix)),
      'world rest',
    ),
    ...compareSets(
      before.cameras,
      after.cameras,
      (camera) => camera.name,
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
      'camera ray or lens',
    ),
    ...compareSets(
      before.primitives,
      after.primitives,
      (primitive) => primitive.key,
      (a, b) => primitivesMatch(before, a, b),
      'primitive rest or assignment',
    ),
    ...compareSets(
      before.tracks,
      after.tracks,
      (track) => JSON.stringify([track.clip, track.target, track.path]),
      trackMatches,
      'animation channel',
    ),
  ]
}

export function readProductPreservation(doc: Document) {
  return { structure: readProductStructure(doc), semantics: readPreservationFacts(doc) }
}

export function findPreservationLosses(
  before: ReturnType<typeof readProductPreservation>,
  after: ReturnType<typeof readProductPreservation>,
): string[] {
  return [
    ...findStructureLosses(before.structure, after.structure),
    ...findSingleAnimationViolations(after.structure),
    ...findSemanticLosses(before.semantics, after.semantics),
  ]
}
