import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getClientSafeGameState } from "@/lib/puzzle/game-state";
import { serializeGameState } from "@/lib/puzzle/serialize";
import { getOrCreatePlayerId } from "@/lib/session";
import { PuzzleNotFoundError } from "@/lib/puzzle/errors";
import PuzzleBoard from "./PuzzleBoard";

// Server Component: calls the SAME getClientSafeGameState function the API
// routes use, so the initial SSR payload can never diverge from what the
// XHRs would return (plan §3/§6 - no separate "page assembly" code path).
export default async function PuzzlePage({
  params,
}: {
  params: Promise<{ puzzleId: string }>;
}) {
  const { puzzleId } = await params;
  const playerId = await getOrCreatePlayerId();

  let state;
  try {
    state = await getClientSafeGameState(db, playerId, puzzleId);
  } catch (err) {
    if (err instanceof PuzzleNotFoundError) {
      notFound();
    }
    throw err;
  }

  return <PuzzleBoard initialState={serializeGameState(state)} />;
}
