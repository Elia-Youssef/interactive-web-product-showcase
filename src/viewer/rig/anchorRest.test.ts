import { expect, test } from 'vitest'
import { Object3D, Vector3 } from 'three'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import { attach, cameraNode, named, sourceOf } from './fixtures'
import { parseProductRig } from './parseProductRig'
import type { ProductRig } from './productRig'

// The anchors' rest positions the rig carries: read once at parse time from
// the node transforms, in the scene root's own space, so neither where the
// scene hangs nor a later pose of its parts can move them.

const manifest = parseProduct(sampleOneManifest, 'sample-one.test')

// A tree whose anchors sit under rotated, scaled and translated parts and
// an unnamed wrapper, so the rest is a real composition of transforms.
function posedTree(): { readonly scene: Object3D; readonly grille: Object3D } {
  const grille = named('PART_grille')
  grille.position.set(0.12, 0.31, -0.07)
  grille.rotation.set(0.3, -0.7, 0.2)
  const wrapper = new Object3D()
  wrapper.scale.set(1.5, 0.75, 1.25)
  wrapper.position.set(-0.02, 0.05, 0.01)
  const driver = named('HS_driver')
  driver.position.set(0.04, -0.03, 0.09)
  attach(grille, attach(wrapper, driver))
  const body = named('PART_body')
  body.position.set(-0.2, 0.1, 0.05)
  const shell = named('HS_shell')
  shell.position.set(0.01, 0.2, 0.03)
  attach(body, shell)
  const scene = new Object3D().add(
    cameraNode('CAM_home'),
    cameraNode('CAM_driver'),
    named('PART_base'),
    body,
    grille,
    named('SHADOW'),
  )
  return { scene, grille }
}

function rigOf(scene: Object3D): ProductRig {
  const parse = parseProductRig(sourceOf(scene), manifest)
  if (parse.kind === 'broken') {
    throw new Error(`the tree must parse, it broke with: ${JSON.stringify(parse.problems)}`)
  }
  return parse.rig
}

// The anchor's world position as three's own world update computes it for
// the unparented scene.
function worldOf(scene: Object3D, name: string): readonly number[] {
  const node = scene.getObjectByName(name)
  if (node === undefined) {
    throw new Error(`the tree holds no ${name}`)
  }
  const position = node.getWorldPosition(new Vector3())
  return [position.x, position.y, position.z]
}

test('the rests are the node transforms composed from the scene root down', () => {
  const { scene } = posedTree()
  const rig = rigOf(scene)

  expect(rig.anchorRest.get('driver')).toEqual(worldOf(scene, 'HS_driver'))
  expect(rig.anchorRest.get('shell')).toEqual(worldOf(scene, 'HS_shell'))
})

test("the rests are in the scene root's own space, whatever the scene hangs under", () => {
  const unparented = rigOf(posedTree().scene)
  const { scene } = posedTree()
  const centering = new Object3D()
  centering.position.set(-0.3, -0.12, 0.4)
  centering.rotation.set(0, 0.5, 0)
  centering.add(scene)
  centering.updateMatrixWorld(true)

  expect(rigOf(scene).anchorRest).toEqual(unparented.anchorRest)
})

test('a pose after the parse leaves the rests at the authored rest', () => {
  const { scene, grille } = posedTree()
  const rig = rigOf(scene)
  const rest = rig.anchorRest.get('driver')

  grille.position.y += 0.05
  expect(worldOf(scene, 'HS_driver')).not.toEqual(rest)
  expect(rig.anchorRest.get('driver')).toBe(rest)
})
