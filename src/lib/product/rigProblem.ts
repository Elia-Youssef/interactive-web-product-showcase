// One way a loaded model breaks the Blender contract the product rig is
// parsed against. The parse reports every problem at once, never only the
// first, so one export round is fixed in one pass. Pure data, so the store
// can carry it in the product's failure.
export type RigProblem = {
  // The contract node involved, when the problem names one.
  readonly node: string | null
  readonly message: string
}
