// AUDIT KETCH L5-9 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md sections 5-8): THE SHIP'S FIGHTS ON THIS SCREEN, pinned -
// the arc page called every finding pinned, and scenes/ketch/ketchFight.js had no test and no mutant. Every blow judged once
// on my own feet at its landing, on its own storey (KT_STOREY_M); a jumped one (the Tonal Wave) only while I stand on the
// ground; a landing seen too late neither judged nor heard (KT_LATE_MS); the whole bridge's owed list judged on the bridge
// alone, the Keel-Song skipped once its forks were broken; each construct's act as its mobile plays it.
// tools/mutants/ketch_fight.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createKetchFight, ktBodyAct, ktFloorOf, KT_FALL_MS, KT_LATE_MS, KT_STOREY_M } from '../../src/scenes/ketch/ketchFight.js';
import { deckToDungeon, KT_GALLERY, KT_HOLD, KT_BRIDGE, hazardsBetween } from '../../src/net/ketch/ketchDeck.js';
import { egInBlow } from '../../src/net/eliteGates/egShape.js';
import { KW_BLOWS } from '../../src/net/ketch/ketchWarden.js';

/** A fight on a fake link: my feet at a deck point, my body, every blow landed on me counted. */
function fightAt(foot, { grounded = true, broken = new Set() } = {}) {
  const state = { n: 1, sg: 0, bodies: [], blows: [], ws: null }, owed = [];
  const S = { t: 10_000, foot, ground: grounded, struck: [], state, owed };
  const link = { state: () => state, owed: () => owed.filter((b) => !b.paid), paid: (i) => { for (const b of owed) if (b.i === i) b.paid = true; }, songBroken: (i) => broken.has(i) };
  const player = { health: 100, maxHealth: 100 };
  S.fight = createKetchFight({ link, now: () => S.t, feet: () => (S.foot ? deckToDungeon(...S.foot) : null), grounded: () => S.ground, player: () => player, save: () => 0, strike: (dmg) => S.struck.push(dmg) });
  S.run = (ms, step = 50) => { for (let k = 0; k < ms; k += step) { S.fight.frame(); S.t += step; } };
  return S;
}
const disc = (x, z, r = 3) => ['d', x, z, r];
const blowOf = (i, at, x, z, y, o = {}) => ({ i, o: 1000, at, wu: 1200, sp: 0, s: [disc(x, z)], p: 0.2, b: 5, el: null, y, ...o });

test('KETCH A BLOW LANDS ONCE ON MY STOREY: a blow on my feet at its landing strikes me once, however many frames see it; the same blow a deck below never does (AUDIT KETCH L5-9; mutants: the storey not read; a blow judged again)', () => {
  const S = fightAt([0, 0, 30]);
  S.state.blows.push(blowOf(1, S.t + 500, 0, 30, 0));
  S.run(3000);
  assert.equal(S.struck.length, 1, 'once');
  const G = fightAt([0, KT_GALLERY.y, 30]);
  G.state.blows.push(blowOf(1, G.t + 500, 0, 30, 0));
  G.run(3000);
  assert.equal(G.struck.length, 0, `a storey below (${-KT_GALLERY.y} m, the band ${KT_STOREY_M})`);
  const M = fightAt([10, 0, 30]);
  M.state.blows.push(blowOf(1, M.t + 500, 0, 30, 0));
  M.run(3000);
  assert.equal(M.struck.length, 0, 'off its shape');
});

test('KETCH A HAMMER LANDS ONCE A SLAM: standing under a gallery hammer, each of its landings strikes me once - the hazards are judged every frame, so the judged list is all that keeps one slam from landing a frame at a time (AUDIT KETCH L5-9; mutants: a blow judged again)', () => {
  const S = fightAt([0, KT_GALLERY.y, 80]);
  const t0 = S.t;
  S.run(7000);
  const slams = hazardsBetween(t0 / 1000, S.t / 1000, { gallery: true, hold: false }).filter((h) => h.k === 'hammer' && h.at < S.t - 50 && egInBlow(h, 0, 80));
  assert.ok(slams.length >= 2, `slams over me (${slams.length})`);
  assert.equal(S.struck.length, slams.length, 'one strike a slam');
});

test('KETCH THE TONAL WAVE IS JUMPED: a jumped blow lands only on a body standing on the ground at its landing - in the air it passes under (AUDIT KETCH L5-9; mutants: the jump not read)', () => {
  for (const [ground, n] of [[true, 1], [false, 0]]) {
    const S = fightAt([KT_BRIDGE.x, KT_BRIDGE.y, KT_BRIDGE.z - 10], { grounded: ground });
    S.state.blows.push(blowOf(7, S.t + 300, KT_BRIDGE.x, KT_BRIDGE.z - 10, KT_BRIDGE.y, { jp: 1 }));
    S.run(2000);
    assert.equal(S.struck.length, n, ground ? 'on the ground: struck' : 'in the air: passed under');
  }
});

