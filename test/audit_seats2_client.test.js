// AUDIT SEATS-2 (2026-10-02, Mac: "Can we do a deep comprehensive audit on everything") - THE CLIENT'S LANE: the seat
// halls known late (C1), a fallen one's fall kept (C2), no battle drawn for the dead or a tab out of the seat (C4), the
// board's Hall of Records read after the board closed shown over nothing (C5), a Charter Room chest pressed by a visitor
// says whose it is (C6). `06-Systems/Online-Arc.md` AUDIT SEATS-2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foldSiege, SIEGE_STATE_EMPTY } from '../src/net/siegeLink.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000_000;
const F = { k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: T, e: T + 2_700_000, n: [2, 1, 0] };
const G = (id, o = {}) => [id, 1, 360, 360, 0, 0, 0, 0, 0, 0].map((v, i) => (o[i] !== undefined ? o[i] : v));

test('AUDIT SEATS-2 C2: a fallen one still down in the next second\'s frame keeps when (and where) it fell - its fall is played once, not each second; one that rises takes the frame\'s (mutant: the frame\'s moment over the fall\'s)', () => {
  let s = foldSiege(SIEGE_STATE_EMPTY, { ...F, np: [G('n0')] }, T);
  s = foldSiege(s, { k: 'fell', id: 'n0', by: 'att-0001' }, T + 1200);
  const fellAt = s.npcs[0].at;
  assert.equal(s.npcs[0].down, true);
  for (const t of [T + 2000, T + 3000, T + 4000]) {
    s = foldSiege(s, { ...F, np: [G('n0', { 2: 0, 8: 1 })] }, t);
    assert.equal(s.npcs[0].at, fellAt, `still the fall's moment at ${t - T}`);
    assert.equal(s.npcs[0].down, true);
  }
  s = foldSiege(s, { ...F, np: [G('n0', { 8: 0 })] }, T + 5000);
  assert.deepEqual([s.npcs[0].down, s.npcs[0].at], [false, T + 5000], 'risen: the frame\'s moment');
});

test('AUDIT SEATS-2 C1, C4, C5, C6 by source: the halls read again each second where they were not known (a palace\'s latched and its room read; a castle\'s throne room stood once its crown is); the dead and a tab out of the seat draw no battle; the board\'s book shown only over the board that asked; a Charter Room chest pressed by a visitor says whose (mutants: each seam)', () => {
  const m = src('src/scenes/worldModes.js');
  const halls = m.slice(m.indexOf('  function seatHallsFrame(nowMs) {'), m.indexOf('  /** CROWN-HALL: the crown seat this dungeon'));
  assert.match(halls, /if \(nowMs - _hallsReadAt < 1000\) return;/);
  assert.match(halls, /const h = host\.seatHall\?\.here\?\.\(homeTownOf\(interiorBuilding\)\) \?\? null;\n      const was = interiorSeatHall;\n      interiorSeatHall = h;\n      if \(h && !was\) loadHomeDecor\(\);/);
  assert.match(halls, /else if \(mode === 'dungeon' && dungeonCtx && dungeonLoc && _crownTried !== dungeonCtx && crownHere\(\)\) \{\n      standCrownHall\(dungeonCtx, dungeonLoc\)/);
  assert.match(m, /if \(!crownHere\(\)\) return;\n    _crownTried = ctx;/);
  assert.match(m, /seatHallsFrame\(performance\.now\(\)\);[^\n]*\n    decorTool\.frame\(/);
  assert.match(m, /\{ openHallChest\(\); return; \} else if \(interiorSeatHall && !interiorHome\) \{ say\(CROWN_HALL_TEXT\.chestShut\(interiorSeatHall\.name\)\); return; \}/);
  const w = src('src/scenes/world.js');
  assert.match(w, /    if \(onlineOn && playerSpawned\) \{ if \(!online\) onlineStart\(\); onlineFrame\(now, dt\); \}[^\n]*\n    deadlandsAirFrame\(\);[^\n]*\n(?:    sdAirFrame\(\);[^\n]*\n)?    if \(onlineOn && playerSpawned && \(seatOut\(\) \|\| townTalk\.overlay instanceof DeathScreen \|\| modes\?\.deathUp\?\.\(\)\)\) \{ siegeHud\?\.hide\(\); siegeNpcs\?\.leave\(\); \}/);   // AUDIT SD III (PIN MOVED): SD14b's Hour air may stand under the court's
  assert.match(w, /const board = townTalk\.overlay;[^\n]*\n    const r = st && seatBook \? await seatBook\.records\(st\.key\) : null;\n    if \(townTalk\.overlay !== board\) return false;\n    if \(!r\?\.data\) return false;/);
});
