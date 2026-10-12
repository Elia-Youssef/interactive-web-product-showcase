import { expect, test } from 'vitest'
import {
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Scene,
  Vector2,
} from 'three/webgpu'
import { GLSLNodeBuilder, NodeFrame, UniformNode, WebGPURenderer } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { lights } from 'three/tsl'
import { markSceneMaterials } from './finishMaterials'

// The deterministic proof of the material-value crossing class. Two loaded
// materials that differ only in anisotropy strength must resolve their
// anisotropy to value nodes of their own, or the two programs sample one
// shared uniform that the later material's render update overwrites.
//
// The proof runs the renderer's own construction, not a model of it: both
// materials are built through the WebGL2 fallback's real node builder, the
// one the renderer constructs for a render object, and the per-render node
// updates run through three's real node frame, once per material, in draw
// order, for two renders. The graph the builder walks and the update
// dispatch are engine-shared code, so the value crossing they expose holds
// for both backends; the WebGPU drawing path is covered end to end by the
// settled-image e2e smoke.
//
// A browser global the node environment lacks: three's texture update
// compares the image against the ImageBitmap constructor. An inert class
// keeps the comparison on its browser path for data textures, where the
// answer is false either way.
;(globalThis as { ImageBitmap?: unknown }).ImageBitmap ??= class {}

type AnisotropyCarrier = MeshPhysicalMaterial & {
  anisotropyNode?: { value?: Vector2 }
}

// three's declarations end at the builder's inputs. The outputs the
// renderer's node manager consumes, the built graph and its per-render
// update list, are reached through the same structural widening the
// preparation itself uses for the classic material's node fields.
type ProgramBuilder = InstanceType<typeof GLSLNodeBuilder> & {
  readonly nodes: ReadonlySet<Node>
  readonly updateNodes: readonly Node[]
  scene: Scene | null
  camera: PerspectiveCamera | null
  lightsNode: unknown
  build(): void
}

// One anisotropic material of the parsed scene, in the form the loader
// hands the preparation: a classic physical material whose anisotropy the
// file authored as a strength and a rotation.
function anisotropicMaterial(strength: number): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({ anisotropy: strength, metalness: 1, roughness: 0.2 })
  material.anisotropyRotation = Math.PI / 2
  return material
}

// The one drawing-surface stand-in the renderer constructor wraps. A build
// walks the node graph and generates code; it never reaches the surface, and
// the canvas target reads only its size fields.
const drawingSurface = { width: 0, height: 0 } as HTMLCanvasElement | OffscreenCanvas

// One material's program as the renderer would build it: the mesh is built
// through the real node builder wired the way the renderer wires one for a
// render object of this scene, camera and light.
function buildProgram(
  mesh: Mesh,
  renderer: WebGPURenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  lightsNode: unknown,
): ProgramBuilder {
  const builder = new GLSLNodeBuilder(mesh, renderer) as ProgramBuilder
  builder.scene = scene
  builder.camera = camera
  builder.lightsNode = lightsNode
  builder.build()
  return builder
}

// The anisotropy value source of a built graph: a uniform node carrying a
// vec2, which is the polar anisotropy vector the generated code samples. A
// physical material graph holds exactly one, so a graph that holds another
// count fails the harness before it can report a value.
function isAnisotropySource(node: Node): node is UniformNode<'vec2', Vector2> {
  return node instanceof UniformNode && node.value instanceof Vector2
}

function anisotropySourceOf(builder: ProgramBuilder): UniformNode<'vec2', Vector2> {
  const sources = [...builder.nodes].filter(isAnisotropySource)
  const [source] = sources
  if (sources.length !== 1 || source === undefined) {
    throw new Error(
      `a built physical material graph holds ${sources.length} vec2 uniforms, expected the one anisotropy vector`,
    )
  }
  return source
}

// Two anisotropic materials of one scene, prepared by the resolver's own
// walk, and each of them built through the real node builder.
function buildPreparedPrograms(): {
  frame: NodeFrame
  programs: readonly { mesh: Mesh; material: MeshPhysicalMaterial; builder: ProgramBuilder }[]
} {
  const renderer = new WebGPURenderer({ forceWebGL: true, canvas: drawingSurface })
  const scene = new Scene()
  const camera = new PerspectiveCamera()
  const geometry = new BoxGeometry()
  const strengths = [0.5, 1] as const
  const meshes = strengths.map((strength) => new Mesh(geometry, anisotropicMaterial(strength)))
  scene.add(...meshes)
  markSceneMaterials(scene)

  const lightsNode = lights([new DirectionalLight()])
  const builders = meshes.map((mesh) => buildProgram(mesh, renderer, scene, camera, lightsNode))

  const frame = new NodeFrame()
  frame.renderer = renderer
  frame.scene = scene
  frame.camera = camera
  return {
    frame,
    programs: meshes.map((mesh, index) => ({
      mesh,
      material: mesh.material as MeshPhysicalMaterial,
      builder: builders[index] as ProgramBuilder,
    })),
  }
}

test('each built program samples its own anisotropy value node', () => {
  const { programs } = buildPreparedPrograms()

  const [first, second] = programs
  if (first === undefined || second === undefined) {
    throw new Error('the proof builds fewer than two programs')
  }
  const firstSource = anisotropySourceOf(first.builder)
  const secondSource = anisotropySourceOf(second.builder)

  expect(firstSource).toBe((first.material as AnisotropyCarrier).anisotropyNode)
  expect(secondSource).toBe((second.material as AnisotropyCarrier).anisotropyNode)
  expect(firstSource).not.toBe(secondSource)
})

test("the own anisotropy value survives the other material's render updates", () => {
  const { frame, programs } = buildPreparedPrograms()

  for (let render = 0; render < 2; render += 1) {
    frame.renderId += 1
    for (const { mesh, material, builder } of programs) {
      frame.object = mesh
      frame.material = material
      for (const node of builder.updateNodes) {
        frame.updateNode(node)
      }
    }
  }

  for (const { material, builder } of programs) {
    const carrier = material as AnisotropyCarrier
    const expected = carrier.anisotropy ?? 0
    const source = anisotropySourceOf(builder)
    expect(source.value?.x).toBeCloseTo(expected * Math.cos(Math.PI / 2), 12)
    expect(source.value?.y).toBeCloseTo(expected * Math.sin(Math.PI / 2), 12)
  }
})
