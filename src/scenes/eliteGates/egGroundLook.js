// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md sections 3
// and 4): THE RUIN AND THE WRECK ON THIS SCREEN - a circle's ruin (world/eliteGates/egRuin.js: one mesh a hall, the academy that is
// not the law) and its band's wreck (world/eliteGates/egVista.js: the torn wings drifting out from the hall, the sealed Spire's
// underside overhead), made into the renderer's meshes and handed to the level as draws, every one noShadow:
//   THE RUIN is the circle's - stood with it (from the swap's worker's build, or built here at a stand), freed with it; a
//     frame draws only the ruin of the hall the eye stands in (the halls stand EG_HALL_PITCH apart, far past the fog);
//   THE WRECK is the band's - made the first time a circle of the band stands, kept while the band's circles follow one
//     another, freed when another band's stands or the breach ends; a frame places its wings about the hall the eye stands
//     in, turning on the shared clock (the same turn on every screen), and hangs the Spire's underside from the eye - its
//     meshes and their turning scenes/eliteGates/egWreckLook.js's (the wings batched: four draws a band).
// The circle's host (scenes/eliteGates/egCircleHost.js) lays the draws in the level's context and takes them out again; the Spire lab
// (src/tools/spireLab.js) draws the same. Nothing here is a collider and nothing here moves the law.
//   THE RUIN'S OCCLUDERS (EG-ZN's law - Elite-Gates.md section 11.8): its tall pieces (a column and its fixture or its
//     entablature, a statue on its plinth, an arch, an obelisk, a thicket, a pylon - world/eliteGates/egRuin.js `model.occluders`)
//     dither out of a third-person camera's way as the circle's rock does: a dither pass a ruin (scenes/eliteGates/egOcclude.js, its
//     shadow unrecorded - the ruin casts none), the eye's hall's tried on the frame's ray, laid beside the circle's
//     (`occluders(circle)` - the circle's host hands its pass to it and keeps one pass for both).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { buildEgRuinParts } from '../../world/eliteGates/egRuin.js';
import { createEgWreckLook } from './egWreckLook.js';   // EG-LOOK (section 4): THE WRECK's meshes, batched and turned
import { egCircleSpecs, egBandOfCircle, EG_HALL_PITCH } from '../../net/eliteGates/egLaw.js';
import { SD_REALM_ORIGIN } from '../../net/superDungeon/sdBrain.js';
import { identity } from '../../world/mat4.js';
import { isTouchDevice } from '../../ui/touch/touchDevice.js';
import { createEgOccluders } from './egOcclude.js';   // EG-LOOK: the ruin's tall pieces dither out of the camera's way

/**
 * @param {{ renderer?: any, lite?: boolean }} [deps] `lite` the phones' tier (ui/touch/touchDevice.js - the Hour's own:
 *   scenes/superDungeon/sdHang.js)
 */
