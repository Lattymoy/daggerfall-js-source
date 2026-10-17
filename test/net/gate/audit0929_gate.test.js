// AUDIT PRE-MERGE 0929 (2026-09-29, Mac: "Audit this") - WB8's half: a Soul-Hungry Warden fed only by a fall with a
// real part behind it, and never more than GATE_FEEDS_MAX times a fight; a Colossal Warden's Cleave reaching wherever he
// chooses it; the marks found once, not re-read every frame. The record: bible/01-Overview/audits/Audit-PreMerge-0929.md and
// bible/11-Multiplayer/World-Bosses.md section 13.
//
// Each test failed on the unfixed tree for its finding's reason: twenty-five throwaway accounts healed him from a fifth to
// all but full (W1-1); a still fighter 9.1 m from a Colossal Warden was cleaved at 39 times in two minutes and struck by
// none (W1-2); a marks array changed in place was read anew (W2-2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRooms } from '../../fakeRoom.mjs';
import { gateTimes, gateRoomKey, gateModsOf, gateMarksCycleLength } from '../../../src/net/gate/gateLaw.js';
import { gateModsWords, GATE_FEEDS_MAX } from '../../../src/net/gate/gateMods.js';
import {
  newFight, joinFight, stepBrain, fightProfile, profileOf, ATTACK_BY_ID, BRAIN_TICK_MS, COURT_CENTRE, ABSENT_RETIRE_MS, SEAT_KEEP_MS,
} from '../../../src/net/gate/gateBrain.js';
import { inAttack } from '../../../src/net/gate/gateStrike.js';
import { GATE_BRAIN_V } from '../../../src/net/wire.js';
import { gateTip } from '../../../src/systems/gate/gateOmen.js';
import { bossBarModel } from '../../../src/ui/gate/gateBossBar.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A seeded [0,1) source (mulberry32) - the room suite's own dice. */
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('AUDIT PRE-MERGE 0929 W1-1: throwaway accounts that say `in` dead and go feed a Soul-Hungry Warden nothing - twenty-five took him from a fifth of his health to all but full, for good; a fall with a real part behind it still feeds him, on the real Room (mutants: a fall with no part feeding; the ceiling unread)', async () => {
  let day = 1; while (!gateModsOf(day).includes('soulhungry')) day++;
  const TT = gateTimes(day);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const r = world.room(gateRoomKey(day));
    const at = (x, z, dd) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0, ...(dd ? { dd: 1 } : {}) });
    const beat = async (ms) => { const end = clock + ms; while (clock < end) { clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const honest = [];
    for (let i = 0; i < 10; i++) {
      const ws = r.connect();
      await r.hello(ws, `peer-${String(100 + i).padStart(4, '0')}`, at(6 + i * 0.3, 6));
      await r.raw(ws, JSON.stringify({ t: 'gate', k: 'in', lv: 30, bv: GATE_BRAIN_V }));
      honest.push(ws);
    }
    await beat(4000);
    const f = r.room._fight;
    f.hp = f.max * 0.2; f.phase = 3;   // the honest court has him at a fifth
    for (let i = 0; i < 25; i++) {
      const ws = r.connect();
      await r.hello(ws, `peer-${String(500 + i).padStart(4, '0')}`, at(-10, -10, true));   // a hello whose pose says "dead"
      await r.raw(ws, JSON.stringify({ t: 'gate', k: 'in', lv: 1, bv: GATE_BRAIN_V }));
      await beat(BRAIN_TICK_MS);
      await r.drop(ws);
    }
    const fedWords = () => honest[0].sent.filter((m) => m.t === 'gate' && m.k === 'fed');
    assert.equal(fedWords().length, 0, 'a throwaway\'s fall fed him');
    await beat(ABSENT_RETIRE_MS + 5000);   // their shares retire at the fraction he stands at
    assert.ok(Math.abs(r.room._fight.hp / r.room._fight.max - 0.2) < 1e-9, `he stands at ${r.room._fight.hp / r.room._fight.max}`);
    // the honest court stood its seats' worth: a fall of theirs is the trial as it was meant (WB8b's brain pin feeds one)
    const court = Object.values(r.room._fight.players).filter((p) => p.lv === 30);
    assert.equal(court.length, 10);
    for (const p of court) assert.ok(p.stoodMs >= SEAT_KEEP_MS, `${p.name} stood ${p.stoodMs} ms`);
  } finally { Date.now = realNow; }
});

