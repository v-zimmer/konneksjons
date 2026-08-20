"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { COLOR_HEX, type ColorKey } from "@/lib/puzzle/colors";
import { shuffle, createRng } from "@/lib/puzzle/rng";
import type { SerializedGameState, SerializedGroup, SerializedWord } from "@/lib/puzzle/serialize";
import Wordmark from "@/components/Wordmark";
import FitText from "@/components/FitText";

type Phase = "idle" | "submitting";

type State = {
  game: SerializedGameState;
  order: string[]; // word_ids of the currently-unsolved tiles, in display order
  selected: string[];
  phase: Phase;
  toast: string | null;
};

type Action =
  | { type: "toggle"; wordId: string }
  | { type: "clearSelection" }
  | { type: "shuffle" }
  | { type: "submitStart" }
  | { type: "submitDone"; game: SerializedGameState; toast: string | null }
  | { type: "submitError"; toast: string }
  | { type: "dismissToast" };

const MAX_SELECTED = 4;

function unsolvedWordIds(game: SerializedGameState): string[] {
  const solvedWordIds = new Set(game.solved_groups.flatMap((g) => g.words.map((w) => w.word_id)));
  return game.words.filter((w) => !solvedWordIds.has(w.word_id)).map((w) => w.word_id);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "toggle": {
      if (state.phase === "submitting" || state.game.status !== "in_progress") return state;
      const isSelected = state.selected.includes(action.wordId);
      if (isSelected) {
        return { ...state, selected: state.selected.filter((id) => id !== action.wordId) };
      }
      if (state.selected.length >= MAX_SELECTED) return state;
      return { ...state, selected: [...state.selected, action.wordId] };
    }
    case "clearSelection":
      return { ...state, selected: [] };
    case "shuffle":
      // Purely a local reorder - no server round-trip, matches NYT Connections'
      // shuffle (helps players visually regroup tiles, nothing more).
      return { ...state, order: shuffle(state.order, createRng(crypto.randomUUID())) };
    case "submitStart":
      return { ...state, phase: "submitting", toast: null };
    case "submitDone":
      return {
        ...state,
        phase: "idle",
        selected: [],
        game: action.game,
        order: unsolvedWordIds(action.game),
        toast: action.toast,
      };
    case "submitError":
      return { ...state, phase: "idle", toast: action.toast };
    case "dismissToast":
      return { ...state, toast: null };
    default:
      return state;
  }
}

export default function PuzzleBoard({ initialState }: { initialState: SerializedGameState }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    game: initialState,
    order: unsolvedWordIds(initialState),
    selected: [],
    phase: "idle",
    toast: null,
  });

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.toast) {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => dispatch({ type: "dismissToast" }), 2200);
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [state.toast]);

  const { game, order, selected, phase } = state;
  const wordById = new Map(game.words.map((w) => [w.word_id, w]));
  const gridWords = order.map((id) => wordById.get(id)).filter((w): w is SerializedWord => w !== undefined);
  const isTerminal = game.status !== "in_progress";
  const mistakesRemaining = game.mistakes_max - game.mistakes_used;

  async function submitGuess() {
    if (selected.length !== 4 || phase === "submitting") return;
    dispatch({ type: "submitStart" });
    try {
      const res = await fetch(`/api/puzzle/${game.puzzle_id}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_ids: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "submitError", toast: data.error ?? "Something went wrong." });
        return;
      }
      const toast = data.result === "incorrect" && data.was_one_away ? "One away!" : null;
      dispatch({ type: "submitDone", game: data as SerializedGameState, toast });
    } catch {
      dispatch({ type: "submitError", toast: "Network error - please try again." });
    }
  }

  async function resign() {
    if (phase === "submitting") return;
    dispatch({ type: "submitStart" });
    try {
      const res = await fetch(`/api/puzzle/${game.puzzle_id}/resign`, { method: "POST" });
      const data = await res.json();
      if (res.ok) dispatch({ type: "submitDone", game: data as SerializedGameState, toast: null });
      else dispatch({ type: "submitError", toast: data.error ?? "Something went wrong." });
    } catch {
      dispatch({ type: "submitError", toast: "Network error - please try again." });
    }
  }

  async function playAgain() {
    const res = await fetch("/api/puzzle/new", { method: "POST" });
    const data = await res.json();
    router.push(`/puzzle/${data.puzzle_id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        <Wordmark />
      </h1>

      {game.solved_groups.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          {game.solved_groups.map((group) => (
            <SolvedRow key={group.group_id} group={group} />
          ))}
        </div>
      )}

      {!isTerminal && (
        <div className="grid w-full grid-cols-4 gap-2">
          {gridWords.map((word) => (
            <button
              key={word.word_id}
              onClick={() => dispatch({ type: "toggle", wordId: word.word_id })}
              disabled={phase === "submitting"}
              className={`flex aspect-[1.9/1] items-center justify-center overflow-hidden rounded-lg border px-2 text-center font-semibold uppercase transition ${
                selected.includes(word.word_id)
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              }`}
            >
              <FitText text={word.display_text} />
            </button>
          ))}
        </div>
      )}

      {isTerminal && game.revealed_groups && (
        <div className="flex w-full flex-col gap-2">
          {game.revealed_groups
            .filter((g) => !game.solved_groups.some((s) => s.group_id === g.group_id))
            .map((group) => (
              <SolvedRow key={group.group_id} group={group} />
            ))}
        </div>
      )}

      {state.toast && (
        <div className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black">
          {state.toast}
        </div>
      )}

      {!isTerminal && (
        <>
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            Mistakes remaining:
            {Array.from({ length: game.mistakes_max }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${
                  i < mistakesRemaining ? "bg-zinc-500" : "bg-zinc-200 dark:bg-zinc-800"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => dispatch({ type: "shuffle" })}
              disabled={phase === "submitting"}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700"
            >
              Shuffle
            </button>
            <button
              onClick={() => dispatch({ type: "clearSelection" })}
              disabled={selected.length === 0 || phase === "submitting"}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700"
            >
              Deselect all
            </button>
            <button
              onClick={submitGuess}
              disabled={selected.length !== 4 || phase === "submitting"}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              Submit
            </button>
            <button
              onClick={resign}
              disabled={phase === "submitting"}
              className="rounded-full px-5 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 disabled:opacity-40 dark:hover:text-zinc-200"
            >
              Give up
            </button>
          </div>
        </>
      )}

      {isTerminal && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-semibold">
            {game.status === "won" && "You solved it! 🎉"}
            {game.status === "lost" && "Out of mistakes."}
            {game.status === "resigned" && "You gave up - here's the answer."}
          </p>
          <button
            onClick={playAgain}
            className="rounded-full bg-black px-8 py-3 text-lg font-semibold text-white dark:bg-white dark:text-black"
          >
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

function SolvedRow({ group }: { group: SerializedGroup }) {
  const hex = COLOR_HEX[group.color_key as ColorKey] ?? "#999999";
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg p-3 text-center" style={{ backgroundColor: hex }}>
      <span className="text-sm font-bold uppercase text-black/80">{group.label}</span>
      <span className="text-sm font-medium text-black/70">
        {group.words.map((w: SerializedWord) => w.display_text).join(", ")}
      </span>
    </div>
  );
}
