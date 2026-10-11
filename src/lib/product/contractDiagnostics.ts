// Contract diagnostics shared by runtime readers, validation and evidence.
// Each caller owns the facts it collects; these sentences have one owner.
export function duplicateNodeNameMessage(name: string, count: number): string {
  return `Node name '${name}' appears ${count} times; the contract needs one node per name`
}

export function unknownMappingMaterialMessage(
  mappingIndex: number,
  material: number,
  materialCount: number,
): string {
  return `The mapping at ${mappingIndex} names material ${material}; the file carries ${materialCount}`
}

export function unknownMappingVariantMessage(
  mappingIndex: number,
  variant: unknown,
  variantCount: number,
): string {
  return typeof variant === 'number' && Number.isInteger(variant) && variant >= 0
    ? `The mapping at ${mappingIndex} names variant ${variant}; the file declares ${variantCount}`
    : `The mapping at ${mappingIndex} names the malformed variant ${String(variant)}`
}

export function invalidMappingMessage(mappingIndex: number): string {
  return `The mapping at ${mappingIndex} is not an object`
}

export function missingMappingMaterialMessage(mappingIndex: number): string {
  return `The mapping at ${mappingIndex} names no material`
}

export function missingMappingVariantMessage(mappingIndex: number): string {
  return `The mapping at ${mappingIndex} names no variant`
}

export function duplicateMappingVariantMessage(mappingIndex: number, variant: number): string {
  return `The mapping at ${mappingIndex} names variant ${variant} a second time`
}
