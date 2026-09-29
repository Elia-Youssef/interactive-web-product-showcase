// Cases for hotspots: the id contract, reserved and duplicate ids, the bullet
// limits, the copy fields, and unknown keys inside a hotspot.
import { driverHotspot, sampleTwoManifest } from '../fixtures'
import { HOTSPOT_BULLETS_MAX, HOTSPOT_BULLETS_MIN, RESERVED_HOTSPOT_IDS } from '../rules'
import { accepts, lines, rejects, type ManifestCase } from './case'

const reservedId: string = RESERVED_HOTSPOT_IDS[0]

const withHotspots = (hotspots: unknown[]) => ({ ...sampleTwoManifest, hotspots })

export const hotspotCases: readonly ManifestCase[] = [
  accepts(
    'bullets at the minimum',
    withHotspots([{ ...driverHotspot, bullets: ['One line'] }]),
    'sample-two',
  ),
  rejects(
    'a hotspot id with uppercase letters',
    withHotspots([{ ...driverHotspot, id: 'Driver' }]),
    'hotspots[0].id',
  ),
  rejects(
    'a hotspot id with a hyphen',
    withHotspots([{ ...driverHotspot, id: 'dri-ver' }]),
    'hotspots[0].id',
  ),
  rejects(
    'a reserved hotspot id',
    withHotspots([{ ...driverHotspot, id: reservedId }]),
    'hotspots[0].id',
  ),
  rejects(
    'a duplicated hotspot id',
    withHotspots([driverHotspot, driverHotspot]),
    'hotspots[1].id',
  ),
  rejects(
    'a hotspot without bullets',
    withHotspots([{ ...driverHotspot, bullets: lines(HOTSPOT_BULLETS_MIN - 1) }]),
    'hotspots[0].bullets',
  ),
  rejects(
    'a hotspot over the bullet limit',
    withHotspots([{ ...driverHotspot, bullets: lines(HOTSPOT_BULLETS_MAX + 1) }]),
    'hotspots[0].bullets',
  ),
  rejects(
    'a bullet with a line break',
    withHotspots([{ ...driverHotspot, bullets: ['one', 'two', 'three\nfour'] }]),
    'hotspots[0].bullets[2]',
  ),
  rejects(
    'an empty hotspot title',
    withHotspots([{ ...driverHotspot, title: '' }]),
    'hotspots[0].title',
  ),
  rejects(
    'a hotspot eyebrow with a line break',
    withHotspots([{ ...driverHotspot, eyebrow: 'look\ncloser' }]),
    'hotspots[0].eyebrow',
  ),
  rejects(
    'an unknown key inside a hotspot',
    withHotspots([{ ...driverHotspot, nope: 1 }]),
    'hotspots[0].nope',
  ),
]
