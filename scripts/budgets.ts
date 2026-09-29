// The per-product loading and performance budgets, defined once: the
// optimize defaults and the run report read
// them from here. The validate step extends this module with the
// draw-call budget.

// The largest model.glb a product may ship.
export const MODEL_BUDGET_BYTES = 4 * 1024 * 1024

// The largest edge of any texture a product may ship.
export const TEXTURE_MAX_SIZE_PX = 2048

// The largest number of draw calls a product may cost. A draw call is one
// mesh primitive instance in the scene: a mesh primitive rendered by one
// node, so a mesh shared by two nodes counts once per node. The validate
// step counts them with that definition (scripts/drawCalls.ts).
export const DRAW_CALLS_MAX = 50
