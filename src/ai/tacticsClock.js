// @ts-check
// TACT (AUDIT TACT, 2026-10-02): THE BRAIN'S CLOCK IS THE FOES' OWN TIME. The tactics brain (ai/tactics.js) and the
// telegraphed blows (ai/foeBlows.js) read one clock - patience, the beat after a blow, a wind-up's landing, a token's
// staleness - and it runs on the time the foes are stepped with, not the wall: each host ticks it with the frame's
// foe step (0 under whatever holds the foes), so a window or a quest box held over a fight freezes the brain with the
// bodies, a slow frame slows both alike, and nothing expires while nobody moved.

let _t = 0;
let _override = null;
/** Each host, once a frame: the foes' step (the frame's foe dt, capped as the pools cap it; 0 when they are held). */
export function tickTactics(dt) {
  if (dt > 0 && Number.isFinite(dt)) _t += dt;
}
/** The brain's now, seconds. */
export const tacticsNow = () => (_override ? _override() : _t);
/** Tests: drive the clock (null: back to the ticked one). */
export function setTacticsClock(fn) {
  _override = typeof fn === 'function' ? fn : null;
}
