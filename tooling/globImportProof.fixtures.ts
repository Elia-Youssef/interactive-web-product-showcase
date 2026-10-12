import { globCalls } from './globCalls.ts'

export { globCalls } from './globCalls.ts'
export { viteGlobTargets } from './globExpanders.ts'

export function globCall(argumentsCode: string) {
  const call = globCalls(`import.meta.glob(${argumentsCode})`)[0]
  if (call === undefined) throw new Error('the probe contained no glob call')
  return call
}
