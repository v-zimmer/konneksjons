import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
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
export async function getOrCreatePlayerId(): Promise<string> {
  const cookieStore = await cookies();
  const playerId = cookieStore.get(PLAYER_COOKIE)?.value;
  if (!playerId) {
    throw new Error("Missing player cookie - middleware.ts should have set it before this ran.");
  }

  const [row] = await db.select().from(players).where(eq(players.playerId, playerId)).limit(1);
  if (row) {
    await db
      .update(players)
      .set({ lastSeenAt: sql`(datetime('now'))` })
      .where(eq(players.playerId, playerId));
  } else {
    await db.insert(players).values({ playerId });
  }

  return playerId;
}
