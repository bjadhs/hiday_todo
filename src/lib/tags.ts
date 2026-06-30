/**
 * Inline tag parsing for todo / plan titles. A `#tag` or `@tag` token anywhere
 * in a title is pulled out as a tag and stripped from the visible text, so e.g.
 * "Buy milk #grocery" becomes title "Buy milk" with tag "grocery". The token
 * must start the string or follow whitespace, and the tag body is letters,
 * digits, `_` or `-` (so a bare "#" or "C#" at the end of a word is left alone).
 */

// Capture the leading boundary so we can preserve the spacing we matched.
const TAG_TOKEN = /(^|\s)[#@]([A-Za-z0-9][A-Za-z0-9_-]*)/g

export type ParsedTitle = { title: string; tags: string[] }

/** Pull `#`/`@` tags out of a raw title, returning the cleaned title + tags. */
export function extractTags(raw: string): ParsedTitle {
  const tags: string[] = []
  const stripped = raw.replace(TAG_TOKEN, (_match, lead: string, tag: string) => {
    tags.push(tag)
    // Keep the leading space so neighbouring words don't get glued together.
    return lead
  })
  const title = stripped.replace(/\s{2,}/g, " ").trim()
  return { title, tags: dedupe(tags) }
}

/** Case-insensitive de-dupe that keeps the first spelling seen. */
function dedupe(tags: string[]): string[] {
  const seen = new Set<string>()
  return tags.filter((t) => {
    const key = t.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Union two tag lists (case-insensitive), preserving order/first spelling. */
export function mergeTags(existing: string[], extra: string[]): string[] {
  return dedupe([...existing, ...extra])
}
