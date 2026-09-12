// project-raum src/engine/core/rng.js, the one hash paper.js seeds from
// (vendored verbatim; see README.md beside this file).
export const mix32 = (n) => {
  let h = (n >>> 0) || 1;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
};
