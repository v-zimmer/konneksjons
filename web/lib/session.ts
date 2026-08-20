import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";
import { PLAYER_COOKIE } from "@/lib/player-cookie";

// Anonymous but persistent identity: an httpOnly cookie holding a random
// UUID that's just an unguessable DB key, not a signed/JWT claim - there's
// nothing in it worth tampering with, and httpOnly already blocks JS/XSS
// read access. See plan §3 "Identity".
//
// The cookie itself is guaranteed to already exist by the time this runs -
// middleware.ts sets it before any route handles the request, since Server
// Components (unlike Route Handlers) aren't allowed to set cookies. This
// function's only job is to make sure the players row exists.
//
// One upsert instead of a select-then-branch: the DB (Turso) is remote, so
// every extra round trip is a full network hop, not just a query-planner
// cost - see the perf investigation in konneksjons_deployment memory.
export async function getOrCreatePlayerId(): Promise<string> {
  const cookieStore = await cookies();
  const playerId = cookieStore.get(PLAYER_COOKIE)?.value;
  if (!playerId) {
    throw new Error("Missing player cookie - middleware.ts should have set it before this ran.");
  }

  await db
    .insert(players)
    .values({ playerId })
    .onConflictDoUpdate({
      target: players.playerId,
      set: { lastSeenAt: sql`(datetime('now'))` },
    });

  return playerId;
}
