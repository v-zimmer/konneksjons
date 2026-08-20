import { NextResponse } from "next/server";
import {
  PuzzleNotFoundError,
  ValidationError,
  GameOverError,
  DuplicateGuessError,
} from "./puzzle/errors";

export function errorToResponse(err: unknown): NextResponse {
  if (err instanceof PuzzleNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof GameOverError || err instanceof DuplicateGuessError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  // Never leak stack traces / internals to the client (plan §6 checklist).
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
