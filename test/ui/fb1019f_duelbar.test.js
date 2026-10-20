// FIELD BUGS 2026-10-19f DUEL-BAR - a player's private report: in a duel, their own health bar did not drop when the other
// player hit them. By design since INT8 (bible/06-Systems/Integrity-Arc.md section 5, "Decisions (2026-10-09)"): a fight
// between players never touches the save's health, the relay's referee holds both fighters' VITALITY, and the player's
// own was a 13px line in the corner (world.js duelHudSay, "Your vitality: n / m") while the bar went on reading the save.
// THE OWNER'S DECISION (2026-10-19, "Bar shows duel vitality"): DISPLAY ONLY - for the length of a duel the HUD's health
// bar, on both skins, reads the referee's vitality, and the save's again at its end; the save's health is never written.
// Driven on the real modules: the real relay Room (test/fakeRoom.mjs) refereeing the bout, its words projected by the
// wire's own laws into a real duel manager (net/duel/duelSession.js), whose live duel net/duel/duelBar.js reads as my
// vitality and the real drawHud draws - the classic bars and the large HUD's rig off its snapshot, the enhanced HUD's
// bar off the pair it hands on.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from '../fakeRoom.mjs';
import { fakePage } from '../hudPage.mjs';
import { createDuelManager } from '../../src/net/duel/duelSession.js';
import { duelVitality } from '../../src/net/duel/duelBar.js';
import { validDuelData, validDuelRefOut } from '../../src/net/wire.js';
import { ROYAL_RING, SIEGE_UNITS_PER_M, siegeVitality } from '../../src/net/siege/siegeRef.js';
import { drawHud } from '../../src/ui/hud/hud.js';
import { hudHealth, lastHealthLost, _resetHudVitals, mathfRound } from '../../src/ui/hud/hudVitals.js';
import { _resetForTests as resetSettings } from '../../src/systems/settings/settings.js';
import { _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const T = 1_800_000_000;
const P = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M, yaw: 0, pitch: 0 });
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const WHOLE = siegeVitality(10);   // the Royal Tourney's vitality at the Renown the harness's tokens sign
/** What the world host hands drawHud: my vitality off the duel manager's live duel (world.js's own entry). */
const mine = (mgr) => duelVitality(mgr.live, 'peer-0001');

/**
 * A duel on the real relay: peer-0001 is a real duel manager - its frames said into the Room, the Room's frames to it
 * projected by the wire (validDuelData, validDuelRefOut), as net/online.js hands them on - and peer-0002 a bare socket
 * the test speaks for. `pump` carries both ways until the wire is quiet.
 */
async function withRelayDuel(fn) {
  const realNow = Date.now; let clock = T * 1000; Date.now = () => clock;
  const r = fakeRoom('world:3,12', { now: () => clock });
  const join = async (id, x) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK }); return ws; };
  const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'duel', data: d }));
  try {
    const a = await join('peer-0001', -2), b = await join('peer-0002', 2);
    const outbox = [];
    let read = 0;
    const mgr = createDuelManager({
      send: (d) => { outbox.push(d); return true; }, now: () => clock, selfId: () => 'peer-0001', near: () => true, can: () => null,
      ringFor: () => [1000 * M, 0, 1000 * M], reaches: () => true,
    });
    const pump = async () => {
      for (let moved = true; moved;) {
        moved = false;
        while (outbox.length) { moved = true; await say(a, outbox.shift()); }
        while (read < a.sent.length) {
          moved = true;
          const m = a.sent[read++];
          if (m.t === 'duel') { const d = validDuelData(m.data); if (d) mgr.onFrame(m.id, d, m.sub ?? null); }
          if (m.t === 'dref') { const g = validDuelRefOut(m); if (g) mgr.onRef(g); }
        }
      }
    };
    await fn({ mgr, a, b, say, pump, step: (ms) => { clock += ms; } });
  } finally { Date.now = realNow; }
}
/** The bout set on the real relay: my ask, their yes, my start - answered by the Room's `bout`. */
async function boutSet({ mgr, b, say, pump }) {
  assert.deepEqual(mgr.request('peer-0002'), { ok: true });
  await pump();
  const s = b.sent.find((m) => m.t === 'duel' && m.data.k === 'ask').data.s;
  await say(b, { to: 'peer-0001', s, k: 'yes' });
  return s;
}

