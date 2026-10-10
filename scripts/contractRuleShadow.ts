import type { ContractRule } from './contractRules.ts'
import { defineContractRule } from './contractRule.ts'
import { measureShadowFootprint, type ShadowMeasure } from './shadowFootprint.ts'
import type { ShadowFacts } from './shadowFacts.ts'
import { SHADOW_SETTINGS, SHIPPED_FIT_TOLERANCE_TEXELS } from './shadowSettings.ts'

function measured(facts: ShadowFacts): ShadowMeasure | null {
  return facts.kind === 'problem'
    ? null
    : measureShadowFootprint(facts.grid, facts.plane, {
        ...SHADOW_SETTINGS,
        fitToleranceTexels: SHIPPED_FIT_TOLERANCE_TEXELS,
      })
}

export const shadowRules: readonly ContractRule[] = [
  defineContractRule({
    key: 'shadow-alpha-clear-at-border',
    group: 'model',
    needs: ['shadow'],
    check: ({ shadow }) => {
      const measure = measured(shadow)
      return {
        violations:
          measure !== null && !measure.unclipped
            ? [
                `SHADOW border alpha ${measure.edgeAlpha.toFixed(6)} exceeds threshold ${SHADOW_SETTINGS.alphaThreshold} by ${(measure.edgeAlpha - SHADOW_SETTINGS.alphaThreshold).toFixed(6)}`,
              ]
            : [],
        warnings: [],
      }
    },
  }),
  defineContractRule({
    key: 'shadow-footprint-fits-plane',
    group: 'model',
    needs: ['shadow'],
    check: ({ shadow }) => {
      const measure = measured(shadow)
      const warnings =
        shadow.kind === 'problem'
          ? [`cannot measure SHADOW footprint: ${shadow.reason}`]
          : measure === null || measure.fits
            ? []
            : sideWarnings(measure)
      return { violations: [], warnings }
    },
  }),
]

function sideWarnings(measure: ShadowMeasure): string[] {
  const warnings: string[] = []
  for (const axis of ['x', 'y'] as const) {
    for (const side of [0, 1] as const) {
      const differenceM = measure.sideDifferencesM[axis][side]
      const differenceTexels = differenceM / measure.texelM[axis]
      if (Math.abs(differenceM) > SHIPPED_FIT_TOLERANCE_TEXELS * measure.texelM[axis]) {
        warnings.push(
          `SHADOW ${axis} ${side === 0 ? 'low' : 'high'} side differs from alpha plus ${SHADOW_SETTINGS.padM} m pad by ${differenceM.toFixed(6)} m (${differenceTexels.toFixed(3)} texels), limit ${SHIPPED_FIT_TOLERANCE_TEXELS} texels`,
        )
      }
    }
  }
  return warnings
}
