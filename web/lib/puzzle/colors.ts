// Difficulty-tier -> color_key mapping, shared between the generator (which
// stamps color_key onto puzzle_groups) and the frontend (which maps
// color_key to the actual tile color). Single source of truth so the two
// never drift. See plan §4 for the proposed hex values per key.
export const TIER_COLOR_KEYS = ["amber", "teal", "coral", "plum"] as const;

export type ColorKey = (typeof TIER_COLOR_KEYS)[number];

export function colorKeyForTier(tier: 1 | 2 | 3 | 4): ColorKey {
  return TIER_COLOR_KEYS[tier - 1];
}

// Proposed hex values from plan §4 - distinct from both NYT's palette and
// IKEA blue/yellow (which are reserved for chrome, not tile fills).
export const COLOR_HEX: Record<ColorKey, string> = {
  amber: "#FFB000",
  teal: "#2FA88A",
  coral: "#FF6F59",
  plum: "#6A4C93",
};
