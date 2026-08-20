import { describe, expect, it } from "vitest";
import { assignDifficultyTiers, pickGroups } from "./generate";
import { createRng } from "./rng";
import { colorKeyForTier } from "./colors";
import type { ContentPool, PickedGroup } from "./types";

function makeWords(groupId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    wordId: `${groupId}-w${i}`,
    displayText: `${groupId}-w${i}`.toUpperCase(),
  }));
}

// Builds a synthetic pool: `sizes` maps groupId -> member count,
// `conflictPairs` are symmetric (mirrors how the real publish step inserts
// both directions).
function buildPool(
  sizes: Record<string, number>,
  conflictPairs: [string, string][] = [],
  difficultyHints: Record<string, number> = {}
): ContentPool {
  const groups = Object.keys(sizes).map((groupId) => ({
    groupId,
    label: groupId,
    description: null,
    difficultyHint: difficultyHints[groupId] ?? 1,
  }));

  const membersByGroup = new Map(
    Object.entries(sizes).map(([groupId, count]) => [groupId, makeWords(groupId, count)])
  );

  const conflicts = new Map<string, Set<string>>();
  for (const [a, b] of conflictPairs) {
    if (!conflicts.has(a)) conflicts.set(a, new Set());
    if (!conflicts.has(b)) conflicts.set(b, new Set());
    conflicts.get(a)!.add(b);
    conflicts.get(b)!.add(a);
  }

  return { groups, conflicts, membersByGroup };
}

describe("pickGroups", () => {
  it("picks exactly 4 groups of exactly 4 words each, all 16 words distinct", () => {
    const pool = buildPool({ a: 5, b: 6, c: 4, d: 5, e: 4, f: 6 });
    const picked = pickGroups(pool, createRng("seed-1"));

    expect(picked).not.toBeNull();
    expect(picked).toHaveLength(4);

    const allWordIds = picked!.flatMap((g) => g.words.map((w) => w.wordId));
    expect(allWordIds).toHaveLength(16);
    expect(new Set(allWordIds).size).toBe(16);

    for (const group of picked!) {
      expect(group.words).toHaveLength(4);
    }
  });

  it("never picks two groups that conflict with each other", () => {
    const pool = buildPool(
      { a: 4, b: 4, c: 4, d: 4, e: 4 },
      [["a", "b"]]
    );

    for (let i = 0; i < 30; i++) {
      const picked = pickGroups(pool, createRng(`conflict-${i}`));
      if (!picked) continue;
      const groupIds = new Set(picked.map((g) => g.groupId));
      expect(groupIds.has("a") && groupIds.has("b")).toBe(false);
    }
  });

  it("rejects a candidate group with fewer than 4 unused words remaining", () => {
    // "small" only has 4 members, all shared (by word text) with "big" via
    // identical member counts isn't the point - the point is "small" itself
    // has exactly 4, so it's only usable if nothing else has already
    // consumed its words. Since groups don't share word ids here, this
    // instead verifies a group below the minimum is simply never chosen.
    const pool = buildPool({ toosmall: 3, a: 4, b: 4, c: 4, d: 4 });
    const picked = pickGroups(pool, createRng("small-1"));

    expect(picked).not.toBeNull();
    expect(picked!.map((g) => g.groupId)).not.toContain("toosmall");
  });

  it("retries across multiple shuffle attempts and eventually succeeds", () => {
    // "a" conflicts with every other group, so the only valid 4-group
    // combination is {b, c, d, e} - reachable only on shuffle orders where
    // "a" doesn't get greedily picked before the other four are locked in.
    const pool = buildPool(
      { a: 4, b: 4, c: 4, d: 4, e: 4 },
      [
        ["a", "b"],
        ["a", "c"],
        ["a", "d"],
        ["a", "e"],
      ]
    );

    let seedThatFailsOnce: string | undefined;
    for (let i = 0; i < 200; i++) {
      const seed = `retry-${i}`;
      if (pickGroups(pool, createRng(seed), 1) === null) {
        seedThatFailsOnce = seed;
        break;
      }
    }

    expect(seedThatFailsOnce, "expected at least one seed to fail with a single attempt").toBeDefined();
    const recovered = pickGroups(pool, createRng(seedThatFailsOnce!), 50);
    expect(recovered).not.toBeNull();
    expect(new Set(recovered!.map((g) => g.groupId))).toEqual(new Set(["b", "c", "d", "e"]));
  });

  it("returns null when the pool can never satisfy 4 non-conflicting groups", () => {
    const pool = buildPool({ a: 4, b: 4, c: 4 }); // only 3 groups exist at all
    const picked = pickGroups(pool, createRng("impossible"), 10);
    expect(picked).toBeNull();
  });
});

describe("assignDifficultyTiers", () => {
  it("assigns tiers 1-4, each exactly once, sorted ascending by difficulty_hint", () => {
    const picked: PickedGroup[] = [
      { groupId: "hard", label: "hard", description: null, difficultyHint: 4, words: makeWords("hard", 4) as PickedGroup["words"] },
      { groupId: "easy", label: "easy", description: null, difficultyHint: 1, words: makeWords("easy", 4) as PickedGroup["words"] },
      { groupId: "medium2", label: "medium2", description: null, difficultyHint: 3, words: makeWords("medium2", 4) as PickedGroup["words"] },
      { groupId: "medium1", label: "medium1", description: null, difficultyHint: 2, words: makeWords("medium1", 4) as PickedGroup["words"] },
    ];

    const tiered = assignDifficultyTiers(picked);

    expect(tiered.map((g) => g.groupId)).toEqual(["easy", "medium1", "medium2", "hard"]);
    expect(tiered.map((g) => g.difficultyTier)).toEqual([1, 2, 3, 4]);
    expect(new Set(tiered.map((g) => g.difficultyTier)).size).toBe(4);
    for (const group of tiered) {
      expect(group.colorKey).toBe(colorKeyForTier(group.difficultyTier));
    }
  });
});
