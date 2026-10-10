import type { ViewerLoads } from '../automation/viewerAutomation'

type ModelOwner = { report(): ViewerLoads }

// A stage observes every canvas owner until its decoder leases drain,
// including obsolete work while a replacement canvas is already active.
export class StageModelOwners {
  private readonly owners = new Set<ModelOwner>()

  register(owner: ModelOwner): () => void {
    if (this.owners.has(owner)) {
      throw new Error('the model load owner is already registered')
    }
    this.owners.add(owner)
    return () => {
      if (!this.owners.delete(owner)) {
        throw new Error('the model load owner was released twice')
      }
    }
  }

  report(): ViewerLoads {
    const models: string[] = []
    const bytes: string[] = []
    let settling = 0
    for (const owner of this.owners) {
      const report = owner.report()
      models.push(...report.models)
      bytes.push(...report.bytes)
      settling += report.settling
    }
    return { models, bytes, settling }
  }
}
