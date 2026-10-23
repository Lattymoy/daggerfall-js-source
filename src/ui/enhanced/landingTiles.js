// ═══════════════════════════════════════════════════════════════════
// LANDING TILES (VIRT, 2026-10-16; one home since TRADE-VIRT, 2026-10-20) — A PICTURE INTO ITS TILE, NOT A REPAINT.
//
// The enhanced screens rebuild their DOM on every state change (ui/domRepaint.js says why that is the shape), and a cold
// picture's `onReady` was the screen's `render`: a pile of 312 cold pictures was 311 whole repaints of the pack (VIRT,
// bible/10-UI/UI-Arc.md). And where `onReady` was a fresh function a row (the player-to-player window's), the fitted
// door woke each of up to eight per picture (ui/textureCanvas.js WAKE_MAX), and each wake was a repaint that signed more
// rows up for the pictures still on their way: 2,160 repaints of a 300-piece pack, 200 s to settle (TRADE-VIRT,
// bible/07-Rendering/Performance-Priority.md).
//
// A tile drawn on its initials waits here with what it was drawn from; a landing asks for ONE pass on the next frame,
// and the pass gives each waiting tile the tile `draw` makes for the same spec now, the wear bar the old one carried.
// The pictures that land together are one pass; a tile still waiting stays waiting; a tile a repaint threw away (no
// longer in the document), or every tile once the screen is gone (`alive`), is dropped, never drawn into. The pack's,
// the shop counter's and the trade between players' windows each keep one.
// ═══════════════════════════════════════════════════════════════════

const nextFrame = (f) => (globalThis.requestAnimationFrame ?? ((g) => setTimeout(g, 16)))(f);

/**
 * `draw(spec, landed)` makes a tile for `spec` - `has-icon` when its picture is made, its initials otherwise - and hands
 * `landed` to the picture's door as its `onReady`. Answers `{ tile(spec), clear(), counts, reset() }`: `tile` draws one
 * and keeps it waiting when it has no picture yet; `clear` forgets every waiting tile (a repaint, an unmount); `counts`
 * the passes run (`landings`) and the tiles they painted (`painted`) since the last `reset`.
 * @template S
 * @param {(spec: S, landed: () => void) => any} draw
 * @param {{ alive?: () => boolean, later?: (f: () => void) => any }} [o]
 */
export function landingTiles(draw, { alive = () => true, later = nextFrame } = {}) {
  /** the initials tile -> the spec it was drawn from */
  const waiting = new Map();
  let queued = false;
  const counts = { landings: 0, painted: 0 };
  const landed = () => {
    if (queued) return;
    queued = true;
    later(pass);
  };
  function pass() {
    queued = false;
    counts.landings++;
    for (const [tile, spec] of waiting) {
      if (!alive() || tile.isConnected === false) { waiting.delete(tile); continue; }
      const fresh = draw(spec, landed);
      if (!fresh.classList.contains('has-icon')) continue;   // its picture is still being made - the pass is every waiting tile's, and another picture woke it
      waiting.delete(tile);
      const bar = tile.querySelector('.wear');
      if (bar) fresh.append(bar);
      tile.replaceWith(fresh);
      counts.painted++;
    }
  }
  return {
    /** @param {S} spec */
    tile(spec) {
      const t = draw(spec, landed);
      if (!t.classList.contains('has-icon')) waiting.set(t, spec);
      return t;
    },
    clear() { waiting.clear(); },
    counts,
    reset() { counts.landings = 0; counts.painted = 0; },
  };
}
