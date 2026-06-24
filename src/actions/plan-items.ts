"use server"

import { eq } from "drizzle-orm"
import { getDb, schema } from "@/lib/db"
import { assertAuthed } from "@/lib/auth-server"
import type { PlanItem } from "@/lib/types"

/** Persist a plan item created in the store (id is client-generated). */
export async function createPlanItem(item: PlanItem): Promise<void> {
  await assertAuthed()
  await getDb().insert(schema.planItems).values({
    id: item.id,
    title: item.title,
    date: item.date,
    startMinutes: item.startMinutes,
    durationMinutes: item.durationMinutes,
    projectId: item.projectId,
  })
}

/** Apply a partial update to a plan item. Keys map 1:1 to columns. */
export async function updatePlanItem(id: string, updates: Partial<PlanItem>): Promise<void> {
  await assertAuthed()
  if (Object.keys(updates).length === 0) return
  await getDb().update(schema.planItems).set(updates).where(eq(schema.planItems.id, id))
}

export async function removePlanItem(id: string): Promise<void> {
  await assertAuthed()
  await getDb().delete(schema.planItems).where(eq(schema.planItems.id, id))
}
