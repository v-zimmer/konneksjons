import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { players } from "@/db/schema";

const PLAYER_COOKIE = "konneksjons_player_id";
const PLAYER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // ~2 years

// Anonymous but persistent identity: an httpOnly cookie holding a random
// UUID that's just an unguessable DB key, not a signed/JWT claim - there's
// nothing in it worth tampering with, and httpOnly already blocks JS/XSS
// read access. See plan §3 "Identity".
export async function getOrCreatePlayerId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(PLAYER_COOKIE)?.value;

  if (existing) {
    const [row] = await db.select().from(players).where(eq(players.playerId, existing)).limit(1);
    if (row) {
      await db
        .update(players)
        .set({ lastSeenAt: sql`(datetime('now'))` })
        .where(eq(players.playerId, existing));
      return existing;
    }
  }

  const playerId = crypto.randomUUID();
  await db.insert(players).values({ playerId });
  cookieStore.set(PLAYER_COOKIE, playerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PLAYER_COOKIE_MAX_AGE,
    path: "/",
  });
  return playerId;
}
