import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { generatePuzzle } from "@/lib/puzzle/generate";
import { getOrCreatePlayerId } from "@/lib/session";
import { errorToResponse } from "@/lib/api-response";

export async function POST() {
  try {
    await getOrCreatePlayerId();
    const { puzzleId } = await generatePuzzle(db);
    return NextResponse.json({ puzzle_id: puzzleId });
  } catch (err) {
    return errorToResponse(err);
  }
}
