import { execFixtureFile } from '../tooling/subprocess.fixtures.ts'
import { resolveGltfCliBin } from './gltfCli.ts'

export function runFixtureGltfCli(args: readonly string[]) {
  return execFixtureFile(process.execPath, [resolveGltfCliBin(), ...args])
}
