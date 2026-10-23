// @ts-check
// AUDIT DEX (2026-10-20, bible/01-Overview/audits/Audit-DEX.md D11; HOST-SPLIT, bible/01-Overview/Host-Split.md): THE
// HOSTS' REACH FOR A MOD'S CORPSE PREFAB (scenes/corpseMarker.js createCorpsePrefabs - DEX5,
// bible/04-Characters/Enemy-Expansion.md section 11), out of buildDungeonContext and createExteriorFoes, which wire it.
// What a body's prefab asks of its host - stand a new foe where it lay, take the body away, stand its ash, send a copy's
// missile to the runner - and what the audit found the hosts owed it:
//   - THE RISE STANDS FIRST (D8): the new foe is asked for, and only once it stands is the body taken - a stand refused
//     (an online grant withheld, a build that failed) leaves the body lying, to try again after its time.
//   - THE ASH IS NO SAVED OBJECT (D1, BestiaryTrollCorpseEntity.cs:65-66): the dungeon keeps its ash flats apart, and a
//     save's load takes them with the rest of the rebuilt level (`clearAsh`).
//   - A COPY'S BODY GOES WITH ITS RUNNER'S WORD (D6): told gone, a street copy drops its marker, prefab or none.
// The runner's own load doors (`settle`, `forget`) are corpseMarker.js's.

import { createCorpsePrefabs } from './corpseMarker.js';
import { hitSpellFields } from '../net/wire.js';

/**
 * The dungeon's: its runner counts down (the seat, a loose foe's owner); a RISE is a NEW loose foe of its kind where the
 * body lay - CreateEnemy's, no quest's and no slot's (spawnLooseFoe), while the dead one stays dead with no body, as DFU's
 * stays; the ASH stands by its centre, a flat of the level until a load rebuilds it; a save keeps a layout body's time by
 * its slot. DEX5b: a copy's missile sends its bundle by the lane the foe rides (the seat's number, a shared encounter's,
 * a loose foe's owner's - `cs`).
 * @param {{ isPuppetFoe: (f: any) => boolean, freeCorpse: (f: any) => void, spawnLooseFoe: (type: number, at: number[]) => Promise<any>,
 *   mintMarker: (spec: any) => Promise<any>, renderer: any, billboardBatches: any[], dead: () => boolean,
 *   onFoeHit: ((hit: any) => any) | null | undefined, foes: any[], locationKey: () => any, layoutFoes: () => number,
 *   say: (line: string) => void }} h
 */
export function createDungeonCorpsePrefabs(h) {
  const ashes = new Set();
  let gen = 0;
  const runner = createCorpsePrefabs({
    runs: (f) => !h.isPuppetFoe(f),
    body: (f) => (f.corpsePos ? { pos: f.corpsePos, size: f.corpseBatch?.size ?? null } : null),
    rise: async (f) => {
      const p = f.corpsePos ?? f.ai.feet;
      if (!(await h.spawnLooseFoe(f.mobileType, [p[0], p[1], p[2]]))) return false;
      if (f.dead && f.corpse) { f.corpseDestroyed = 1; h.freeCorpse(f); }
      return true;
    },
    vanish: (f) => { f.corpseDestroyed = 1; h.freeCorpse(f); },
    toAsh: (f, ash) => {
      const p = f.corpsePos, g = gen;
      f.corpseDestroyed = 2; h.freeCorpse(f);
      if (p) h.mintMarker({ corpseTexture: ash, feet: p, centre: ash.centre }).then((c) => {
        if (!c) return;
        if (h.dead() || g !== gen) { h.renderer.destroyBillboardBatch(c.batch); return; }
        ashes.add(c.batch); h.billboardBatches.push(c.batch);   // the level's flats draw it and destroy() frees it
      });
    },
    send: (f, spell, level) => {
      const sp = hitSpellFields(spell, level), hit = { dmg: 0, kind: 'spell', ...sp, cs: 1 };
      if (sp) h.onFoeHit?.(f._ownFrom != null ? { own: 1, to: f._ownFrom, k: h.locationKey(), i: f._ownI, ...hit } : { ...(f._encId != null ? { i: f._encId, xs: 1 } : { i: f._surI ?? h.foes.indexOf(f) }), ...hit });
    },
    say: (line) => h.say(line),
    key: (f) => { const i = h.foes.indexOf(f); return i >= 0 && i < h.layoutFoes() ? `${h.locationKey()}|${i}` : null; },
  });
  return {
    ...runner,
    /** A save's load rebuilt the level: every ash flat goes with it, and one still warming never lands. */
    clearAsh() {
      gen++;
      for (const b of ashes) { const i = h.billboardBatches.indexOf(b); if (i >= 0) h.billboardBatches.splice(i, 1); h.renderer.destroyBillboardBatch(b); }
      ashes.clear();
    },
  };
}

