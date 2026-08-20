import { nanoid } from "nanoid";
import { and, asc, eq } from "drizzle-orm";
import type { db as Db } from "@/db/client";
import { puzzles, puzzleGroups, puzzleGroupMembers, gameSessions, solvedPuzzleGroups } from "@/db/schema";
import { createRng, shuffle } from "./rng";
import { MISTAKES_MAX } from "./constants";
import { PuzzleNotFoundError } from "./errors";

export type ClientWord = { wordId: string; displayText: string };

export type ClientGroup = {
  groupId: string; // puzzle_group_id - the client-facing id for this group instance
  label: string;
  description: string | null;
  colorKey: string;
  difficultyTier: number;
  words: ClientWord[];
  solvedAt?: string;
};

export type GameStatus = "in_progress" | "won" | "lost" | "resigned";

export type ClientGameState = {
  puzzleId: string;
  words: ClientWord[];
  mistakesUsed: number;
  mistakesMax: number;
  status: GameStatus;
  solvedGroups: ClientGroup[];
  // Only present once the game has reached a terminal loss/resignation -
  // never populated mid-game or on a win (wins reveal groups one at a time
  // via solvedGroups as they're solved). See plan §3, §4 "Security invariant".
  revealedGroups?: ClientGroup[];
};

export async function getOrCreateSession(db: typeof Db, playerId: string, puzzleId: string) {
  const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.puzzleId, puzzleId)).limit(1);
  if (!puzzle) throw new PuzzleNotFoundError(`Puzzle ${puzzleId} not found`);

  const [existing] = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.puzzleId, puzzleId), eq(gameSessions.playerId, playerId)))
    .limit(1);
  if (existing) return existing;

  const sessionId = nanoid();
  await db.insert(gameSessions).values({ sessionId, puzzleId, playerId });
  const [created] = await db.select().from(gameSessions).where(eq(gameSessions.sessionId, sessionId)).limit(1);
  return created!;
}

// The ONLY code path allowed to assemble a client-facing payload - reused by
// every API route and by the puzzle page's Server Component, per plan §3.
// Re-derives everything from the DB on every call; never trusts a cached
// notion of game state.
export async function getClientSafeGameState(
  db: typeof Db,
  playerId: string,
  puzzleId: string
): Promise<ClientGameState> {
  const session = await getOrCreateSession(db, playerId, puzzleId);

  const groups = await db.select().from(puzzleGroups).where(eq(puzzleGroups.puzzleId, puzzleId));
  const members = await db.select().from(puzzleGroupMembers).where(eq(puzzleGroupMembers.puzzleId, puzzleId));

  const membersByGroupId = new Map<string, ClientWord[]>();
  for (const m of members) {
    if (!membersByGroupId.has(m.puzzleGroupId)) membersByGroupId.set(m.puzzleGroupId, []);
    membersByGroupId.get(m.puzzleGroupId)!.push({ wordId: m.wordId, displayText: m.displayText });
  }

  const solvedRows = await db
    .select()
    .from(solvedPuzzleGroups)
    .where(eq(solvedPuzzleGroups.sessionId, session.sessionId))
    .orderBy(asc(solvedPuzzleGroups.solveOrder));

  const groupById = new Map(groups.map((g) => [g.puzzleGroupId, g]));

  const solvedGroups: ClientGroup[] = solvedRows.map((row) => {
    const group = groupById.get(row.puzzleGroupId)!;
    return {
      groupId: group.puzzleGroupId,
      label: group.label,
      description: group.description,
      colorKey: group.colorKey,
      difficultyTier: group.difficultyTier,
      words: membersByGroupId.get(group.puzzleGroupId) ?? [],
      solvedAt: row.solvedAt,
    };
  });

  // Reshuffled on every read - purely a UI arrangement concern, not
  // security-sensitive, so a fresh random order per request is fine (and
  // matches how Connections-style grids look freshly laid out on load).
  const words = shuffle(
    members.map((m) => ({ wordId: m.wordId, displayText: m.displayText })),
    createRng(crypto.randomUUID())
  );

  const isTerminalReveal = session.status === "lost" || session.status === "resigned";
  const revealedGroups: ClientGroup[] | undefined = isTerminalReveal
    ? groups.map((group) => ({
        groupId: group.puzzleGroupId,
        label: group.label,
        description: group.description,
        colorKey: group.colorKey,
        difficultyTier: group.difficultyTier,
        words: membersByGroupId.get(group.puzzleGroupId) ?? [],
      }))
    : undefined;

  return {
    puzzleId,
    words,
    mistakesUsed: session.mistakeCount,
    mistakesMax: MISTAKES_MAX,
    status: session.status as GameStatus,
    solvedGroups,
    revealedGroups,
  };
}