const recorder = () => {
  const quads = [];
  return { quads, drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, uv, color }), uploadTexture: () => 'tex' };
};
const ART = {
  health: { tex: 'tex:MAIN03I0', w: 4, h: 32 }, fatigue: { tex: 'tex:MAIN04I0', w: 4, h: 32 }, magicka: { tex: 'tex:MAIN05I0', w: 4, h: 32 },
  compass: { tex: 'tex:COMPASS', w: 322, h: 17 }, compassBox: { tex: 'tex:COMPBOX', w: 69, h: 17 },
};
const CANVAS = { width: 320, height: 200 };
/** The classic small HUD's health bar this frame: its art-filled main quad's height (32 native px at scale 1). */
const classicHealth = (r) => r.quads.find((q) => q.tex === 'tex:MAIN03I0').h;
const save = (health, maxHealth) => ({ health, maxHealth, magicka: 20, maxMagicka: 20, fatigue: 6400, stats: { strength: 50, endurance: 50 }, activeEffects: [], items: [], equip: { slots: {} } });

test('DUEL-BAR THE DUEL\'S STATE: my vitality (duelBar.js duelVitality, off the manager\'s live duel) is my own entry of the referee\'s word on the real relay - none before the bout is set, the bout\'s whole, what each blow on me leaves, and none once the bout is over, though the manager holds it a moment yet (mutants: the opponent\'s entry read; the whole for what is left; a duel over still read)', () => withRelayDuel(async (w) => {
  const { mgr, b, say, pump, step } = w;
  assert.equal(mine(mgr), null, 'no duel: none');
  const s = await boutSet(w);
  // my yes came back: my start left the socket (the duel live here) - and the Room answered with the bout, both whole
  await pump();
  assert.ok(mgr.live, 'the duel is live');
  assert.deepEqual(mine(mgr), { health: WHOLE, maxHealth: WHOLE }, 'the bout set: the referee\'s whole');
  step(ROYAL_RING.countdownMs + 1);
  await say(b, { to: 'peer-0001', s, k: 'strike', n: 1, by: 'melee', p: [P(2).x, 0, P(2).z], d: 999 });
  await pump();
  const hp = w.a.sent.filter((m) => m.t === 'dref' && m.k === 'hp').at(-1);
  assert.ok(hp.d > 0, 'a blow landed');
  assert.deepEqual(mine(mgr), { health: WHOLE - hp.d, maxHealth: WHOLE }, 'what the referee says I have left - never the opponent\'s whole');
  // they yield: the referee ends the bout, and the bar's source with it
  await say(b, { to: 'peer-0001', s, k: 'end', why: 'yield' });
  await pump();
  assert.equal(mgr.live, null, 'over');
  assert.ok(mgr.duel, 'held for its hold yet');
  assert.equal(mine(mgr), null, 'over is over: the save\'s bar again, not the ended bout\'s');
}));

test('DUEL-BAR THE CLASSIC HUD: the health bar reads the referee\'s vitality for the duel\'s length and the save\'s at its end; the turn each way is no blow and no heal to the detector (its recoil, lens and near-death tint); the save\'s health is never written (mutants: drawHud never reads healthBar; the turn read as a blow; the turn read as a heal)', () => withRelayDuel(async (w) => {
  const { mgr, b, say, pump, step } = w;
  const hadLoc = globalThis.location;
  globalThis.location = { search: '?skin=classic' };
  resetSettings();
  _resetHudVitals();
  // the save's maximum the referee's own, so only the turn itself - never a change of maximum - re-primes the detector
  const me = save(40, WHOLE);
  const frame = () => { const r = recorder(); drawHud(r, CANVAS, ART, me, 0, 0.016, { healthBar: mine(mgr) }); return r; };
  try {
    assert.equal(classicHealth(frame()), mathfRound(32 * 40 / WHOLE), 'before the duel: the save\'s');
    const s = await boutSet(w);
    await pump();
    assert.equal(classicHealth(frame()), 32, 'the bout set: the referee\'s whole, at once');
    assert.equal(lastHealthLost(), 0, 'the turn to the referee is no heal');
    step(ROYAL_RING.countdownMs + 1);
    await say(b, { to: 'peer-0001', s, k: 'strike', n: 1, by: 'melee', p: [P(2).x, 0, P(2).z], d: 999 });
    await pump();
    const dealt = w.a.sent.filter((m) => m.t === 'dref' && m.k === 'hp').at(-1).d;
    const struck = mathfRound(32 * (WHOLE - dealt) / WHOLE);
    assert.equal(classicHealth(frame()), struck, 'the blow on me: the bar drops by what the referee took');
    assert.equal(lastHealthLost(), dealt, 'and the detector reads it as the blow it is');
    me.health = 70;   // a potion of my own under the duel: the save's, never shown as the duel's
    assert.equal(classicHealth(frame()), struck, 'the save\'s heal moves no part of the duel\'s bar');
    assert.equal(lastHealthLost(), 0, 'nor the detector');
    await say(b, { to: 'peer-0001', s, k: 'end', why: 'yield' });
    await pump();
    assert.equal(classicHealth(frame()), mathfRound(32 * 70 / WHOLE), 'the duel over: the save\'s bar again');
    assert.equal(lastHealthLost(), 0, 'the turn back is no blow');
    assert.deepEqual([me.health, me.maxHealth], [70, WHOLE], 'the save\'s health: what the save did, never the duel');
  } finally {
    _resetHudVitals();
    if (hadLoc === undefined) delete globalThis.location; else globalThis.location = hadLoc;
  }
}));

