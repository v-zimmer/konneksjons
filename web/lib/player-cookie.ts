// Shared between middleware.ts (which creates the cookie) and session.ts
// (which reads it) so the two can't drift apart.
export const PLAYER_COOKIE = "konneksjons_player_id";
export const PLAYER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // ~2 years
