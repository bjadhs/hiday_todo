"use server"

import { getDb, schema } from "@/lib/db"
import { notifyChange } from "@/lib/db/realtime"
import { assertAuthed } from "@/lib/auth-server"

/** Upsert a single app preference key. Mirrors `setSetting` in the store. */
export async function setSetting(key: string, value: string): Promise<void> {
  await assertAuthed()
  await getDb()
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
  await notifyChange()
}

/** Read all preferences as a flat key/value map (used by `getAllData`). */
export async function getSettings(): Promise<Record<string, string>> {
  await assertAuthed()
  const rows = await getDb().select().from(schema.settings)
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
