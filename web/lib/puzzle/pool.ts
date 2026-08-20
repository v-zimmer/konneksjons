import { eq } from "drizzle-orm";
import type { db as Db } from "@/db/client";
import {
  contentGroups,
  contentGroupMembers,
  contentGroupConflicts,
  contentWords,
} from "@/db/schema";
import type { ContentPool } from "./types";

// Loads the full content pool in three queries. Fine at our scale (hundreds
// of groups, thousands of words) - no pagination needed for v1.
export async function loadContentPool(db: typeof Db): Promise<ContentPool> {
  const groups = await db
    .select({
      groupId: contentGroups.groupId,
      label: contentGroups.label,
      description: contentGroups.description,
      difficultyHint: contentGroups.difficultyHint,
    })
    .from(contentGroups);

  const conflictRows = await db.select().from(contentGroupConflicts);
  const conflicts = new Map<string, Set<string>>();
  for (const row of conflictRows) {
    if (!conflicts.has(row.groupIdA)) conflicts.set(row.groupIdA, new Set());
    conflicts.get(row.groupIdA)!.add(row.groupIdB);
  }

  const memberRows = await db
    .select({
      groupId: contentGroupMembers.groupId,
      wordId: contentGroupMembers.wordId,
      displayText: contentWords.displayText,
    })
    .from(contentGroupMembers)
    .innerJoin(contentWords, eq(contentGroupMembers.wordId, contentWords.wordId));

  const membersByGroup = new Map<string, { wordId: string; displayText: string }[]>();
  for (const row of memberRows) {
    if (!membersByGroup.has(row.groupId)) membersByGroup.set(row.groupId, []);
    membersByGroup.get(row.groupId)!.push({ wordId: row.wordId, displayText: row.displayText });
  }

  return { groups, conflicts, membersByGroup };
}