test('AUDIT PRE-MERGE 0929 W1-2: a Colossal Warden\'s Cleave lands on a still fighter wherever he chooses it - one 9.1 m from his centre was cleaved at 39 times in two minutes of phase one and struck by none, and he never walked in (mutants: the cone unscaled)', () => {
  const T0 = 1_000_000, WRATH = T0 + 3_600_000;
  for (const md of [['burning', 'colossal', 'vengeful'], ['rime', 'colossal', 'echoing'], ['venom', 'colossal', 'grudge']]) {
    const P = fightProfile(md);
    for (const dist of [9.05, 9.1, 9.2, 9.25]) {
      const f = newFight(7, T0, WRATH, 'ruhn', md);
      joinFight(f, 's1', 'Ann', 20, T0, true);
      const rng = seeded(5);
      let cleaves = 0, landed = 0;
      for (let t = T0; t < T0 + 60_000; t += BRAIN_TICK_MS) {
        for (const o of stepBrain(f, t, [{ sub: 's1', x: 0, z: dist, dead: false }], rng)) {
          if (o.k !== 'atk' || ATTACK_BY_ID[o.a].key !== 'cleave') continue;
          cleaves++;
          if (inAttack(o, 0, dist, P)) landed++;
        }
      }
      assert.ok(cleaves > 0, `${md} at ${dist} m: no cleave chosen`);
      assert.equal(landed, cleaves, `${md} at ${dist} m: ${cleaves - landed} of ${cleaves} cleaves cut air`);
    }
  }
});

test('AUDIT PRE-MERGE 0929 W2-2: the marks are found once an array, not re-read every frame - a marked court\'s frame made three and a half times the garbage of an unmarked one; the bar\'s trials line is the profile\'s, and the card\'s marks line is worded once a day (mutants: the profile re-read each call; the line joined each frame)', () => {
  const md = ['rime', 'colossal', 'echoing'];
  const P = profileOf({ md });
  assert.equal(P, fightProfile(md));
  // the same array, changed where it stands: a profileOf that re-read it every call would answer the storm
  md[0] = 'storm';
  assert.equal(profileOf({ md }), P, 'found by the array, not read anew');
  assert.equal(profileOf({ md: ['storm', 'colossal', 'echoing'] }).aspect.id, 'storm', 'another array is read');
  assert.equal(profileOf({ md: null }), fightProfile(null));
  assert.equal(profileOf(null), fightProfile(null));
  // the bar's trials line is the one the profile joined
  for (let i = 0; i < gateMarksCycleLength(); i++) {
    const Q = fightProfile(gateModsOf(i));
    assert.equal(Q.trialsLine, Q.trials.map((t) => t.name).join(' - '));
  }
  const bar = bossBarModel({ day: 1, md: ['rime', 'colossal', 'echoing'], hp: 5, max: 10, phase: 1, atk: null, fell: null, wrath: null, shieldUntil: 0 }, 0, { name: 'Valkynaz Ruhn', title: 'Warden of the Gate' });
  assert.equal(bar.trials, 'Colossal - Echoing');
  // the card's marks line: the day's words, capitalised, worded once a day
  const tip = gateTip({ site: { place: 'Daggerfall' }, phase: 'omen', t: { day: 3 } }, null);
  const words = gateModsWords(gateModsOf(3));
  assert.ok(tip.lines.includes(`${words.charAt(0).toUpperCase()}${words.slice(1)}`));
  assert.match(read('src/systems/gate/gateOmen.js'), /if \(day !== _marksDay\) \{/, 'the card words its marks once a day');
  assert.doesNotMatch(read('src/ui/gate/gateBossBar.js'), /trials\.map\(/, 'the bar joins no trials a frame');
  assert.equal(GATE_FEEDS_MAX, 5);
});
