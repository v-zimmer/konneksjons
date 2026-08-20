"use client";

import { useLayoutEffect, useRef, useState } from "react";

const MAX_FONT_PX = 18;
const MIN_FONT_PX = 11;
const STEP_PX = 1;

// Same trick NYT Connections uses on its tiles: text always renders on one
// line at the largest font size that still fits its container, shrinking in
// steps rather than wrapping or overflowing. Measures actual rendered width
// (scrollWidth vs the parent's clientWidth) instead of guessing from
// character count, since that's the only way to get it right across
// varying letter widths (compare "OXFORD" vs "SOCIAL SECURITY" at the same
// tile size on the real NYT site).
//
// Assumes `text` is stable for the component's lifetime (callers should key
// on whatever identifies the text, e.g. a word id, so a genuinely different
// word mounts a fresh instance rather than reusing this one at a stale
// shrunk size).
export default function FitText({ text }: { text: string }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT_PX);

  useLayoutEffect(() => {
    const el = spanRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    if (el.scrollWidth > parent.clientWidth && fontSize > MIN_FONT_PX) {
      setFontSize((f) => Math.max(MIN_FONT_PX, f - STEP_PX));
    }
  }, [fontSize, text]);

  return (
    <span ref={spanRef} style={{ fontSize }} className="whitespace-nowrap">
      {text}
    </span>
  );
}
