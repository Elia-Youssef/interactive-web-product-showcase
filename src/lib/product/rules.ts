// The manifest rules as data: every limit and pattern the schema enforces.
// The schema and the tests both read them from here, so the two can never
// drift apart, and no bare number or regex sits inline anywhere else.
import { CAMERA_HOME_ID } from './contractNames'

// Lowercase kebab case: words of a-z and 0-9 joined by single hyphens.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Hotspot ids follow the Blender naming contract: lowercase a-z, 0-9 and _.
export const HOTSPOT_ID_PATTERN = /^[a-z0-9_]+$/

// The one swatch format: exactly six hex digits after the hash, any case.
export const SWATCH_PATTERN = /^#[0-9a-f]{6}$/i

// One line of text: non-empty, no line breaks, no leading or trailing
// whitespace. Line breaks are CR, LF and the Unicode line separators.
export const SINGLE_LINE_PATTERN = /^\S(?:[^\r\n\u2028\u2029]*\S)?$/

export const INTRO_MAX_LINES = 2

export const FINISHES_MIN = 1

export const HOTSPOT_BULLETS_MIN = 1
export const HOTSPOT_BULLETS_MAX = 3

// CAM_<id> camera names share the id space with HS_<id> hotspots, so an id
// claimed by the camera contract cannot also name a hotspot. The reserved
// set is derived from the camera contract's own names, so a camera name the
// contract adds reserves its hotspot id here without a second edit.
export const RESERVED_HOTSPOT_IDS = [CAMERA_HOME_ID] as const

export const DEFAULT_EXPLODE_CLIP = 'Explode'
