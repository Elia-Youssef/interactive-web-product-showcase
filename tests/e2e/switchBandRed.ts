import type { Page } from '@playwright/test'
import { resolvedTokenColor } from './tokenColor'

// The red of the product switch band, as the browser resolves its one
// token: the band and its crossfade both paint it, so a token change is
// never a test edit, and a missing token fails instead of reading the
// transparent initial color.
export function switchBandRed(page: Page): Promise<string> {
  return resolvedTokenColor(page, '--switch-band')
}
