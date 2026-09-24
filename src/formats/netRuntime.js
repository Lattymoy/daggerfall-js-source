// The .NET runtime members DFU's C# leans on for a seed, ported once. A leaf: it imports nothing.
//
// AUDIT 68 S24-string-hash-duplicate: string.GetHashCode had two byte-identical homes - answerPipeline's
// knowledge seed (stringHash) and Better Ambience's dungeon fog seed (monoStringHash) - each recorded as its
// own Ledger A departure. It lives here now and both import it.

/** string.GetHashCode as Mono's corlib computes it: h = (h << 5) - h + c over the chars (Mono walks two per
 *  turn, which is the same sum), int32. The runtime's hash is not stable across processes and Unity's is not
 *  verifiable from outside (Ledger A), so a DFU player may get a different value for the same string; what
 *  the port keeps is that it is DETERMINISTIC, here as there. */
export function stringHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
