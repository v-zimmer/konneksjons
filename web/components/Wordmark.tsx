// The second O in KONNEKSJONS gets the two-dot accent, but every letter is
// now the same size - an earlier "bell curve" idea enlarged S/J/Ö/N across
// the whole "SJONS" tail, which got walked back one letter at a time until
// landing here: no letter sticks out, just the umlaut for the pun. The
// whole wordmark still renders at what used to be just the O's enlarged
// size (the surrounding h1's font-size class was bumped up for that).
// Shared so the home page and puzzle page headers can't drift from each
// other.
export default function Wordmark() {
  return <>KONNEKSJÖNS</>;
}
