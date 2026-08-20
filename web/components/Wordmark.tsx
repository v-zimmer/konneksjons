// The second O in KONNEKSJONS gets the two-dot accent, and it's the only
// letter that's enlarged - S, J, and N picked up extra size at one point
// from an earlier "bell curve" idea across the whole "SJONS" tail, but that
// read as more letters being bigger than intended, so they're back to the
// same size as the rest. The whole wordmark still renders at what used to
// be just the O's enlarged size (the surrounding h1's font-size class was
// bumped up for that). Shared so the home page and puzzle page headers
// can't drift from each other.
export default function Wordmark() {
  return (
    <>
      KONNEKSJ<span style={{ fontSize: "1.4em" }}>Ö</span>NS
    </>
  );
}
