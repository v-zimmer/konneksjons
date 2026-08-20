import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { submitGuess } from "@/lib/puzzle/guess";
import { getClientSafeGameState } from "@/lib/puzzle/game-state";
import { serializeGameState, serializeGroup } from "@/lib/puzzle/serialize";
import { getOrCreatePlayerId } from "@/lib/session";
import { errorToResponse } from "@/lib/api-response";

export async function POST(req: Request, { params }: { params: Promise<{ puzzleId: string }> }) {
  try {
    const { puzzleId } = await params;
    const playerId = await getOrCreatePlayerId();
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);

    const guessResult = await submitGuess(db, playerId, puzzleId, (body as { word_ids?: unknown }).word_ids);
    const state = await getClientSafeGameState(db, playerId, puzzleId);

    const matchedGroup =
      guessResult.result === "correct"
        ? state.solvedGroups.find((g) => g.groupId === guessResult.matchedPuzzleGroupId)
        : undefined;

    return NextResponse.json({
      result: guessResult.result,
      was_one_away: guessResult.wasOneAway,
      matched_group: matchedGroup ? serializeGroup(matchedGroup) : undefined,
      ...serializeGameState(state),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
