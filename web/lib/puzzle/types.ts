export type ContentWordRef = {
  wordId: string;
  displayText: string;
};

export type ContentGroupRef = {
  groupId: string;
  label: string;
  description: string | null;
  difficultyHint: number | null;
};

// Everything the pure generation logic needs, loaded once from the DB.
export type ContentPool = {
  groups: ContentGroupRef[];
  conflicts: Map<string, Set<string>>;
  membersByGroup: Map<string, ContentWordRef[]>;
};

export type PickedGroup = {
  groupId: string;
  label: string;
  description: string | null;
  difficultyHint: number | null;
  words: [ContentWordRef, ContentWordRef, ContentWordRef, ContentWordRef];
};

export type TieredGroup = PickedGroup & {
  difficultyTier: 1 | 2 | 3 | 4;
  colorKey: string;
};
