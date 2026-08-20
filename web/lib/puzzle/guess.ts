import { and, eq, sql } from "drizzle-orm";
import type { db as Db } from "@/db/client";
import { puzzleGroupMembers, gameSessions, guesses, solvedPuzzleGroups } from "@/db/schema";
import { getOrCreateSession, type SessionRow } from "./game-state";
import { MISTAKES_MAX } from "./constants";
import { ValidationError, GameOverError, DuplicateGuessError } from "./errors";

export type GuessResult = {
  result: "correct" | "incorrect";
  wasOneAway: boolean;
  matchedPuzzleGroupId: string | null;
  // The session row after this guess's writes, computed in-memory rather
  // than re-read - callers (the guess route) pass this into
  // getClientSafeGameState to skip a redundant round trip to re-fetch it.
  session: SessionRow;
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
//
// The independent reads are batched into one round trip, and the writes
// (which don't depend on each other's results - everything they need is
// already known from the reads/JS logic above them) are batched into
// another, instead of each being its own sequential round trip against the
// remote Turso DB.
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

  const sortedKey = canonicalize(wordIds);

  const [members, existingGuessRows, solvedRows, allGuessRows] = await db.batch([
    db.select().from(puzzleGroupMembers).where(eq(puzzleGroupMembers.puzzleId, puzzleId)),
    db
      .select()
      .from(guesses)
      .where(and(eq(guesses.sessionId, session.sessionId), eq(guesses.wordIdsSorted, sortedKey)))
      .limit(1),
    db.select().from(solvedPuzzleGroups).where(eq(solvedPuzzleGroups.sessionId, session.sessionId)),
    db.select().from(guesses).where(eq(guesses.sessionId, session.sessionId)),
  ] as unknown as Parameters<typeof db.batch>[0]) as [
    typeof puzzleGroupMembers.$inferSelect[],
    typeof guesses.$inferSelect[],
    typeof solvedPuzzleGroups.$inferSelect[],
    typeof guesses.$inferSelect[],
  ];

  const knownWordIds = new Set(members.map((m) => m.wordId));
  for (const wordId of wordIds) {
    if (!knownWordIds.has(wordId)) {
      throw new ValidationError(`word_id ${wordId} does not belong to puzzle ${puzzleId}`);
    }
  }
  if (existingGuessRows.length > 0) {
    throw new DuplicateGuessError("This combination was already guessed");
  }

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

  const guessIndex = allGuessRows.length + 1;

  if (matchedPuzzleGroupId) {
    const newSolveOrder = solvedRows.length + 1;
    const willWin = newSolveOrder === 4;

    const writes = [
      db.insert(guesses).values({
        sessionId: session.sessionId,
        guessIndex,
        wordIdsSorted: sortedKey,
        isCorrect: 1,
        matchedPuzzleGroupId,
        wasOneAway: 0,
      }),
      db.insert(solvedPuzzleGroups).values({
        sessionId: session.sessionId,
        puzzleGroupId: matchedPuzzleGroupId,
        solveOrder: newSolveOrder,
      }),
      ...(willWin
        ? [
            db
              .update(gameSessions)
              .set({ status: "won", completedAt: sql`(datetime('now'))` })
              .where(eq(gameSessions.sessionId, session.sessionId)),
          ]
        : []),
    ];
    await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);

    return {
      result: "correct",
      wasOneAway: false,
      matchedPuzzleGroupId,
      session: willWin ? { ...session, status: "won" } : session,
    };
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

  const newMistakeCount = session.mistakeCount + 1;
  const willLose = newMistakeCount >= MISTAKES_MAX;

  await db.batch([
    db.insert(guesses).values({
      sessionId: session.sessionId,
      guessIndex,
      wordIdsSorted: sortedKey,
      isCorrect: 0,
      matchedPuzzleGroupId: null,
      wasOneAway: wasOneAway ? 1 : 0,
    }),
    db
      .update(gameSessions)
      .set(
        willLose
          ? { mistakeCount: newMistakeCount, status: "lost", completedAt: sql`(datetime('now'))` }
          : { mistakeCount: newMistakeCount }
      )
      .where(eq(gameSessions.sessionId, session.sessionId)),
  ] as unknown as Parameters<typeof db.batch>[0]);

  return {
    result: "incorrect",
    wasOneAway,
    matchedPuzzleGroupId: null,
    session: { ...session, mistakeCount: newMistakeCount, status: willLose ? "lost" : session.status },
  };
}

export async function resignPuzzle(db: typeof Db, playerId: string, puzzleId: string): Promise<SessionRow> {
  const session = await getOrCreateSession(db, playerId, puzzleId);
  if (session.status !== "in_progress") return session;

  await db
    .update(gameSessions)
    .set({ status: "resigned", completedAt: sql`(datetime('now'))` })
    .where(eq(gameSessions.sessionId, session.sessionId));

  return { ...session, status: "resigned" };
}
