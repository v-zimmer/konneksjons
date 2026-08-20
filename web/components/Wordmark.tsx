// The second O in KONNEKSJONS gets the two-dot accent. The whole wordmark
// renders at what used to be just the O's enlarged size (bump the
// surrounding h1's font-size class to raise this "base"), and the tail
// "SJONS" rides a symmetric bell curve on top of that base - S and S just a
// touch bigger, J and N a bit more, Ö biggest at the peak. Shared so the
// home page and puzzle page headers can't drift from each other.
export default function Wordmark() {
  return (
    <>
      KONNEK
      <span style={{ fontSize: "1.1em" }}>S</span>
      <span style={{ fontSize: "1.2em" }}>J</span>
      <span style={{ fontSize: "1.4em" }}>Ö</span>
      <span style={{ fontSize: "1.2em" }}>N</span>
      <span style={{ fontSize: "1.1em" }}>S</span>
    </>
  );
}
