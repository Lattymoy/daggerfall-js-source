// @ts-check
// FIELD BUGS 2026-10-17e (ORRERY-SIGHT, 2026-10-17; bible/01-Overview/bugs/Field-Bugs-2026-10-17e.md): THE ATHENAEUM'S ORRERY,
// READ ON THIS SCREEN. An Athenaeum's lock is the Hour's Orrery (net/superDungeon/sdBrain.js orreryOf, Elite-Gates.md section
// 8.4): six stones, each at an hour of twelve, geared to one another, and six riddles that fix the true hours. The relay draws
// it and judges every turn (net/eliteGates/egBrain.js), and its word carries the stones' hours (`pg.st`) - but the Spire
// drew none of it: a gold disc a stone, no name, no hour, no riddle, only "Stones true: 0 of 6". The Hour reads the same
// draw off its slot (scenes/superDungeon/sdHall.js); here it is read off the breach's seed and the hall, as the relay does.
//
// Client only - the relay never imports this file, so nothing here moves RELAY_VERSION. Not a DFU member (DFU has no Spire,
// no Athenaeum and no Orrery). Ledger A (ELITE-GATES).
import { orreryOf, SD_STONES, sdHourShown } from '../../net/superDungeon/sdBrain.js';
import { egOrreryTurns } from '../../net/eliteGates/egBrain.js';
import { egSeed } from '../../net/eliteGates/egLaw.js';

/** The salt of an Athenaeum's Orrery slot, the relay's (net/eliteGates/egBrain.js, the Athenaeum's arm of the fight's stand:
 *  `egSeed(B.seed, 0x0a7e + spec.h)`). Written there as a literal in the relay's bundle, so it is written here again rather
 *  than exported from there (an export is a relay change); test/systems/eliteGates/fb1017e_orrerysight.test.js holds this
 *  draw to the relay's own, stone for stone and riddle for riddle. */
export const EG_ORRERY_SALT = 0x0a7e;
/** How near a member stands to a stone, in plan, for the relay to take its turn (m - net/eliteGates/egBrain.js egWord's
 *  `pz`). The handle is offered past it (a handle stands 0.9 m beside its stone, the ray reaches 3.2 m), and a turn sent
 *  from past it was dropped without a word. Held to the relay's by the same test. */
export const EG_STONE_REACH_M = 3.5;

/**
 * THE ORRERY OF AN ATHENAEUM: the relay's draw for breach seed `seed`'s hall `spec` - its gearing, start, true hours and
 * riddles - or null for any other hall. The relay passes The Fraying's fray beside the turns range when that decree is in
 * force; the fray draws nothing (orreryOf rolls the same die for every fray), so this draw is the relay's whatever the
 * decrees, and its `fray` is not this hall's. Pure.
 * @param {number} seed @param {any} spec
 */
export function spireOrreryOf(seed, spec) {
  if (spec?.kind !== 'athenaeum' || !Number.isSafeInteger(spec.h)) return null;
  return orreryOf((egSeed(seed, EG_ORRERY_SALT + spec.h) % 2147483646) + 1, egOrreryTurns(spec.c));
}
/** A stone's name as a title says it - stone `j` is SD_STONES[j], the wire's order (*The Underking*). Pure. */
export const spireStoneName = (j) => { const n = SD_STONES[j]?.name ?? ''; return n.charAt(0).toUpperCase() + n.slice(1); };
/** The words over a stone: its name and the hour its hand stands at, 1 to 12 (*Wayrest - 4*). Pure. */
export const spireStoneWords = (j, h) => `${spireStoneName(j)} - ${sdHourShown(h)}`;
/** The six riddles, one a line, in the plaques' order (the Hour's Ledger Plaques). Pure. */
export const spireRiddleLines = (o) => (o?.riddles ?? []).map((r) => r.text);
