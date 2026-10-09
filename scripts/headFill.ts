// The head writer and reader of the prerender. The writer fills the tags a
// page owns in a built index.html, one value per slot; the drift check
// reads those tags back per tag, so the build step can hold a written file
// against the values the copy builder produced. All of them work from one
// slot table, so a tag the writer fills is exactly a tag the check reads.
// Vite fills the same slots for the site in build and development.
// Each throws on, or reports, a file that lacks a slot, so a renamed or
// removed tag fails loudly instead of shipping or passing a stale value.

import type { MetaHeadSet } from '../src/lib/copy/meta.ts'

// The writer takes exactly the builder's head set across the src boundary.
export type HeadValues = MetaHeadSet

// Escapes a value for a double-quoted HTML attribute. The copy holds none
// of these characters today; the escaping is here so that staying true is
// not what protects the file structure.
function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

// The exact inverse, for reading a value back out of a written file. The
// ampersand decodes last, so an escaped entity never decodes twice.
function decodeAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

// One owned tag: the value slot it carries and the pattern that matches it
// as three groups, the file text before the value, the value, and the text
// after it. The writer swaps the middle group; the reader reads it. The
// patterns tolerate the line breaks formatting adds between attributes,
// and the replacement keeps the file's own attribute order and breaks.
type HeadSlot = {
  readonly label: string
  readonly key: keyof HeadValues
  readonly pattern: RegExp
}

function slot(label: string, key: keyof HeadValues, prefixPattern: string): HeadSlot {
  return { label, key, pattern: new RegExp(`(${prefixPattern})([^"]*)(")`) }
}

const SLOTS: readonly HeadSlot[] = [
  {
    label: 'the title element',
    key: 'title',
    pattern: /(<title>)([\s\S]*?)(<\/title>)/,
  },
  slot('the description meta', 'description', '<meta\\s+name="description"\\s+content="'),
  slot('the canonical link', 'canonicalUrl', '<link\\s+rel="canonical"\\s+href="'),
  slot('the og:type meta', 'socialType', '<meta\\s+property="og:type"\\s+content="'),
  slot('the og:site_name meta', 'socialSiteName', '<meta\\s+property="og:site_name"\\s+content="'),
  slot('the og:title meta', 'socialTitle', '<meta\\s+property="og:title"\\s+content="'),
  slot(
    'the og:description meta',
    'socialDescription',
    '<meta\\s+property="og:description"\\s+content="',
  ),
  slot('the og:url meta', 'canonicalUrl', '<meta\\s+property="og:url"\\s+content="'),
  slot('the og:image meta', 'socialImageUrl', '<meta\\s+property="og:image"\\s+content="'),
  slot('the twitter:card meta', 'twitterCard', '<meta\\s+name="twitter:card"\\s+content="'),
  slot('the twitter:title meta', 'socialTitle', '<meta\\s+name="twitter:title"\\s+content="'),
  slot(
    'the twitter:description meta',
    'socialDescription',
    '<meta\\s+name="twitter:description"\\s+content="',
  ),
  slot('the twitter:image meta', 'socialImageUrl', '<meta\\s+name="twitter:image"\\s+content="'),
]

// Fills every builder-owned tag and returns the file text. The template
// owns only structural tags, such as the charset, viewport and favicon.
export function fillHead(html: string, values: HeadValues): string {
  let filled = html
  for (const item of SLOTS) {
    if (!item.pattern.test(filled)) {
      throw new Error(`the head template has no ${item.label}`)
    }
    const value = escapeAttribute(values[item.key])
    filled = filled.replace(
      item.pattern,
      (_match, before: string, _current: string, after: string) => {
        return `${before}${value}${after}`
      },
    )
  }
  return filled
}

// The finding of the drift check over one head: the phrase naming the
// first owned tag that fails, or null while every owned tag carries the
// value its slot maps to. The check is per tag, not per value: the og and
// twitter tags share their values by design, so a wrong tag is reported
// even while its twin is right.
export function driftedSlot(html: string, values: HeadValues): string | null {
  for (const item of SLOTS) {
    const match = item.pattern.exec(html)
    if (match === null || match[2] === undefined) {
      return `${item.label} is missing`
    }
    if (decodeAttribute(match[2]) !== values[item.key]) {
      return `${item.label} does not match the builder`
    }
  }
  return null
}
