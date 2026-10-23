// @ts-check
// GATE-MIX (2026-10-20, the owner: "in oblivion gates ... the game hitches"): THE NIGHT'S BODIES MADE READY BEFORE THEY
// COME. His host's, his Flame's and his own sprites were each fetched when their first body was drawn (a wave's first
// rising, the Sundering) and each frame of them decoded and uploaded the first time it showed (a new angle, a first
// swing, a first hurt) - work landing in the frames the fight is busiest in. Now the court asks, as I stand in it, for
// the archive of every body the night can show (`nightMobiles`), and uploads their frames a few a frame
// (SPRITE_WARM_UPLOADS) until all stand; the draws find them there, and upload whatever they still find missing as before.
// Design: bible/11-Multiplayer/World-Bosses.md section 28.

import { HOST } from '../../net/gate/gateBrain.js';
import { hasPortent } from '../../net/gate/gateMods.js';
import { bossLookOf, hostLookOf, flameLookOf } from '../../world/gate/gateBoss.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';

/** The most frames decoded and uploaded in one frame, and the most looked over (already standing or not). */
export const SPRITE_WARM_UPLOADS = 4;
export const SPRITE_WARM_LOOKS = 48;

/** The mobiles a night can show: him, the Tithe-Imp (any night, one in five, unannounced), his host on a Legion-Lord's
 *  night, the Vanguard's kinds on its night, his Flame on a Sundering's and the Gaolers on a Captive's - each kind by his
 *  aspect. Pure.
 *  @param {any} s the court's state @param {any} P its profile (net/gate/gateBrain.js profileOf) @returns {number[]} */
export function nightMobiles(s, P) {
  if (!s || s.day === null || s.day === undefined) return [];
  const a = P?.aspect?.id, m = new Set([bossLookOf(s.boss).mobile, hostLookOf(HOST.tithe, a).mobile]);
  if (P?.legion) for (const k of [HOST.harrier, HOST.sapper, HOST.bearer]) m.add(hostLookOf(k, a).mobile);
  if (hasPortent(s.pt, 'vanguard')) for (const k of [HOST.harrier, HOST.brute, HOST.caster, HOST.markynaz]) m.add(hostLookOf(k, a).mobile);
  if (hasPortent(s.pt, 'sunder')) m.add(flameLookOf(a).mobile);
  if (hasPortent(s.pt, 'captive')) m.add(hostLookOf(HOST.gaoler, a).mobile);
  return [...m];
}

/**
 * The court's warm-up of its bodies' sprites: `want(s, P)` asks for the night's archives (once a night), `step()` uploads
 * the next few frames not yet standing and answers how many, `clear()` forgets it all (the court left - the places'
 * hold lets the pictures go with it).
 * @param {{ getTexture?: ((archive: number) => any)|null, uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   has?: (archive: number, rkey: string) => boolean }} deps `has`: whether the frame's picture (`${record}#${frame}`) stands
 */
export function createSpriteWarm({ getTexture = null, uploadRecordFrame = null, has = () => false } = {}) {
  /** @type {Map<number, { tex: any, r: number, f: number, done: boolean }>} */
  const asked = new Map();
  let night = null;
  return {
    /** @param {any} s @param {any} P */
    want(s, P) {
      if (!getTexture || !uploadRecordFrame) return;
      const key = `${s?.day}|${s?.boss}|${P?.aspect?.id}|${P?.legion ? 1 : 0}|${s?.pt ?? ''}`;
      if (key === night) return;
      night = key;
      for (const m of nightMobiles(s, P)) {
        const archive = ENEMY_BASICS[m]?.maleTexture;
        if (!archive || asked.has(archive)) continue;
        const e = { tex: null, r: 0, f: 0, done: false };
        asked.set(archive, e);
        Promise.resolve().then(() => getTexture(archive)).then((t) => { if (t) e.tex = t; else e.done = true; }, () => { e.done = true; });
      }
    },
    /** @returns {number} */
    step() {
      let up = 0, looked = 0;
      for (const [archive, e] of asked) {
        if (e.done || !e.tex) continue;
        const R = e.tex.recordCount ?? 0;
        while (up < SPRITE_WARM_UPLOADS && looked < SPRITE_WARM_LOOKS) {
          if (e.r >= R) { e.done = true; break; }
          if (e.f >= (e.tex.getFrameCount?.(e.r) ?? 1)) { e.r++; e.f = 0; continue; }
          looked++;
          if (!has(archive, `${e.r}#${e.f}`)) { uploadRecordFrame?.(archive, e.r, e.f); up++; }
          e.f++;
        }
        if (up >= SPRITE_WARM_UPLOADS || looked >= SPRITE_WARM_LOOKS) break;
      }
      return up;
    },
    clear() { asked.clear(); night = null; },
  };
}
