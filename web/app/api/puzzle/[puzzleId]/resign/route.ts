import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { resignPuzzle } from "@/lib/puzzle/guess";
import { getClientSafeGameState } from "@/lib/puzzle/game-state";
import { serializeGameState } from "@/lib/puzzle/serialize";
import { getOrCreatePlayerId } from "@/lib/session";
import { errorToResponse } from "@/lib/api-response";

export async function POST(_req: Request, { params }: { params: Promise<{ puzzleId: string }> }) {
  try {
    const { puzzleId } = await params;
    const playerId = await getOrCreatePlayerId();
    const session = await resignPuzzle(db, playerId, puzzleId);
    const state = await getClientSafeGameState(db, playerId, puzzleId, session);
    return NextResponse.json(serializeGameState(state));
  } catch (err) {
    return errorToResponse(err);
  }
}
