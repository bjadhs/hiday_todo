/**
 * Bidirectional sync between the /plan timeline and the /plan-md markdown pane,
 * ported from `myapp`'s plan-markdown.ts and adapted to this app's data model
 * (plan times are minutes-from-midnight; projects are referenced by name).
 *
 * Markdown -> timeline matching is intentionally simple: a plan line is
 * identified by the exact (start time, end time, title) triplet in its `### `
 * heading. Editing the time or title of a line means it no longer matches its
 * old triplet, so it reads as "old block deleted + new block created" rather
 * than "renamed". `Project:` and `Note:` lines under a *matched* block are
 * synced in place (so notes survive a project/note-only edit), but not across a
 * time/title change.
 *
 * Only the `## Plan` section is parsed. `## Focused` / `## Completed` are
 * read-only context — regenerated on every sync and ignored by the parser.
 */

import type { PlanItem, Project, FocusSession, Todo } from "./types"
import { msToMinutes, formatFocusTotal } from "./utils"

const MINUTES_IN_DAY = 24 * 60
const TITLE_FALLBACK = "Untitled"

export type ParsedPlanBlock = {
  key: string
  title: string
  startMinutes: number
  durationMinutes: number
  projectName: string | null
  note: string | null
}

/** minutes-from-midnight → "HH:MM" (24h, zero-padded). */
function minutesToLabel(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY, minutes))
  const h = Math.floor(clamped / 60) % 24
  const m = clamped % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

/** "HH:MM" / "9:00" / "9:00 AM" / "9 AM" → minutes-from-midnight, or null. */
function parseTimeLabel(raw: string): number | null {
  const text = raw.trim()
  const hm = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(text)
  if (hm) {
    let h = parseInt(hm[1], 10)
    const m = parseInt(hm[2], 10)
    if (hm[3]) {
      h = h % 12
      if (/pm/i.test(hm[3])) h += 12
    }
    if (h < 0 || h > 24 || m < 0 || m > 59) return null
    return h * 60 + m
  }
  const hOnly = /^(\d{1,2})\s*(AM|PM)$/i.exec(text)
  if (hOnly) {
    let h = parseInt(hOnly[1], 10) % 12
    if (/pm/i.test(hOnly[2])) h += 12
    return h * 60
  }
  return null
}

function makeKey(startLabel: string, endLabel: string, title: string): string {
  return `${startLabel}__${endLabel}__${title.trim().toLowerCase()}`
}

/** Matching key for an existing plan item — diffed against parsed markdown blocks. */
export function planItemKey(item: Pick<PlanItem, "title" | "startMinutes" | "durationMinutes">): string {
  const end = Math.min(MINUTES_IN_DAY, item.startMinutes + item.durationMinutes)
  return makeKey(minutesToLabel(item.startMinutes), minutesToLabel(end), item.title?.trim() || TITLE_FALLBACK)
}

/**
 * Render the full markdown document for a day. `## Plan` is editable and synced
 * back to the store; `## Focused` and `## Completed` are read-only context.
 */
export function generatePlanMarkdown(
  dateStr: string,
  plan: PlanItem[],
  focus: FocusSession[],
  completed: Todo[],
  projects: Project[],
  todoTitle: (todoId: string) => string
): string {
  const dayHeading = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Inbox"

  // A `---` rule between every entry; `---` lines are ignored by the parser.
  const ENTRY_SEP = "\n\n---\n\n"

  const lines: string[] = [`# ${dayHeading}`, "", "## Plan", ""]

  // Most-recent-first: latest start time / session / completion at the top.
  const sortedPlan = [...plan].sort((a, b) => b.startMinutes - a.startMinutes)
  if (sortedPlan.length === 0) {
    lines.push("_No plan blocks — add one like:_", "_`### 09:00 – 10:00 · Title`_", "")
  } else {
    const blocks = sortedPlan.map((item) => {
      const end = Math.min(MINUTES_IN_DAY, item.startMinutes + item.durationMinutes)
      const block = [
        `### ${minutesToLabel(item.startMinutes)} – ${minutesToLabel(end)} · ${item.title?.trim() || TITLE_FALLBACK}`,
        `Project: ${projectName(item.projectId)}`,
      ]
      if (item.description?.trim()) block.push(`Note: ${item.description.trim()}`)
      return block.join("\n")
    })
    lines.push(blocks.join(ENTRY_SEP), "")
  }

  lines.push("## Focused", "")
  const sortedFocus = [...focus].sort((a, b) => b.startedAt - a.startedAt)
  if (sortedFocus.length === 0) {
    lines.push("_No focus sessions._", "")
  } else {
    const rows = sortedFocus.map(
      (s) => `- ${minutesToLabel(msToMinutes(s.startedAt))} · ${todoTitle(s.todoId)} — ${formatFocusTotal(s.durationSeconds)}`
    )
    lines.push(rows.join(ENTRY_SEP), "")
  }

  lines.push("## Completed", "")
  const sortedCompleted = [...completed].sort((a, b) => b.createdAt - a.createdAt)
  if (sortedCompleted.length === 0) {
    lines.push("_Nothing completed._")
  } else {
    lines.push(sortedCompleted.map((t) => `- [x] ${t.title}`).join(ENTRY_SEP))
  }

  return lines.join("\n").trimEnd() + "\n"
}

