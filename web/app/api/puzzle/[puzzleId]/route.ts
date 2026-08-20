import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { getClientSafeGameState } from "@/lib/puzzle/game-state";
import { serializeGameState } from "@/lib/puzzle/serialize";
import { getOrCreatePlayerId } from "@/lib/session";
import { errorToResponse } from "@/lib/api-response";

export async function GET(_req: Request, { params }: { params: Promise<{ puzzleId: string }> }) {
  try {
    const { puzzleId } = await params;
    const playerId = await getOrCreatePlayerId();
    const state = await getClientSafeGameState(db, playerId, puzzleId);
    return NextResponse.json(serializeGameState(state));
  } catch (err) {
    return errorToResponse(err);
  }
}
