// Converts internal camelCase state into the snake_case wire format
// documented in plan §3. Keeping this as one function (rather than each
// route hand-rolling JSON) means there's exactly one place that decides what
// shape leaves the server.
import type { ClientGameState, ClientGroup, ClientWord } from "./game-state";

export function serializeWord(w: ClientWord) {
  return { word_id: w.wordId, display_text: w.displayText };
}

export function serializeGroup(g: ClientGroup) {
  return {
    group_id: g.groupId,
    label: g.label,
    description: g.description,
    color_key: g.colorKey,
    difficulty_tier: g.difficultyTier,
    words: g.words.map(serializeWord),
    ...(g.solvedAt ? { solved_at: g.solvedAt } : {}),
  };
}

export function serializeGameState(state: ClientGameState) {
  return {
    puzzle_id: state.puzzleId,
    words: state.words.map(serializeWord),
    mistakes_used: state.mistakesUsed,
    mistakes_max: state.mistakesMax,
    status: state.status,
    solved_groups: state.solvedGroups.map(serializeGroup),
    ...(state.revealedGroups ? { revealed_groups: state.revealedGroups.map(serializeGroup) } : {}),
  };
}

export type SerializedWord = ReturnType<typeof serializeWord>;
export type SerializedGroup = ReturnType<typeof serializeGroup>;
export type SerializedGameState = ReturnType<typeof serializeGameState>;
