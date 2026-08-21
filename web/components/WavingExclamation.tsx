"use client";

import { useState } from "react";

// The "!" itself is the hand: the dot is the elbow (fixed), and the bar
// above it is the forearm, pivoting from its own base (right where it meets
// the dot) so the top swings further than the bottom - same geometry as a
// waving hand. Idle almost all the time, waves briefly on a loop (see the
// wave-hand keyframes in globals.css) - or immediately when `trigger`
// changes (the parent bumps this on hover/click), via a snappier one-shot
// version of the same motion (wave-hand-once).
export default function WavingExclamation({ trigger }: { trigger?: number }) {
  const [waveKey, setWaveKey] = useState(0);
  const [isManualWave, setIsManualWave] = useState(false);
  // Adjusting state during render (not in an effect) when a prop changes is
  // the pattern React itself recommends for "reset/react to a prop change"
  // instead of an effect that calls setState directly - see
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [prevTrigger, setPrevTrigger] = useState(trigger);
  if (trigger !== prevTrigger) {
    setPrevTrigger(trigger);
    if (trigger) {
      setIsManualWave(true);
      setWaveKey((k) => k + 1);
    }
  }

  return (
    <span className="relative inline-block h-[1em] w-[0.3em] align-baseline">
      {/* Centered via left/margin, not translate-x - the keyframes already
          animate `transform: rotate(...)`, and mixing Tailwind's translate
          utility (a separate `translate` property in Tailwind v4) with that
          double-shifted the bar sideways instead of keeping it centered. */}
      <span
        key={waveKey}
        className="absolute bottom-[0.19em] left-1/2 ml-[-0.065em] h-[0.52em] w-[0.13em] origin-bottom rounded-full bg-current"
        style={{
          animation: isManualWave ? "wave-hand-once 0.6s ease-in-out" : "wave-hand 9s ease-in-out infinite",
        }}
        onAnimationEnd={() => setIsManualWave(false)}
      />
      <span className="absolute bottom-0 left-1/2 ml-[-0.065em] h-[0.13em] w-[0.13em] rounded-full bg-current" />
    </span>
  );
}