// THE PAGE (test/ui/hud/fb1018f_dungeondigits.test.js's): hudPage.mjs's tree, with the members the enhanced HUD and its
// bar write besides. The enhanced HUD is module state, built into the page its first frame finds.
function page() {
  const doc = fakePage();
  const make = doc.createElement;
  doc.createElement = (tag) => {
    const n = make(tag);
    const on = new Set();
    n.classList = {
      add: (...c) => c.forEach((x) => on.add(x)), remove: (...c) => c.forEach((x) => on.delete(x)),
      toggle: (c, v) => { const now = v ?? !on.has(c); if (now) on.add(c); else on.delete(c); return now; }, contains: (c) => on.has(c),
    };
    n.appendChild = (c) => { n.append(c); return c; };
    n.prepend = (...c) => n.append(...c);
    Object.defineProperty(n, 'parentNode', { get: () => n.parentElement });
    n.offsetWidth = 0;
    return n;
  };
  doc.createElementNS = (ns, tag) => doc.createElement(tag);
  doc.createTextNode = (t) => ({ textContent: String(t) });
  doc.documentElement = doc.createElement('html');
  doc.fonts = { add() {} };
  doc.win = { addEventListener() {}, removeEventListener() {} };
  return doc;
}

test('DUEL-BAR THE ENHANCED HUD: the health bar\'s fill and figure read the referee\'s vitality for the duel\'s length and the save\'s at its end, through drawHud\'s own pair; the turn each way breaks no piece off and floats no heal, nor does the save\'s heal under the duel - a heal after it floats as ever; the save\'s health is never written (mutants: the enhanced HUD reads the entity past drawHud\'s pair; drawHud hands it none; the held loss kept through the turn; the falling piece left; the heal\'s reading kept through the turn)', () => withRelayDuel(async (w) => {
  const { mgr, b, say, pump, step } = w;
  const had = { doc: globalThis.document, win: globalThis.window, loc: globalThis.location };
  const doc = page();
  globalThis.document = doc; globalThis.window = doc.win; globalThis.location = { search: '?skin=enhanced' };
  resetPrefs(); resetSettings(); _resetHudVitals();
  const { destroyEnhancedHud } = await import('../../src/ui/enhanced/enhancedHud.js');
  const me = save(40, 80);
  const frame = () => drawHud(recorder(), { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 }, null, me, 0, 1 / 60, { cursorActive: false, healthBar: mine(mgr) });
  const bar = () => [doc.querySelector('.hud-health .hud-num').textContent, doc.querySelector('.hud-health .hud-fill').style.width];
  const fallen = () => doc.querySelectorAll('.hud-health .hud-chunk').filter((c) => c.className !== 'hud-chunk').length;
  const heals = () => doc.querySelectorAll('.hitnum-heal').map((n) => n.textContent);
  try {
    frame();
    assert.deepEqual(bar(), ['50%', '50.0%'], 'before the duel: the save\'s');
    const s = await boutSet(w);
    await pump();
    frame();
    assert.deepEqual(bar(), ['100%', '100.0%'], 'the bout set: the referee\'s whole');
    assert.deepEqual(heals(), [], 'the turn to the referee floats no heal');
    step(ROYAL_RING.countdownMs + 1);
    await say(b, { to: 'peer-0001', s, k: 'strike', n: 1, by: 'melee', p: [P(2).x, 0, P(2).z], d: 999 });
    await pump();
    const left = (WHOLE - w.a.sent.filter((m) => m.t === 'dref' && m.k === 'hp').at(-1).d) / WHOLE * 100;
    frame();
    assert.deepEqual(bar(), [`${Math.round(left)}%`, `${left.toFixed(1)}%`], 'the blow on me: what the referee left');
    assert.equal(fallen(), 1, 'the blow breaks its piece off the bar');
    me.health = 70;   // a potion of my own under the duel
    frame();
    assert.deepEqual(bar(), [`${Math.round(left)}%`, `${left.toFixed(1)}%`], 'the save\'s heal moves no part of the duel\'s bar');
    assert.deepEqual(heals(), [], 'and floats nothing');
    await say(b, { to: 'peer-0001', s, k: 'end', why: 'yield' });
    await pump();
    frame();
    assert.deepEqual(bar(), ['88%', '87.5%'], 'the duel over: the save\'s again');
    assert.equal(doc.querySelector('.hud-health .hud-ghost').style.width, '87.5%', 'its held loss starts afresh - no pale strip of a loss the save never took');
    assert.equal(fallen(), 0, 'the turn back breaks nothing off, and the blow\'s piece is put away');
    assert.deepEqual(heals(), [], 'nor floats a heal');
    me.health = 75;
    frame();
    assert.deepEqual(heals(), ['+5'], 'a heal after the duel floats as ever');
    assert.deepEqual([me.health, me.maxHealth], [75, 80], 'the save\'s health: what the save did, never the duel');
    // the pair is drawHud's own: the save's fields with no bar handed in, the bar's when it is
    assert.deepEqual(hudHealth(me), { health: 75, maxHealth: 80, from: 'save' });
    assert.deepEqual(hudHealth(me, { health: 7, maxHealth: 320 }), { health: 7, maxHealth: 320, from: 'referee' });
  } finally {
    destroyEnhancedHud(); _resetHudVitals(); resetPrefs();
    for (const [k, v] of [['document', had.doc], ['window', had.win], ['location', had.loc]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
}));

test('DUEL-BAR THE HOST: the world host hands drawHud my vitality off the duel manager\'s live duel - one entry, in its one drawHud call, by my own peer id; the duel\'s readout keeps its line; the law is a leaf of the client\'s, never in the relay\'s bundle (net/duel/duelSession.js, which the relay\'s arena reaches, untouched); no host and no HUD module writes the referee\'s word into the save\'s health (mutants: the entry dropped; the duel held after its end read; the vitality written to the save)', () => {
  const world = rd('src/scenes/world.js');
  const call = world.slice(world.indexOf('drawHud(renderer, canvas, hudArt, playerEntity,'), world.indexOf('weaponSheathed: !!weaponRig.playerWeapon.sheathed });'));
  assert.match(call, /\n\s*healthBar: duelVitality\(duelMgr\.live, online\?\.id \?\? ''\),/);
  assert.equal(world.match(/healthBar:/g).length, 1, 'one wiring line');
  assert.match(world, /^import \{ duelVitality \} from '\.\.\/net\/duel\/duelBar\.js';/m);
  assert.match(world, /const me = online\?\.id \?\? '', h = d\.h \?\? \[\];/, 'the readout\'s own "me", the same id');
  assert.match(world, /self: mine \? \[`Your vitality: \$\{mine\[1\]\} \/ \$\{mine\[2\]\}`\] : \[\]/, 'the readout\'s own line stands');
  assert.equal(rd('src/net/duel/duelSession.js').includes('duelBar'), false, 'the relay\'s duel law knows nothing of the bar');
  assert.equal(rd('server/src/index.js').includes('duelBar'), false);
  for (const f of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/ui/hud/hud.js', 'src/ui/hud/hudVitals.js', 'src/ui/enhanced/enhancedHud.js', 'src/net/duel/duelBar.js']) {
    assert.equal(/\.health\s*=[^=][^;]*vitality/.test(rd(f)), false, `${f}: no write of the referee's vitality to a health`);
  }
  // the four hosts (Home.md): a duel is outdoors alone - the street's host wires it; a building, a dungeon and the offline
  // city never hold a live duel (duelCan's 'outdoors'), and hand drawHud no bar
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js']) assert.equal(rd(f).includes('healthBar'), false, f);
  assert.match(world, /if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return 'outdoors';/);
});