/**
 * The street's: the owner counts down; a RISE is the slot-neutral replacement (`replacing`, the replacement the Wabbajack
 * takes) and the body goes as removeCorpse takes one - its record ends, and every copy with it; the ASH takes the body's
 * place as its marker (by its centre - moved with the origin and the ground, collected with its pixel), so the record
 * rides on and says `bg` 2 to every copy, a late one too. DEX5b: a copy's missile sends its bundle to the owner (`cs`,
 * applyHit). The street saves no body (snapshotWorld - "Dead foes stay out"), so none is keyed.
 * @param {{ removeCorpse: (f: any) => void, spawnFoe: (type: number, at: number[], o: any) => Promise<any>,
 *   mintMarker: (spec: any) => Promise<any>, renderer: any, corpseBatches: any[], collider: any, epoch: () => number,
 *   currentPixelKey: () => any, sendHit: (f: any, hit: any) => void, say: (line: string) => void }} h
 */
export function createStreetCorpsePrefabs(h) {
  /** The body's marker off this machine's street (the copy's own flat - the owner's record is the owner's). */
  const dropMarker = (f) => {
    const body = f.corpseMarker;
    if (!body) return null;
    const i = h.corpseBatches.indexOf(body);
    if (i >= 0) h.corpseBatches.splice(i, 1);
    h.renderer.destroyBillboardBatch(body.batch);
    f.corpseMarker = null;
    return body;
  };
  return createCorpsePrefabs({
    runs: (f) => !f.puppet,
    body: (f) => f.corpseMarker ?? null,
    rise: async (f) => {
      const p = f.corpseMarker?.pos ?? f.ai.feet;
      if (!(await h.spawnFoe(f.mobileType, [p[0], p[1], p[2]], { feetGiven: true, replacing: true }))) return false;
      if (f.dead && f.corpse) h.removeCorpse(f);
      return true;
    },
    vanish: (f) => { f.corpseDestroyed = 1; if (!f.puppet) h.removeCorpse(f); else dropMarker(f); },   // D6: a copy's flat goes at its owner's word
    toAsh: (f, ash) => {
      const gen = h.epoch(), pixelKey = f.corpsePixelKey ?? h.currentPixelKey();
      f.corpseDestroyed = 2;
      const body = dropMarker(f);
      h.mintMarker({ collider: body ? null : h.collider, corpseTexture: ash, feet: body?.pos ?? f.ai.feet, centre: ash.centre }).then((c) => {
        if (!c) return;
        if (gen !== h.epoch() || f._gone || !f.corpse) { h.renderer.destroyBillboardBatch(c.batch); return; }
        c.pixelKey = f.corpsePixelKey = pixelKey; f.corpseMarker = c; h.corpseBatches.push(c);
      });
    },
    send: (f, spell, level) => { const sp = hitSpellFields(spell, level); if (sp && f.puppet) h.sendHit(f, { dmg: 0, kind: 'spell', ...sp, cs: 1 }); },
    say: (line) => h.say(line),
    key: () => null,
  });
}
