import { and, eq, sql } from "drizzle-orm";
import type { db as Db } from "@/db/client";
import { puzzleGroupMembers, gameSessions, guesses, solvedPuzzleGroups } from "@/db/schema";
import { getOrCreateSession } from "./game-state";
import { MISTAKES_MAX } from "./constants";
import { ValidationError, GameOverError, DuplicateGuessError } from "./errors";

export type GuessResult = {
  result: "correct" | "incorrect";
  wasOneAway: boolean;
  matchedPuzzleGroupId: string | null;
};

function canonicalize(wordIds: string[]): string {
  return JSON.stringify([...wordIds].sort());
}

function validateWordIds(wordIds: unknown): string[] {
  if (!Array.isArray(wordIds) || wordIds.length !== 4 || !wordIds.every((w) => typeof w === "string")) {
    throw new ValidationError("word_ids must be an array of exactly 4 strings");
  }
  if (new Set(wordIds).size !== 4) {
    throw new ValidationError("word_ids must contain 4 distinct values");
  }
  return wordIds;
}

// Guess validation is fully server-authoritative (plan §3): every call
// re-reads mistake_count/status/puzzle_group_members from the DB, and
// nothing from the client is trusted except the raw word_ids array.
export async function submitGuess(
  db: typeof Db,
  playerId: string,
  puzzleId: string,
  rawWordIds: unknown
): Promise<GuessResult> {
  const wordIds = validateWordIds(rawWordIds);
  const guessedSet = new Set(wordIds);

  const session = await getOrCreateSession(db, playerId, puzzleId);
  if (session.status !== "in_progress") {
    throw new GameOverError(`Puzzle ${puzzleId} is already ${session.status}`);
  }

  const members = await db.select().from(puzzleGroupMembers).where(eq(puzzleGroupMembers.puzzleId, puzzleId));
  const knownWordIds = new Set(members.map((m) => m.wordId));
  for (const wordId of wordIds) {
    if (!knownWordIds.has(wordId)) {
      throw new ValidationError(`word_id ${wordId} does not belong to puzzle ${puzzleId}`);
    }
  }

  const sortedKey = canonicalize(wordIds);
  const [existingGuess] = await db
    .select()
    .from(guesses)
    .where(and(eq(guesses.sessionId, session.sessionId), eq(guesses.wordIdsSorted, sortedKey)))
    .limit(1);
  if (existingGuess) {
    throw new DuplicateGuessError("This combination was already guessed");
  }

  const solvedRows = await db
    .select()
    .from(solvedPuzzleGroups)
    .where(eq(solvedPuzzleGroups.sessionId, session.sessionId));
  const solvedGroupIds = new Set(solvedRows.map((r) => r.puzzleGroupId));

  const membersByGroupId = new Map<string, Set<string>>();
  for (const m of members) {
    if (!membersByGroupId.has(m.puzzleGroupId)) membersByGroupId.set(m.puzzleGroupId, new Set());
    membersByGroupId.get(m.puzzleGroupId)!.add(m.wordId);
  }

  let matchedPuzzleGroupId: string | null = null;
  for (const [groupId, memberSet] of membersByGroupId) {
    if (memberSet.size === 4 && [...memberSet].every((w) => guessedSet.has(w))) {
      matchedPuzzleGroupId = groupId;
      break;
    }
  }

  const guessCountRows = await db.select().from(guesses).where(eq(guesses.sessionId, session.sessionId));
  const guessIndex = guessCountRows.length + 1;

  if (matchedPuzzleGroupId) {
    await db.insert(guesses).values({
      sessionId: session.sessionId,
      guessIndex,
      wordIdsSorted: sortedKey,
      isCorrect: 1,
      matchedPuzzleGroupId,
      wasOneAway: 0,
    });

    const newSolveOrder = solvedRows.length + 1;
    await db.insert(solvedPuzzleGroups).values({
      sessionId: session.sessionId,
      puzzleGroupId: matchedPuzzleGroupId,
      solveOrder: newSolveOrder,
    });

    if (newSolveOrder === 4) {
      await db
        .update(gameSessions)
        .set({ status: "won", completedAt: sql`(datetime('now'))` })
        .where(eq(gameSessions.sessionId, session.sessionId));
    }

    return { result: "correct", wasOneAway: false, matchedPuzzleGroupId };
  }

  // "one away" = any UNSOLVED group shares exactly 3 of the 4 guessed ids.
  let wasOneAway = false;
  for (const [groupId, memberSet] of membersByGroupId) {
    if (solvedGroupIds.has(groupId)) continue;
    let overlap = 0;
    for (const w of guessedSet) if (memberSet.has(w)) overlap++;
    if (overlap === 3) {
      wasOneAway = true;
      break;
    }
  }

  await db.insert(guesses).values({
    sessionId: session.sessionId,
    guessIndex,
    wordIdsSorted: sortedKey,
    isCorrect: 0,
    matchedPuzzleGroupId: null,
    wasOneAway: wasOneAway ? 1 : 0,
  });

  const newMistakeCount = session.mistakeCount + 1;
  if (newMistakeCount >= MISTAKES_MAX) {
    await db
      .update(gameSessions)
      .set({ mistakeCount: newMistakeCount, status: "lost", completedAt: sql`(datetime('now'))` })
      .where(eq(gameSessions.sessionId, session.sessionId));
  } else {
    await db
      .update(gameSessions)
      .set({ mistakeCount: newMistakeCount })
      .where(eq(gameSessions.sessionId, session.sessionId));
  }

  return { result: "incorrect", wasOneAway, matchedPuzzleGroupId: null };
}

export async function resignPuzzle(db: typeof Db, playerId: string, puzzleId: string): Promise<void> {
  const session = await getOrCreateSession(db, playerId, puzzleId);
  if (session.status !== "in_progress") return;

  await db
    .update(gameSessions)
    .set({ status: "resigned", completedAt: sql`(datetime('now'))` })
    .where(eq(gameSessions.sessionId, session.sessionId));
}