const HEADING_RE = /^###\s+(.+?)\s*[-–—]\s*(.+?)\s*·\s*(.+)$/
const PROJECT_LINE_RE = /^Project:\s*(.+)$/i
const NOTE_LINE_RE = /^Note:\s*(.+)$/i

/** A problem found in the `## Plan` markdown, tied to the offending line. */
export type PlanSyncError = { line: number; message: string }

export type PlanParseResult = { blocks: ParsedPlanBlock[]; errors: PlanSyncError[] }

/**
 * Parse the `### HH:MM – HH:MM · Title` lines under `## Plan` (every other `## `
 * section is read-only and ignored), collecting per-line errors so the UI can
 * tell the user exactly what to fix or remove. `knownProjectNames` is used to
 * reject `Project:` lines that name a project that doesn't exist. When `errors`
 * is non-empty the caller should refuse to sync rather than apply partially.
 */
export function parsePlanMarkdown(markdown: string, knownProjectNames: string[]): PlanParseResult {
  const lines = markdown.split("\n")
  const blocks: ParsedPlanBlock[] = []
  const errors: PlanSyncError[] = []
  const knownLower = new Set(knownProjectNames.map((n) => n.trim().toLowerCase()))
  const seenKeys = new Map<string, number>() // key -> first line it appeared on

  let inPlan = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^##\s+Plan\b/i.test(line)) {
      inPlan = true
      continue
    }
    if (/^##\s+/.test(line)) {
      if (inPlan) break // any other "## " section ends the Plan block
      continue
    }
    if (!inPlan) continue

    // Only scrutinize lines that look like a heading attempt; everything else
    // (blank lines, `---` rules, stray text) is ignored, not an error.
    if (!/^###\s+/.test(line)) continue
    const lineNo = i + 1

    const match = line.match(HEADING_RE)
    if (!match) {
      errors.push({ line: lineNo, message: "couldn't read this line — use `### HH:MM – HH:MM · Title`" })
      continue
    }

    const startMinutes = parseTimeLabel(match[1])
    const endMinutes = parseTimeLabel(match[2])
    if (startMinutes === null || endMinutes === null) {
      errors.push({ line: lineNo, message: "invalid time — use 24h `HH:MM` (e.g. 09:00) or `9:00 AM`" })
      continue
    }
    if (endMinutes <= startMinutes) {
      errors.push({ line: lineNo, message: "end time must be after the start time" })
      continue
    }
    const title = match[3].trim() || TITLE_FALLBACK

    // Look ahead for Project:/Note: lines until the next heading/section.
    let projectName: string | null = null
    let note: string | null = null
    for (let j = i + 1; j < lines.length; j++) {
      if (HEADING_RE.test(lines[j]) || /^##\s+/.test(lines[j])) break
      const pm = lines[j].match(PROJECT_LINE_RE)
      if (pm) projectName = pm[1].trim()
      const nm = lines[j].match(NOTE_LINE_RE)
      if (nm) note = nm[1].trim()
    }

    if (projectName && !knownLower.has(projectName.toLowerCase())) {
      errors.push({
        line: lineNo,
        message: `project "${projectName}" doesn't exist — create it first or fix the name`,
      })
      continue
    }

    const key = makeKey(minutesToLabel(startMinutes), minutesToLabel(endMinutes), title)
    const firstSeen = seenKeys.get(key)
    if (firstSeen !== undefined) {
      errors.push({ line: lineNo, message: `duplicate of line ${firstSeen} (same time and title)` })
      continue
    }
    seenKeys.set(key, lineNo)

    blocks.push({
      key,
      title,
      startMinutes,
      durationMinutes: endMinutes - startMinutes,
      projectName,
      note,
    })
  }

  return { blocks, errors }
}
