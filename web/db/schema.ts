import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Content tables — lean, generic, populated only by the offline publish step
// (scripts/publish_app_content.py). No IKEA-specific concepts live here.
// ---------------------------------------------------------------------------

export const contentWords = sqliteTable("content_words", {
  wordId: text("word_id").primaryKey(),
  displayText: text("display_text").notNull(),
});

export const contentGroups = sqliteTable("content_groups", {
  groupId: text("group_id").primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
  difficultyHint: integer("difficulty_hint"),
  adminTag: text("admin_tag"),
});

export const contentGroupMembers = sqliteTable(
  "content_group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => contentGroups.groupId),
    wordId: text("word_id")
      .notNull()
      .references(() => contentWords.wordId),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.wordId] }),
    index("idx_content_group_members_word").on(t.wordId),
  ]
);

// Symmetric: the publish step inserts both (a,b) and (b,a).
export const contentGroupConflicts = sqliteTable(
  "content_group_conflicts",
  {
    groupIdA: text("group_id_a")
      .notNull()
      .references(() => contentGroups.groupId),
    groupIdB: text("group_id_b")
      .notNull()
      .references(() => contentGroups.groupId),
  },
  (t) => [primaryKey({ columns: [t.groupIdA, t.groupIdB] })]
);

// ---------------------------------------------------------------------------
// Game-state tables — app-owned, live-written
// ---------------------------------------------------------------------------

export const puzzles = sqliteTable(
  "puzzles",
  {
    puzzleId: text("puzzle_id").primaryKey(),
    puzzleType: text("puzzle_type").notNull(),
    scheduledDate: text("scheduled_date"),
    status: text("status").notNull().default("active"),
    seed: text("seed"),
    generatorVersion: text("generator_version"),
    createdBy: text("created_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    check("chk_puzzles_puzzle_type", sql`${t.puzzleType} IN ('procedural','curated')`),
    check("chk_puzzles_status", sql`${t.status} IN ('draft','active','archived')`),
    uniqueIndex("idx_puzzles_scheduled_date")
      .on(t.scheduledDate)
      .where(sql`${t.scheduledDate} IS NOT NULL`),
  ]
);

export const puzzleGroups = sqliteTable(
  "puzzle_groups",
  {
    puzzleGroupId: text("puzzle_group_id").primaryKey(),
    puzzleId: text("puzzle_id")
      .notNull()
      .references(() => puzzles.puzzleId),
    difficultyTier: integer("difficulty_tier").notNull(),
    colorKey: text("color_key").notNull(),
    // Nullable: curated puzzles may not map back to the content pool.
    sourceGroupId: text("source_group_id").references(() => contentGroups.groupId),
    label: text("label").notNull(),
    description: text("description"),
  },
  (t) => [
    check("chk_puzzle_groups_tier", sql`${t.difficultyTier} BETWEEN 1 AND 4`),
    uniqueIndex("idx_puzzle_groups_puzzle_tier").on(t.puzzleId, t.difficultyTier),
    index("idx_puzzle_groups_puzzle").on(t.puzzleId),
  ]
);

export const puzzleGroupMembers = sqliteTable(
  "puzzle_group_members",
  {
    puzzleGroupId: text("puzzle_group_id")
      .notNull()
      .references(() => puzzleGroups.puzzleGroupId),
    puzzleId: text("puzzle_id").notNull(),
    wordId: text("word_id")
      .notNull()
      .references(() => contentWords.wordId),
    // Snapshot at generation time, independent of later content edits.
    displayText: text("display_text").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.puzzleGroupId, t.wordId] }),
    uniqueIndex("idx_puzzle_group_members_puzzle_word").on(t.puzzleId, t.wordId),
  ]
);

export const players = sqliteTable("players", {
  playerId: text("player_id").primaryKey(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  lastSeenAt: text("last_seen_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const gameSessions = sqliteTable(
  "game_sessions",
  {
    sessionId: text("session_id").primaryKey(),
    puzzleId: text("puzzle_id")
      .notNull()
      .references(() => puzzles.puzzleId),
    playerId: text("player_id")
      .notNull()
      .references(() => players.playerId),
    status: text("status").notNull().default("in_progress"),
    mistakeCount: integer("mistake_count").notNull().default(0),
    startedAt: text("started_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
  },
  (t) => [
    check(
      "chk_game_sessions_status",
      sql`${t.status} IN ('in_progress','won','lost','resigned')`
    ),
    uniqueIndex("idx_game_sessions_puzzle_player").on(t.puzzleId, t.playerId),
    index("idx_game_sessions_player").on(t.playerId),
  ]
);

export const solvedPuzzleGroups = sqliteTable(
  "solved_puzzle_groups",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.sessionId),
    puzzleGroupId: text("puzzle_group_id")
      .notNull()
      .references(() => puzzleGroups.puzzleGroupId),
    solveOrder: integer("solve_order").notNull(),
    solvedAt: text("solved_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.puzzleGroupId] })]
);

export const guesses = sqliteTable(
  "guesses",
  {
    guessId: integer("guess_id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.sessionId),
    guessIndex: integer("guess_index").notNull(),
    // JSON array of 4 word ids, canonically sorted.
    wordIdsSorted: text("word_ids_sorted").notNull(),
    isCorrect: integer("is_correct").notNull(),
    matchedPuzzleGroupId: text("matched_puzzle_group_id").references(
      () => puzzleGroups.puzzleGroupId
    ),
    wasOneAway: integer("was_one_away").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("idx_guesses_session_words").on(t.sessionId, t.wordIdsSorted),
    index("idx_guesses_session").on(t.sessionId),
  ]
);

export const playerStats = sqliteTable("player_stats", {
  playerId: text("player_id")
    .primaryKey()
    .references(() => players.playerId),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  maxStreak: integer("max_streak").notNull().default(0),
  totalMistakes: integer("total_mistakes").notNull().default(0),
  lastPlayedDate: text("last_played_date"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
