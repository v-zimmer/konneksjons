"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Wordmark from "@/components/Wordmark";
import WavingExclamation from "@/components/WavingExclamation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wave, setWave] = useState(0);

  async function handlePlay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/puzzle/new", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create puzzle");
      const data = (await res.json()) as { puzzle_id: string };
      router.push(`/puzzle/${data.puzzle_id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-6xl font-bold tracking-tight">
        <Wordmark />
      </h1>
      <div className="flex w-full max-w-md flex-col items-start text-left">
        <h2 className="text-4xl font-bold tracking-tight">
          <span
            aria-hidden="true"
            className="cursor-pointer"
            onMouseEnter={() => setWave((w) => w + 1)}
            onClick={() => setWave((w) => w + 1)}
          >
            Hej
            <WavingExclamation trigger={wave} />
          </span>
          <span className="sr-only">Hej!</span>
        </h2>
        <p aria-hidden="true">&nbsp;</p>
        <p>
          Welcome to{" "}
          <strong className="font-bold">
            <Wordmark />
          </strong>
          ,
        </p>
        <p className="w-full text-zinc-600 dark:text-zinc-400">
          Find groups of four IKEA product names that share something in
          common. Four groups, one guess at a time - four mistakes and it&apos;s
          over.
        </p>
      </div>
      <button
        onClick={handlePlay}
        disabled={loading}
        className="rounded-full bg-black px-10 py-3 text-lg font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {loading ? "Loading…" : "Play"}
      </button>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
