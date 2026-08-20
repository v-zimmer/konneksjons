import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PLAYER_COOKIE, PLAYER_COOKIE_MAX_AGE } from "@/lib/player-cookie";

// Next.js Server Components aren't allowed to set cookies (only Route
// Handlers and Server Actions can) - see
// https://nextjs.org/docs/app/api-reference/functions/cookies#options. But
// the puzzle page is a Server Component that needs a player id on the very
// first request (e.g. someone landing directly on a shared /puzzle/<id>
// link). Middleware runs before any route and CAN set cookies, so it's the
// one place that guarantees the cookie exists by the time anything renders.
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(PLAYER_COOKIE)?.value;
  if (existing) return NextResponse.next();

  const playerId = crypto.randomUUID();
  // Mutate the request's cookies too, not just the response's, so this same
  // request's Server Components/Route Handler see it immediately rather
  // than only the *next* request (after the browser stores the Set-Cookie).
  request.cookies.set(PLAYER_COOKIE, playerId);
  const response = NextResponse.next({ request });
  response.cookies.set(PLAYER_COOKIE, playerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PLAYER_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