test('KETCH A LANDING SEEN TOO LATE IS NEVER JUDGED: a blow first seen past its landing by more than KT_LATE_MS strikes no one - a stale word is no blow (AUDIT KETCH L5-9; mutants: the late landing judged)', () => {
  const S = fightAt([0, 0, 30]);
  S.state.blows.push(blowOf(3, S.t - KT_LATE_MS - 200, 0, 30, 0));
  S.run(1000);
  assert.equal(S.struck.length, 0);
  const N = fightAt([0, 0, 30]);
  N.state.blows.push(blowOf(3, N.t - KT_LATE_MS + 200, 0, 30, 0));
  N.run(1000);
  assert.equal(N.struck.length, 1, 'just in time: judged');
});

test('KETCH THE WHOLE BRIDGE\'S BLOWS ARE THE BRIDGE\'S: an owed blow strikes a body on the bridge however late, never one off it, once; the Keel-Song never once its forks were broken (AUDIT KETCH L5-9; mutants: an owed blow off the bridge; the broken song landed)', () => {
  const on = fightAt([KT_BRIDGE.x, KT_BRIDGE.y, KT_BRIDGE.z]);
  on.owed.push({ ...blowOf(4, on.t - 5000, 0, 0, KT_BRIDGE.y), s: [['a']], a: KW_BLOWS.discord.a });
  on.run(1000);
  assert.equal(on.struck.length, 1, 'on the bridge, late as it is');
  const off = fightAt([0, 0, 30]);
  off.owed.push({ ...blowOf(4, off.t - 100, 0, 0, KT_BRIDGE.y), s: [['a']], a: KW_BLOWS.discord.a });
  off.run(1000);
  assert.equal(off.struck.length, 0, 'off it');
  const song = fightAt([KT_BRIDGE.x, KT_BRIDGE.y, KT_BRIDGE.z], { broken: new Set([5]) });
  song.owed.push({ ...blowOf(5, song.t - 100, 0, 0, KT_BRIDGE.y), s: [['a']], a: KW_BLOWS.song.a });
  song.run(1000);
  assert.equal(song.struck.length, 0, 'the song, its forks broken');
});

test('KETCH A BLOW\'S FLOOR AND A BODY\'S ACT: each blow drawn on the storey it lands on; a construct falls then is gone, rises out of the deck (a sphere from the rigging), sleeps, winds up, strikes, idles (AUDIT KETCH L5-9; mutants: a fall never gone)', () => {
  assert.equal(ktFloorOf(0, 30), 'waist');
  assert.equal(ktFloorOf(KT_GALLERY.y, 90), 'gallery');
  assert.equal(ktFloorOf(KT_HOLD.y, 90), 'hold');
  assert.equal(ktFloorOf(KT_BRIDGE.y, 200), 'bridge');
  const mob = 289, B = { h: 10, up: 0, wake: 1, x: 0, z: 0, mv: null, hurtAt: -Infinity };
  assert.equal(ktBodyAct({ ...B, h: 0, down: 1000 }, 1000 + KT_FALL_MS / 2, mob, null).act, 'fall');
  assert.equal(ktBodyAct({ ...B, h: 0, down: 1000 }, 1000 + KT_FALL_MS + 1, mob, null).act, 'gone');
  const rise = ktBodyAct({ ...B, up: 2000 }, 1500, mob, null, { drop: true });
  assert.equal(rise.act, 'rise'); assert.ok(rise.lift > 0, 'a sphere drops from the rigging');
  assert.ok(ktBodyAct({ ...B, up: 2000 }, 1500, mob, null, { drop: false }).lift < 0, 'the rest climb out of the deck');
  assert.equal(ktBodyAct({ ...B, wake: 0 }, 5000, mob, null).act, 'asleep');
  const bl = { at: 6000, wu: 1000 };
  assert.equal(ktBodyAct(B, 5600, mob, bl).act, 'windup');
  assert.equal(ktBodyAct(B, 6100, mob, bl).act, 'strike');
  assert.equal(ktBodyAct(B, 9000, mob, null).act, 'idle');
});

