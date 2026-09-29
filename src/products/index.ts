// The ordered raw manifest list of the collection. Data only:
// createCollection validates it and orders products
// by their number, so a manifest enters here once and every layer reads the
// result through the app's collection loader.
import { manifest as standIn } from './stand-in'

export const productManifests = [standIn] as const
