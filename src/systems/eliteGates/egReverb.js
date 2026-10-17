// @ts-check
// EG-ZH (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11.9, "Sound"): THE
// HALL'S REVERB - each hall of the Spire heard in its own space, set behind the veil when the player comes to stand in it
// (a swap's new circle, a pull to the next hall's plate) from its fragments' presets (net/eliteGates/egFragLaw.js EG_FRAGS `reverb`,
// carried on each hall spec's `frags`: Cave in the caverns, Stoneroom in the Stacks and the Ossuary, Quarry in the open
// ones), and turned within the hall only by crossfading two convolvers made at that moment (systems/audio.js reverbZone and
// reverbFade - each preset's impulse made once for the hold), over EG_REVERB_FADE_S at a fragment's mouth, with
// EG_REVERB_HYST_M of hysteresis. While the Spire holds the zone (audio.holdReverb) Better Ambience yields
// (systems/betterAmbience.js updateReverb) and its cache is forgotten; every way out lets it go.
//
// A hall with no fragment of its own is open ground over the void: its space is the open fragments' (Quarry, the most open of
// the three presets - THE HALL'S OWN, `EG_REVERB_OPEN`). A fragment's footprint is its z-span along the hall and its reach
// across it - a passage's walls (its cave's half width), a chamber's ring - so a fork's two roads are each their own.
//
// The law is pure (egReverbPreset, egHallReverb, egReverbZoneAt); `createEgReverb` is its seam over the engine, the breach
// client's (scenes/eliteGates/egClient.js).
//
// Not a DFU member. Ledger A (ELITE-GATES).

/** The fragments' law names (net/eliteGates/egFragLaw.js EG_FRAGS `reverb`, net/eliteGates/egLaw.js's set pieces) as the engine's presets
 *  (systems/reverbPresets.js REVERB_PRESET - Better Ambience's three). */
export const EG_REVERB_PRESETS = Object.freeze({ cave: 'Cave', stoneroom: 'Stoneroom', quarry: 'Quarry' });
/** The space of a hall with no fragment of its own - open ground, the open fragments' preset. */
export const EG_REVERB_OPEN = 'Quarry';
/** The crossfade at a mouth (s), and its hysteresis (m): a zone is entered at its edge, and left only this far past it. */
export const EG_REVERB_FADE_S = 0.4;
export const EG_REVERB_HYST_M = 1;
/** Who holds the engine's zone while the player stands in a breach (systems/audio.js holdReverb). */
export const EG_REVERB_OWNER = 'eg:spire';

/** A fragment's law name as the engine's preset - null for one the engine has no preset of. Pure. */
export const egReverbPreset = (name) => (typeof name === 'string' ? EG_REVERB_PRESETS[name.toLowerCase()] ?? null : null);

/**
 * A HALL'S REVERB, PLANNED (pure): `{ base, zones, second }` - `base` the hall's own space (EG_REVERB_OPEN), `zones` each
 * fragment's `{ x, half, z0, z1, preset }` (the hall's frame, metres; `half` its reach across the hall - its cave's half
 * width for a passage, half its span for a chamber), and `second` the preset the zone is likeliest to turn to (the first
 * fragment's that is not the base's), made beside the base at the swap.
 * @param {any} spec a hall spec (net/eliteGates/egLaw.js egHallOf)
 */
export function egHallReverb(spec) {
  const zones = [];
  for (const f of spec?.frags ?? []) {
    const preset = egReverbPreset(f.reverb);
    if (!preset) continue;
    const cave = f.cls === 'passage' ? (spec.caves ?? []).find((q) => Math.abs(q.x - f.x) < 0.5 && q.z0 <= f.z0 + 0.5 && q.z1 >= f.z1 - 0.5) : null;
    const hero = f.hero ? (spec.heroes ?? []).find((q) => q.f === spec.frags.indexOf(f)) : null;   // EG-HERO-LAY: a hero's reach across, its box's
    const half = hero ? Math.max(f.x - hero.box[0], hero.box[3] - f.x) : cave ? cave.halfW : f.cls === 'chamber' ? (f.z1 - f.z0) / 2 : 6;
    zones.push({ x: f.x, half, z0: f.z0, z1: f.z1, preset });
  }
  const second = zones.find((q) => q.preset !== EG_REVERB_OPEN)?.preset ?? null;
  return { base: EG_REVERB_OPEN, zones, second };
}

/**
 * WHICH SPACE a hall-frame point is heard in (pure): the index of `zones` (egHallReverb's) it stands in, or -1 for the
 * hall's own. `cur` the zone it was heard in: kept while the point stays within it and `hyst` past its edge (a mouth's
 * hysteresis), so a body pacing the line never swaps the reverb each step; a new zone is entered only inside its own edge.
 * @param {ReadonlyArray<{ x: number, half: number, z0: number, z1: number }>} zones
 * @param {number} x @param {number} z @param {number} [cur] @param {number} [hyst]
 */
export function egReverbZoneAt(zones, x, z, cur = -1, hyst = EG_REVERB_HYST_M) {
  const inside = (q, pad) => z >= q.z0 - pad && z <= q.z1 + pad && Math.abs(x - q.x) <= q.half + pad;
  if (cur >= 0 && zones[cur] && inside(zones[cur], hyst)) return cur;
  for (let i = 0; i < zones.length; i++) if (inside(zones[i], 0)) return i;
  return -1;
}

/**
 * THE SEAM over the engine (`audio` - systems/audio.js's AudioEngine, or anything with its hold): `hold()` takes the zone
 * (idempotent); `hall(key, spec)` makes a new hall's two convolvers when the hall the player stands in changes (behind the
 * veil - a swap, a pull); `at(x, z)` turns the zone at a mouth (the hall's frame); `release()` lets the zone go and forgets
 * the hall (every way out). `state()` what it holds (tests).
 * @param {{ audio?: any }} deps
 */
export function createEgReverb({ audio = null } = {}) {
  let held = false, key = '', plan = null, cur = -1, fades = 0, builds = 0;
  const api = {
    hold() {
      if (held) return true;
      held = !!audio?.holdReverb?.(EG_REVERB_OWNER);
      return held;
    },
    hall(k, spec) {
      if (!held || !spec || k === key) return false;
      key = k; plan = egHallReverb(spec); cur = -1;
      builds++;
      let made = true;
      try { made = audio?.reverbZone?.(plan.base, plan.second) !== false; } catch { made = false; }
      if (!made) key = '';   // no context yet (no gesture has woken the engine): asked again next frame
      return made;
    },
    at(x, z) {
      if (!held || !plan || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      const i = egReverbZoneAt(plan.zones, x, z, cur);
      if (i === cur) return false;
      cur = i;
      fades++;
      try { audio?.reverbFade?.(i < 0 ? plan.base : plan.zones[i].preset, EG_REVERB_FADE_S); } catch { /* a sound is never the breach */ }
      return true;
    },
    release() {
      const was = held;
      if (held) { try { audio?.releaseReverb?.(EG_REVERB_OWNER); } catch { /* gone */ } }
      held = false; key = ''; plan = null; cur = -1;
      return was;
    },
    state: () => ({ held, key, zone: cur, preset: plan ? (cur < 0 ? plan.base : plan.zones[cur].preset) : null, fades, builds }),
  };
  return api;
}