test('KETCH-LOOK KL2 THE WARDEN DYED DWARVEN: the Iron Atronach\'s frame takes DFU\'s ChangeDye with the Dwarven table over its 0x70 metal band and the Ketch\'s table over its darkest greys - every other index its own, the frame it came in untouched; the look washes nothing (mutants: the dye the Iron table\'s; the darks left iron)', async () => {
  const { ktWardenDye, KT_WARDEN_LOOK, KT_WARDEN_DARKS } = await import('../../src/scenes/ketch/ketchFight.js');
  const { METAL_TABLES } = await import('../../src/characters/dyes.js');
  const data = Uint8Array.from({ length: 256 }, (_, i) => i), bmp = { width: 16, height: 16, data };
  const out = ktWardenDye(bmp);
  assert.notEqual(out.data, data, 'a fresh frame');
  for (let i = 0; i < 256; i++) assert.equal(data[i], i, 'the frame it came in untouched');
  for (let k = 0; k < 16; k++) assert.equal(out.data[0x70 + k], METAL_TABLES.Dwarven[k], `0x70+${k} Dwarven`);
  for (const [from, to] of Object.entries(KT_WARDEN_DARKS)) assert.equal(out.data[Number(from)], to, `${from} olive`);
  for (let i = 0; i < 256; i++) if ((i < 0x70 || i > 0x7f) && !(i in KT_WARDEN_DARKS)) assert.equal(out.data[i], i, `${i} its own`);
  assert.equal(KT_WARDEN_LOOK.tint, null, 'no multiply wash');
  assert.equal(typeof KT_WARDEN_LOOK.dye, 'function');
  const src = readFileSync(new URL('../../src/scenes/ketch/ketchFight.js', import.meta.url), 'utf8');
  assert.match(src, /renderer\.uploadTexture\?\.\(T\.archive, rkey, T\.tex\.getColor32\(look\.dye\(T\.tex\.getDFBitmap\(fr\.record, fr\.frame\)\), 0\)\)/, 'dyed at upload, through the player\'s palette, under its own key');
});

test('KETCH-LOOK KL3 THE FIGHT\'S LATE PASS DRAWS THE DECK\'S HALOS: what the deck hands it this frame, in one draw at the classic set\'s gain, whether or not a telegraph stands; none handed, none drawn; off the ship, forgotten (mutants: the halos never drawn; the halos kept past the ship)', () => {
  // a context whose every compile is done at once, counting its draws (test/render/firstuse.test.js's stand-in)
  const draws = [], base = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4 };
  let id = 0;
  const gl = new Proxy(base, { get(t, k) {
    if (typeof k !== 'string') return undefined;
    if (k in t) return t[k];
    if (/^[A-Z0-9_]+$/.test(k)) return k;
    if (k === 'getExtension') return (n) => (n === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: 9 } : null);
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, n) => n;
    if (k === 'isContextLost') return () => false;
    if (k === 'drawArrays') return (...a) => draws.push(a);
    return () => ({ id: id++ });
  } });
  const link = { state: () => null, owed: () => [], paid: () => {}, songBroken: () => false, joined: () => true };
  const fight = createKetchFight({ gl, link, now: () => 0 });
  const I = new Float32Array(16);
  assert.equal(fight.drawPass(I, I, [0, 0, 0], 0, null), false, 'none handed, none drawn');
  fight.halos([{ at: [1, 2, 3], size: 0.5, color: [0.3, 0.24, 0.15] }, { at: [4, 5, 6], size: 1, color: [0.2, 0.4, 0.45] }]);
  let drew = false;
  for (let k = 0; k < 4 && !drew; k++) drew = fight.drawPass(I, I, [0, 0, 0], 0, null);   // its pass stands a few frames late, once compiled
  assert.equal(drew, true, 'drawn with no telegraph standing');
  assert.equal(draws.at(-1)[2], 2 * 6, 'both halos, one draw');
  fight.leave();
  const n = draws.length;
  assert.equal(fight.drawPass(I, I, [0, 0, 0], 0, null), false, 'forgotten off the ship');
  assert.equal(draws.length, n);
});

test('KETCH ONE SWING ONE SEQUENCE: the bodies a blow of mine meets in a frame share its number (the gate\'s blowQ) - the relay\'s hand spent once a swing, never once a body; a body met again, or the next frame, a new one (AUDIT SHIP 4; mutants: a number a body)', () => {
  const sent = [], ws = { fk: { c: [[0, 0, 5], [0, 0, 5], [0, 0, 5]] } };
  const state = { n: 1, sg: 0, bodies: [], blows: [], ws };
  const link = { state: () => state, owed: () => [], paid: () => {}, songBroken: () => false, joined: () => true };
  const fight = createKetchFight({ link, now: () => 0, sendHit: (m) => (sent.push(m.q), true) });
  for (const c of [0, 1, 2]) fight.forkHit({ c, d: 10, r: 'Shaft' });
  fight.forkHit({ c: 0, d: 10, r: 'Shaft' });
  state.ws = null; fight.frame(); state.ws = ws;
  fight.forkHit({ c: 1, d: 10, r: 'Shaft' });
  assert.equal(sent.length, 5);
  assert.equal(new Set(sent.slice(0, 3)).size, 1, 'one swing, three forks: one number');
  assert.notEqual(sent[3], sent[0], 'a fork met again: a new one');
  assert.notEqual(sent[4], sent[3], 'the next frame: a new one');
});
