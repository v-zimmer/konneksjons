"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Wordmark from "@/components/Wordmark";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Find groups of four IKEA product names that share something in
        common. Four groups, one guess at a time - four mistakes and it&apos;s
        over.
      </p>
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
