// @ts-check
// THE SERVICE'S DICE - a random unit off the service's CSPRNG (`ctx.rand`, crypto.getRandomValues). It lived in
// professions.js (PROF1: "the yield, and a gem, are the service's dice") until SILVER-FINDS needed it in marks.js too,
// which professions.js imports - so it stands here, below both, and professions.js re-exports it as `profDice` for the
// files that read it there (motherlodes.js).

/** A random unit in [0, 1) from the service's CSPRNG. */
export function dice(rand) {
  const b = new Uint32Array(1);
  rand(new Uint8Array(b.buffer));
  return b[0] / 4294967296;
}
