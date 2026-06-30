"use server"

import { eq } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import { notifyChange } from "@/lib/db/realtime"
import { assertAuthed } from "@/lib/auth-server"
import type { PlanItem } from "@/lib/types"

/** Persist a plan item created in the store (id is client-generated). */
export async function createPlanItem(item: PlanItem): Promise<void> {
  await assertAuthed()
  await getDb().insert(schema.planItems).values({
    id: item.id,
    title: item.title,
    description: item.description,
    date: item.date,
    startMinutes: item.startMinutes,
    durationMinutes: item.durationMinutes,
    projectId: item.projectId,
    tags: item.tags,
  })
  await notifyChange()
}

/** Apply a partial update to a plan item. Keys map 1:1 to columns. */
export async function updatePlanItem(id: string, updates: Partial<PlanItem>): Promise<void> {
  await assertAuthed()
  if (Object.keys(updates).length === 0) return
  await getDb().update(schema.planItems).set(updates).where(eq(schema.planItems.id, id))
  await notifyChange()
}

/** Soft-delete: move a plan item to the Archived trash. */
export async function archivePlanItem(id: string, deletedAt: number): Promise<void> {
  await assertAuthed()
  await getDb().update(schema.planItems).set({ deletedAt }).where(eq(schema.planItems.id, id))
  await notifyChange()
}

/** Restore an archived plan item back to its slot. */
export async function restorePlanItem(id: string): Promise<void> {
  await assertAuthed()
  await getDb().update(schema.planItems).set({ deletedAt: null }).where(eq(schema.planItems.id, id))
  await notifyChange()
}

/** Permanently delete a plan item. */
export async function deletePlanItemForever(id: string): Promise<void> {
  await assertAuthed()
  await getDb().delete(schema.planItems).where(eq(schema.planItems.id, id))
  await notifyChange()
}
