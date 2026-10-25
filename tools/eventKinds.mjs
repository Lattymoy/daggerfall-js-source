#!/usr/bin/env node
// STAFF-EVENT (2026-10-24, mob: "should allow all of the monster in the game"): EVERY MONSTER THE GAME STANDS, for the
// Staff Panel's Events page (its lib/pages/eventKinds.js) - MobileTypes' monsters (0-42) and classes (128-145), and Enemy
// Expansion's (256-290, 384-398), which the game registers on every load (systems/enemyExpansion/dexInstall.js). The two
// the event law bars are left out (net/staffEvent/staffEventLaw.js STAFF_EVENT_KINDS_BARRED). Prints the panel's module.
//
//   node tools/eventKinds.mjs > <panel>/lib/pages/eventKinds.js
import { ENEMY_NAMES } from '../src/characters/enemy/enemyBasics.js';
import { dexRead } from '../src/systems/enemyExpansion/dexInstall.js';
import { STAFF_EVENT_KINDS_BARRED } from '../src/net/staffEvent/staffEventLaw.js';
import { isMain } from './lib/isMain.mjs';

/** Each group's kinds, `[id, name]`, in the game's order. */
export function eventKinds() {
  const groups = { Monsters: [], People: [], 'Expansion monsters': [], 'Expansion people': [] };
  ENEMY_NAMES.forEach((name, i) => {
    const id = i <= 42 ? i : 128 + (i - 43);
    if (STAFF_EVENT_KINDS_BARRED.includes(id)) return;
    groups[id >= 128 ? 'People' : 'Monsters'].push([id, id === 40 ? 'Dragonling (alternate)' : name]);   // MobileTypes' second Dragonling
  });
  for (const [id, e] of dexRead({ log: () => {}, mudex: false }).enemies) groups[id >= 384 ? 'Expansion people' : 'Expansion monsters'].push([id, e.props.name]);
  return Object.entries(groups).map(([group, kinds]) => ({ group, kinds }));
}

if (isMain(import.meta.url)) {
  const q = (s) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);
  const lines = eventKinds().map((g) => `  { group: ${q(g.group)}, kinds: [${g.kinds.map(([i, n]) => `[${i}, ${q(n)}]`).join(', ')}] },`);
  process.stdout.write(`// STAFF-EVENT: EVERY MONSTER THE GAME STANDS, by its number (src/characters/enemy/enemyBasics.js ENEMY_NAMES: MobileTypes 0-42
// the monsters, 128-145 the classes; src/systems/enemyExpansion: Enemy Expansion's 256-290 and 384-398, which the game
// registers on every load). Horse_Invalid (39) and the City Watch (146) are left out: the event law refuses them
// (src/net/staffEvent/staffEventLaw.js STAFF_EVENT_KINDS_BARRED). Made by tools/eventKinds.mjs in the game repo - run it again
// when the game adds a monster.
/** @type {ReadonlyArray<{ group: string, kinds: ReadonlyArray<readonly [number, string]> }>} */
export const KIND_GROUPS = Object.freeze([
${lines.join('\n')}
]);
/** A kind's name by its number. */
export const KIND_NAME = new Map(KIND_GROUPS.flatMap((g) => g.kinds));
`);
}
