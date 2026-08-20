import { nanoid } from "nanoid";
import type { db as Db } from "@/db/client";
import { puzzles, puzzleGroups, puzzleGroupMembers } from "@/db/schema";
import { colorKeyForTier } from "./colors";
import { createRng, shuffle, type Rng } from "./rng";
import { loadContentPool } from "./pool";
import type { ContentPool, PickedGroup, TieredGroup } from "./types";

export const GENERATOR_VERSION = "v1";

const GROUPS_PER_PUZZLE = 4;
const WORDS_PER_GROUP = 4;
const MAX_ATTEMPTS = 50;

function groupsConflict(pool: ContentPool, a: string, b: string): boolean {
  return Boolean(pool.conflicts.get(a)?.has(b) || pool.conflicts.get(b)?.has(a));
}

// Step 1: pick 4 non-conflicting groups, sampling 4 distinct-across-the-whole-
// -puzzle words from each. Pure function of (pool, rng) - no I/O, so it's
// cheap to fuzz in tests. Returns null if MAX_ATTEMPTS shuffles all fail to
// produce a valid combination (e.g. the pool is too small/too conflict-heavy).
export function pickGroups(pool: ContentPool, rng: Rng, maxAttempts = MAX_ATTEMPTS): PickedGroup[] | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffledGroups = shuffle(pool.groups, rng);
    const picked: PickedGroup[] = [];
    const usedWordIds = new Set<string>();

    for (const group of shuffledGroups) {
      if (picked.length === GROUPS_PER_PUZZLE) break;

      const conflictsWithPicked = picked.some((p) => groupsConflict(pool, group.groupId, p.groupId));
      if (conflictsWithPicked) continue;

      const members = pool.membersByGroup.get(group.groupId) ?? [];
      const available = members.filter((w) => !usedWordIds.has(w.wordId));
      if (available.length < WORDS_PER_GROUP) continue;

      const sampled = shuffle(available, rng).slice(0, WORDS_PER_GROUP) as PickedGroup["words"];
      picked.push({
        groupId: group.groupId,
        label: group.label,
        description: group.description,
        difficultyHint: group.difficultyHint,
        words: sampled,
      });
      for (const w of sampled) usedWordIds.add(w.wordId);
    }

    if (picked.length === GROUPS_PER_PUZZLE) return picked;
  }
  return null;
}

// Step 2: sort by difficulty_hint, assign tier 1-4 and the matching color_key.
export function assignDifficultyTiers(picked: PickedGroup[]): TieredGroup[] {
  const sorted = [...picked].sort((a, b) => (a.difficultyHint ?? 0) - (b.difficultyHint ?? 0));
  return sorted.map((group, i) => {
    const tier = (i + 1) as 1 | 2 | 3 | 4;
    return { ...group, difficultyTier: tier, colorKey: colorKeyForTier(tier) };
  });
}

// Step 3: persist puzzles / puzzle_groups / puzzle_group_members, batched
// into a single network round trip (db.batch - still atomic, all-or-nothing,
// like the db.transaction() this replaces) rather than 9 sequential awaited
// inserts. Snapshots display_text at generation time.
export async function persistPuzzle(
  db: typeof Db,
  params: {
    puzzleId: string;
    seed: string;
    tieredGroups: TieredGroup[];
    puzzleType?: "procedural" | "curated";
    createdBy?: string;
  }
): Promise<void> {
  const { puzzleId, seed, tieredGroups, puzzleType = "procedural", createdBy } = params;

  const statements = [
    db.insert(puzzles).values({
      puzzleId,
      puzzleType,
      status: "active",
      seed,
      generatorVersion: GENERATOR_VERSION,
      createdBy,
    }),
    ...tieredGroups.flatMap((group) => {
      const puzzleGroupId = `${puzzleId}-t${group.difficultyTier}`;
      return [
        db.insert(puzzleGroups).values({
          puzzleGroupId,
          puzzleId,
          difficultyTier: group.difficultyTier,
          colorKey: group.colorKey,
          sourceGroupId: group.groupId,
          label: group.label,
          description: group.description,
        }),
        db.insert(puzzleGroupMembers).values(
          group.words.map((w) => ({
            puzzleGroupId,
            puzzleId,
            wordId: w.wordId,
            displayText: w.displayText,
          }))
        ),
      ];
    }),
  ];

  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
}

export class PuzzleGenerationError extends Error {}

// Orchestrator: loads the pool, picks + tiers groups, persists, returns the
// new puzzle_id. `seed` defaults to a fresh random id so callers don't need
// to think about it, but passing one makes the result fully reproducible
// (used by tests, and available later for curated/daily puzzles).
export async function generatePuzzle(
  db: typeof Db,
  options: { seed?: string; puzzleType?: "procedural" | "curated"; createdBy?: string } = {}
): Promise<{ puzzleId: string; seed: string; tieredGroups: TieredGroup[] }> {
  const seed = options.seed ?? nanoid();
  const rng = createRng(seed);

  const pool = await loadContentPool(db);
  const picked = pickGroups(pool, rng);
  if (!picked) {
    throw new PuzzleGenerationError(
      `Could not assemble a puzzle after ${MAX_ATTEMPTS} attempts - content pool may be too small or too conflict-heavy.`
    );
  }

  const tieredGroups = assignDifficultyTiers(picked);
  const puzzleId = nanoid(12);

  await persistPuzzle(db, {
    puzzleId,
    seed,
    tieredGroups,
    puzzleType: options.puzzleType,
    createdBy: options.createdBy,
  });

  return { puzzleId, seed, tieredGroups };
}