export function createEgGroundLook({ renderer = null, lite = isTouchDevice() } = {}) {
  const IDENT = identity();
  /** @type {Array<{ h: number, x0: number, gpu: any, draw: any, occ: any }>} */
  let ruins = [];
  /** The hall the eye stands in (its origin along the level) - its ruin drawn and tried for the camera's ray. */
  let eyeX0 = NaN;
  /** The circle's halls: each one's origin along the level, its course's middle (the wreck's anchor) and whether it is a
   *  Court (its lord's: the wreck stands at its Court places there). */
  let halls = /** @type {Array<{ x0: number, zc: number, court: boolean }>} */ ([]);
  /** THE WRECK: the band's wings and the Spire's underside (scenes/eliteGates/egWreckLook.js). */
  const wreck = createEgWreckLook({ renderer, lite });
  const make = (model) => {
    if (!model || !renderer?.createMesh) return null;
    try { return renderer.createMesh(model); } catch (e) { console.warn('[eg] the ruin would not build', e?.message ?? e); return null; }
  };
  const free = (gpu) => { if (gpu) { try { renderer?.destroyMesh?.(gpu); } catch { /* gone */ } } };
  const drawOf = (gpu, matrix) => (gpu ? { gpu, object: { matrix }, noShadow: true, hidden: false } : null);
  /** Every ruin let go: each one's dither pass first (its views over the mesh), then its mesh - the slot emptied first. */
  function dropRuins() {
    const was = ruins;
    ruins = []; eyeX0 = NaN;
    for (const r of was) { r.occ?.clear(); free(r.gpu); }
  }
  const api = {
    lite,
    /** Circle `c` stood: its halls' ruins (`built` the swap's worker's parts.ruins, else built here) and its band's wreck
     *  (`vistaBuilt` the worker's parts.vista, else made here when the band is new). Answers every draw to lay in the level. */
    stand(seed, c, geo = 0, built = null, vistaBuilt = null) {
      halls = egCircleSpecs(seed, c, geo).map((s) => ({ x0: s.x0, zc: (s.len ?? 80) / 2, court: !!s.lord }));
      let parts = built;
      if (!Array.isArray(parts)) { try { parts = buildEgRuinParts(seed, c, geo, { lite }); } catch (e) { console.warn('[eg] the ruin would not build', e?.message ?? e); parts = []; } }
      dropRuins();
      for (const p of parts) {
        const gpu = make(p.model);
        if (!gpu) continue;
        const draw = drawOf(gpu, IDENT), occ = createEgOccluders({ renderer, shadow: false });
        occ.set(gpu, p.model); occ.stand(draw);
        ruins.push({ h: p.h, x0: p.x0, gpu, draw, occ });
      }
      wreck.stand(egBandOfCircle(c), vistaBuilt);   // the band's wreck: `vistaBuilt` the worker's, else made here when the band is new
      return api.draws();
    },
    /** Every draw it holds (the ruin's, then the wreck's). */
    draws() { return [...ruins.map((r) => r.draw), ...wreck.draws()].filter(Boolean); },
    /** A frame: the ruin of the hall `eye` (the dungeon's frame) stands in drawn, the others hidden; the wreck's wings
     *  placed about that hall's centre and turned on the shared clock `seconds`, the underside hung from the eye. */
    frame(eye, seconds = 0) {
      if (!eye || !halls.length) return;
      const ex = eye[0] - SD_REALM_ORIGIN[0];
      let at = halls[0];
      for (const hl of halls) if (Math.abs(hl.x0 - ex) < Math.abs(at.x0 - ex)) at = hl;
      if (at.x0 !== eyeX0) { eyeX0 = at.x0; for (const r of ruins) r.occ.stand(r.draw); }   // another hall: every ruin's dither let go
      for (const r of ruins) if (r.draw) r.draw.hidden = Math.abs(r.x0 - at.x0) > EG_HALL_PITCH / 2;
      wreck.frame(eye, SD_REALM_ORIGIN[0] + at.x0, SD_REALM_ORIGIN[1], SD_REALM_ORIGIN[2] + at.zc, seconds, at.court);   // the hall's centre (net/superDungeon/sdBrain.js realmToDungeon's, nothing made)
    },
    /** The circle let go: every draw of its taken out of `list` (the level's dynamic draws), its ruins' meshes freed (the
     *  wreck stays: the band's). Answers how many meshes it freed. */
    down(list = null) {
      const mine = new Set(api.draws());
      if (Array.isArray(list)) for (let i = list.length - 1; i >= 0; i--) if (mine.has(list[i])) list.splice(i, 1);
      const n = ruins.filter((r) => r.gpu).length;
      dropRuins(); halls = [];
      return n;
    },
    /** The breach's end: the wreck freed too (the circle's ruins already went with it). */
    release() { dropRuins(); halls = []; wreck.release(); },
    /**
     * THE ONE DITHER PASS (scenes/eliteGates/egOcclude.js's shape - the host's `egOcc`): the circle's pass `circle` and the eye's hall's
     * ruin's, tried on the one ray and drawn one after the other; the circle's own seams (set, stand, clear, shares) and its
     * stats as they were, the ruin's beside them (`stats().ruin`).
     * @param {any} circle
     */
    occluders(circle) {
      const eyes = () => ruins.filter((r) => r.x0 === eyeX0);
      return {
        set: (gpu, model) => circle.set(gpu, model), stand: (d) => circle.stand(d), clear: () => circle.clear(), shares: () => circle.shares(),
        frame(f) { let n = circle.frame(f); for (const r of eyes()) n += r.occ.frame(f); return n; },
        draw(texRemap = null) { let n = circle.draw(texRemap); for (const r of eyes()) n += r.occ.draw(texRemap); return n; },
        stats: () => ({ ...circle.stats(), ruin: eyes().reduce((a, r) => { const q = r.occ.stats(); return { pieces: a.pieces + q.pieces, dithering: a.dithering + q.dithering, glDraws: a.glDraws + q.glDraws }; }, { pieces: 0, dithering: 0, glDraws: 0 }) }),
      };
    },
    /** What it holds (tests, stats). */
    stats: () => { const w = wreck.stats(); return { ruins: ruins.length, drawn: ruins.filter((r) => r.draw && !r.draw.hidden).length, band: w.band, wreck: w.wings + (w.under ? 1 : 0), wreckDraws: w.draws, wreckTris: w.tris }; },
  };
  return api;
}
