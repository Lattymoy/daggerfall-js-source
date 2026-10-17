// WHERE-ROBES (FIELD BUGS 2026-10-04c): THE HARNESS its two files share - test/systems/fb1004c_robes.test.js and its audit's,
// test/systems/fb1004c_audit.test.js. The Qualifying Examination on the real QuestMachine (its vendored script, its own robes
// and note), quick loot's switch, the enhanced pack mounted over a pile, and a real Collider's bed room. Not a test file
// (the suite's glob is test/*.test.js), so it runs nothing of its own.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { hoverLines } from '../src/systems/worldHover.js';
import { resetQuickLoot } from '../src/systems/quickLoot.js';
import { PREF_DEFAULTS, setPref } from '../src/systems/uiPrefs.js';
import { mountEnhancedInventory } from '../src/ui/enhanced/enhancedInventory.js';
import { _resetForTests } from '../src/systems/settings/settings.js';
import { withDom } from './invdrag.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}

/** The flattened words of a popup's tokens. */
export const words = (tokens) => (tokens ?? []).map((t) => t.text ?? '').join(' ').replace(/\s+/g, ' ');

/** The Qualifying Examination, begun: the beggar's letter in hand, the robes minted and somewhere not the pack. Its
 *  map placements want a loaded world, so those lines are left out (the AUDIT TIMEFREE II harness's cut) - the robes'
 *  click and `_S.03_` are what is asked. */
export function examination() {
  const now = { s: 1e6 };
  const popups = [], given = [];
  const m = new QuestMachine({
    nowSeconds: () => now.s, isPlayerInTown: () => true,
    getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|place item|create npc at)/.test(l)),
    showPopup: (_q, tokens) => popups.push(words(tokens)),
    giveItemToPlayer: (it) => given.push(it),
  });
  const q = m.startQuestByName('O0A0AL00');
  const step = (n = 2) => { for (let i = 0; i < n; i++) { now.s += 1; m.tick(); } };
  step();
  const robes = q.getItem({ name: 'clothing' }).daggerfallUnityItem;
  const note = q.getItem({ name: 'note' }).daggerfallUnityItem;
  return { m, q, robes, note, popups, given, step, getQuest: (uid) => m.getQuest(uid) };
}
/** Whether the robes' note reached the player: message 1018 said and `_note_` given. */
export const noteCame = (e) => e.popups.some((p) => /As you pick up the/.test(p) && /note is tucked/.test(p)) && e.given.includes(e.note);

/** The feature with its switch on and its state clean, restored after (test/systems/quickloot.test.js's own). */
export function withQuickLoot(fn) {
  setPref('quickLoot', true);
  resetQuickLoot();
  try { return fn(); } finally { resetQuickLoot(); setPref('quickLoot', PREF_DEFAULTS.quickLoot); }
}
/** A frame as resolveHover mints one, the rows hoverLines' own. */
export const frameOf = (key, items) => {
  const { shown, rest, empty } = hoverLines(items);
  return { key, kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty };
};
export const thief = () => ({ name: 'Balcony', items: [], goldPieces: 0, stats: { strength: 50 } });

/** The enhanced pack over a loot pile - the remote target the hosts hand it (`loot.items`) and their quest resolver.
 *  `own` - items already in the player's pack; `storage` - a chest rather than a pile, so the pack itself is drawn
 *  beside it (PX20b builds no pack frame over a pile). `rowOf(item, side)` finds an item's row on either side. */
export function overPile(e, pile, fn, { own = [], storage = false } = {}) {
  const prev = globalThis.location, prevWin = globalThis.window, hadWin = 'window' in globalThis;
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.window = { innerWidth: 1280, innerHeight: 800 };   // the menu is placed beside the pointer (placeBeside reads the view)
  _resetForTests();
  try {
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const p = thief();
      p.items.push(...own);
      let view = null;
      view = mountEnhancedInventory(host, { entity: p, items: () => p.items, loot: { items: () => pile, ...(storage ? { storage: true } : {}) }, getQuest: e.getQuest, onExit: () => view?.unmount() });
      try {
        const rowOf = (item, side = 'loot') => host.querySelectorAll('.itemrow').find((r) => r._padItem === item && (side === 'loot') === !!r.closest('.loot-win')) ?? null;
        const lootRow = () => rowOf(e.robes, 'loot');
        fn({ dom, host, p, lootRow, rowOf });
      } finally { view.unmount(); }
    });
  } finally { globalThis.location = prev; if (hadWin) globalThis.window = prevWin; else delete globalThis.window; _resetForTests(); }
}

/** A real Collider holding a bed as a building files it (one shared bucket, the interior's own key): a mattress 0.5 m
 *  high from x 2..4, a headboard at its far end (x 3.9..4) up to 1.4 m, and the room's far wall past it - the bed's box,
 *  as worldAabb mints it, is the hull of mattress and headboard. Quads as two triangles each, every face. `box` mints
 *  more for a caller. */
export async function bedRoom() {
  const { Collider } = await import('../src/player/collider.js');
  const c = new Collider(() => -Infinity);
  const box = (x0, y0, z0, x1, y1, z1) => {
    const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const f = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
    return { positions: p.flat(), indices: f.flatMap(([a, b, cc, d]) => [a, b, cc, a, cc, d]) };
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const add = (key, m) => c.addMesh(key, new Float32Array(m.positions), new Uint32Array(m.indices), I);
  add('interior', box(2, 0, -1, 4, 0.5, 1));
  add('interior', box(3.9, 0.5, -1, 4, 1.4, 1));
  add('interior', box(6, 0, -3, 6.2, 3, 3));   // the room's far wall, past the bed
  const bed = { key: 'bed:0', aabb: { min: [2, 0, -1], max: [4, 1.4, 1] }, distance: 76.8, reach: 3.2, surface: true };
  // the robes, a 0.5 m pile standing on the mattress (questStandBox's shape: base-anchored, `width` square)
  const robes = { key: 'questflat:0', aabb: { min: [3.0, 0.5, -0.25], max: [3.5, 1.0, 0.25] }, distance: 3.2 };
  return { c, bed, robes, box, add };
}

/** A unit direction from `d`. */
export const unit = (d) => { const n = Math.hypot(...d); return d.map((v) => v / n); };
