// TELL9 - ON SCREEN (bible/12-Enhanced-AI/Feud-Arc.md section 11; Mac, 2026-10-04: "breath more depth into it", then
// "Go" on every call). The fight the ground and the ear tell, read where the player looks:
//   THE BAR'S FOE ON A THREAT - a foe that winds up at me takes the target bar (ui/hudFoeTarget.js markFoeThreat) unless
//     I struck another in the last 2 s;
//   THE POISE TRACK - under its health: empty outside a wind-up, amber and filling toward its poise, red and hatched
//     "Iron", a white flash and "Staggered" at a break, "Open" through an overreach (ai/tactics.js poiseTrack);
//   THE WORDS ON THE HIT - "Stagger", "Holds", "Open" on my blow's number, "Perfect" at a perfect dodge ("Weakness" is
//     RVN3's to say) (ui/hitNumbers.js tagHit, showWord; scenes/hostCombat.js windupTag);
//   TELEGRAPH CONTRAST - a part of the Enhanced AI row: thicker lines, a white keyline, a pattern for every guard;
//   THE BLEED'S OWN ICON - two drops of blood on the kit's grid, on both skins.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MobileUnit } from '../src/characters/mobileUnit.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, poiseTrack, LOCAL_TARGET } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, makeBlow, BLOW_COLOR } from '../src/ai/foeBlows.js';
import { markFoeStruck, markFoeThreat, tickFoeTarget, foeTarget, clearFoeTarget, THREAT_YIELD_S, FOE_TARGET_SECONDS } from '../src/ui/hudFoeTarget.js';
import { HIT_TAGS, TAG_JOIN_MS, tagHit, showWord, mountHitNumbers, unmountHitNumbers } from '../src/ui/hitNumbers.js';
import { reportPlayerAttack } from '../src/combat/formulas.js';
import { windupDoor, windupTag, tellCues } from '../src/scenes/hostCombat.js';
import { FEATURES } from '../src/systems/features.js';
import { STATUS_GLYPHS, afflictionRows, statusTiles, statusGlyphColor32 } from '../src/ui/hudStatus.js';
import { activeSpellIcons, drawActiveSpells, BLEED_ICON, BLEED_GLYPH } from '../src/ui/hudActiveSpells.js';
import { _setSpellIconsForTests } from '../src/ui/spellIcons.js';
import { TELEGRAPH_STYLE_GLSL, CONTRAST_DOTS, CONTRAST_DOT_R } from '../src/render/telegraphStyle.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DT = 1 / 60;
const CAM = [0, 1.6, -5];
const ORC_W = 600;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); clearFoeTarget(); T = 0; setPref('enhancedAI', true); setPref('telegraphContrast', false); });

/** A minimal document: the hit numbers' layer and its nodes (test/hitNumbers.test.js's own shape). */
function fakeDocument() {
  const nodes = [];
  const fakeEl = (tag) => {
    const el = { tag, children: [], style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, className: '', textContent: '', listeners: {},
      append(...c) { this.children.push(...c); for (const x of c) x.parent = this; }, isConnected: true,
      addEventListener(n, f) { this.listeners[n] = f; }, remove() { this.isConnected = false; this.parent?.children.splice(this.parent.children.indexOf(this), 1); },
      setAttribute() {} };
    nodes.push(el); return el;
  };
  const body = fakeEl('body');
  globalThis.document = { createElement: fakeEl, getElementById: () => null, body };
  const layer = () => body.children.find((c) => c.id === 'enhanced-hitnums');
  return { nodes, layer, words: () => (layer()?.children ?? []).filter((n) => n.isConnected).map((n) => [n.className, n.textContent, ...n.children.map((c) => c.textContent)]) };
}

// ── the poise track's law ───────────────────────────────────────────

test('TELL9: the poise track - none without the switch or a brain; empty outside a wind-up; amber filling toward its poise; red "Iron"; white "Staggered"; "Open" through an overreach; a charge\'s run its landing (AUDIT TELL); a feint read as any wind-up, a cut one gone (mutants: each state; the fill unclamped; the switch unread)', () => {
  const blow = (o = {}) => ({ guard: 'poise', ...o });
  assert.equal(poiseTrack(null), null);
  assert.equal(poiseTrack({}), null, 'the classic motor has no brain: no track at all');
  assert.deepEqual(poiseTrack({ _tac: { state: 'engage' } }), { state: 'empty', fill: 0, word: '' });
  assert.deepEqual(poiseTrack({ _tac: { state: 'windup', blow: blow() } }), { state: 'windup', fill: 0, word: '' }, 'no blow yet: its poise unset');
  assert.deepEqual(poiseTrack({ _tac: { state: 'windup', blow: blow({ poise: 30, taken: 12 }) } }), { state: 'windup', fill: 0.4, word: '' });
  assert.equal(poiseTrack({ _tac: { state: 'windup', blow: blow({ poise: 30, taken: 45 }) } }).fill, 1, 'never past full');
  assert.deepEqual(poiseTrack({ _tac: { state: 'windup', blow: blow({ guard: 'iron' }) } }), { state: 'iron', fill: 1, word: 'Iron' });
  assert.deepEqual(poiseTrack({ _tac: { state: 'staggered' } }), { state: 'staggered', fill: 1, word: 'Staggered' });
  assert.deepEqual(poiseTrack({ _tac: { state: 'overreach' } }), { state: 'open', fill: 0, word: 'Open' });
  // PIN MOVED (AUDIT TELL: a charge's run is its landing - a blow on it is DFU's, so the track claims no poise for it)
  assert.deepEqual(poiseTrack({ _tac: { state: 'dash', dash: { blow: blow({ poise: 20, taken: 5 }) } } }), { state: 'empty', fill: 0, word: '' }, 'a charge running: its landing');
  assert.deepEqual(poiseTrack({ _tac: { state: 'dash', dash: { blow: blow({ guard: 'iron' }) } } }).state, 'empty');
  assert.deepEqual(poiseTrack({ _tac: { state: 'windup', seen: -5, blow: blow({ guard: 'iron' }) } }), { state: 'empty', fill: 0, word: '' }, 'AUDIT TELL B1: a wind-up nobody steps tells nothing');
  assert.deepEqual(poiseTrack({ _tac: { state: 'windup', blow: blow({ feint: true, poise: 10, taken: 5 }) } }), { state: 'windup', fill: 0.5, word: '' }, 'a feint tells no more on the bar than on the ground');
  assert.deepEqual(poiseTrack({ _tac: { state: 'windup', blow: null } }), { state: 'empty', fill: 0, word: '' }, 'a cut feint: its blow is gone');
  setPref('enhancedAI', false);
  assert.equal(poiseTrack({ _tac: { state: 'windup', blow: blow({ guard: 'iron' }) } }), null, 'the switch off: the classic motor\'s fight, no track');
});

// ── the bar's foe on a threat ───────────────────────────────────────

const foeRec = (name, tac = { state: 'windup', blow: { guard: 'iron' } }, entity = {}) => ({ entity: { name, health: 40, maxHealth: 50, ...entity }, ai: { _tac: tac } });

test('TELL9: the bar\'s foe on a threat - a foe winding up at me takes the bar unless I struck another in the last 2 s; its own threat refreshes it; a bout\'s fighter, a dead foe or none never; the poise rides the target (mutants: the yield gone, or kept past 2 s; the refresh; the bout let through)', () => {
  assert.equal(THREAT_YIELD_S, 2);
  const a = foeRec('Orc'), b = foeRec('Rat', { state: 'engage' });
  markFoeThreat(a);
  assert.equal(foeTarget().name, 'Orc', 'nothing struck: the threat takes the bar');
  assert.deepEqual(foeTarget().poise, { state: 'iron', fill: 1, word: 'Iron' }, 'its track, through the reader the host registered (scenes/hostCombat.js)');
  markFoeStruck(b);
  assert.equal(foeTarget().name, 'Rat');
  assert.deepEqual(foeTarget().poise, { state: 'empty', fill: 0, word: '' });
  markFoeThreat(a);
  assert.equal(foeTarget().name, 'Rat', 'I struck the rat this instant: it keeps the bar');
  tickFoeTarget(1.9);
  markFoeThreat(a);
  assert.equal(foeTarget().name, 'Rat', 'and 1.9 s on');
  tickFoeTarget(0.15);
  markFoeThreat(a);
  assert.equal(foeTarget().name, 'Orc', 'past 2 s the threat takes it');
  // its own threat refreshes its welcome
  tickFoeTarget(FOE_TARGET_SECONDS - 1);
  markFoeThreat(a);
  tickFoeTarget(FOE_TARGET_SECONDS - 1);
  assert.equal(foeTarget()?.name, 'Orc', 'a second wind-up keeps the bar up');
  // the struck foe winding up keeps its own bar, whatever the clock
  markFoeStruck(b);
  b.ai._tac = { state: 'windup', blow: { guard: 'poise', poise: 10, taken: 4 } };
  markFoeThreat(b);
  assert.equal(foeTarget().name, 'Rat');
  assert.equal(foeTarget().poise.fill, 0.4);
  // never: a bout's fighter (the versus bar's), a dead foe, a record with no entity
  clearFoeTarget();
  markFoeThreat(foeRec('Champion', undefined, { bout: { side: 1 } }));
  assert.equal(foeTarget(), null, 'the arena\'s versus bar names it');
  markFoeThreat(foeRec('Chained', undefined, { bout: { chained: true } }));
  assert.equal(foeTarget().name, 'Chained', 'an undercroft beast keeps the frame (AUDIT PRE-MERGE 1003 U3)');
  clearFoeTarget();
  markFoeThreat({ ...foeRec('Ghost'), dead: true });
  markFoeThreat({ ai: {} });
  markFoeThreat(null);
  assert.equal(foeTarget(), null);
  const live = foeRec('Live', { state: 'engage' });
  markFoeStruck(live);
  tickFoeTarget(THREAT_YIELD_S + 1);
  markFoeThreat({ ...foeRec('Ghost'), dead: true });
  assert.equal(foeTarget()?.name, 'Live', 'a dead foe\'s threat takes nothing from the living');
  // a foe with no brain (a duel's opponent): no track
  markFoeStruck({ entity: { name: 'Duelist', health: 5, maxHealth: 9 } });
  assert.equal(foeTarget().poise, null);
});

// ── on the real brain ───────────────────────────────────────────────

function foe({ mobileType = M.Orc, at = [0, 0, 8] } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 100, maxHealth: 100, mobileType, level: 12, name: 'Orc' };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  const mobile = new MobileUnit(mobileType, ENEMY_BASICS[mobileType], () => 8, () => 0.99);
  return { ai, atk, ent, c, mobile, mobileType, entity: ent, _seq: 0 };
}
function run(f, secs, player, each = null) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    f.ai.update(DT, player);
    f.atk.update(DT, f.ai, player);
    const edge = f.atk.swingSeq !== f._seq;
    f._seq = f.atk.swingSeq;
    f.mobile.update(DT, { striking: edge && !f.atk.firedRanged, hold: f.ai._blowHold, hurting: f.ai.hurtKnock || f.ai.staggered }, f.ai.yaw, f.ai.feet, CAM);
    if (f.mobile.doMeleeDamage) f.mobile.doMeleeDamage = false;
    if (each?.(s)) return true;
  }
  return false;
}

test('TELL9: on the real brain - a foe that winds up at me takes the bar through its cues, and its track fills as my blows hold, then flashes "Staggered" at the break (mutants: the threat unmarked; marked for a blow at another)', () => {
  const f = foe(), player = [0, 0, 0];
  const other = foeRec('Rat', { state: 'engage' });
  markFoeStruck(other);
  tickFoeTarget(THREAT_YIELD_S + 0.1);
  assert.ok(run(f, 60, player, () => { tellCues(f, null); return f.ai._tac?.state === 'windup'; }), 'it winds up');
  assert.equal(f.ai._tac.key, LOCAL_TARGET);
  assert.ok(liveBlows().get(f.ai));
  assert.equal(foeTarget().name, 'Orc', 'the foe winding up at me took the bar from the one I struck 2 s ago');
  assert.deepEqual(foeTarget().poise, { state: 'windup', fill: 0, word: '' }, 'an orc is a medium body: its blows take poise');
  assert.equal(windupDoor(f, 6, { kind: 'melee', weight: ORC_W, from: player }), 'hold');
  assert.ok(foeTarget().poise.fill > 0 && foeTarget().poise.fill < 1, `${foeTarget().poise.fill}`);
  assert.equal(windupDoor(f, 999, { kind: 'melee', weight: ORC_W, from: player }), 'stagger');
  assert.deepEqual(foeTarget().poise, { state: 'staggered', fill: 1, word: 'Staggered' });
  // a blow wound up at another target never marks: the cues' threat is the local player's
  clearFoeTarget();
  const g = foeRec('Elsewhere', { state: 'windup', blow: { guard: 'poise', start: T, land: T + 1 }, key: { owner: 'peer-1' } });
  g.ai.feet = [0, 0, 0];
  tellCues(g, null);
  assert.equal(foeTarget(), null);
});

// ── the words on the hit ────────────────────────────────────────────

test('TELL9: the words - Stagger, Holds, Open, Perfect, Weakness; the door\'s word joins the number my blow just raised, or rises alone; a peer\'s or a foe\'s blow says nothing; a break that cannot stagger says nothing; no enhanced HUD, nothing (mutants: the join, the window, the mine-only gate, each word)', () => {
  assert.deepEqual({ ...HIT_TAGS }, { stagger: 'Stagger', hold: 'Holds', open: 'Open', perfect: 'Perfect', weakness: 'Weakness' });
  assert.equal(TAG_JOIN_MS, 250);
  const target = { name: 'orc' }, f = { entity: target };
  assert.equal(windupTag('hold', f, false), 'Holds');
  assert.equal(tagHit(target, 'Holds'), null, 'no enhanced HUD mounted: nothing drawn');
  const dom = fakeDocument();
  try {
    mountHitNumbers();
    reportPlayerAttack({ hit: true, damage: 7, target });
    assert.equal(windupTag('hold', f, false), 'Holds');
    assert.deepEqual(dom.words(), [['hitnum hitnum-hit', '7', 'Holds']], 'the word joins the number my blow raised');
    assert.equal(tagHit(target, ''), null, 'no word, nothing joined');
    assert.equal(tagHit(target, null), null);
    assert.deepEqual(dom.words(), [['hitnum hitnum-hit', '7', 'Holds']]);
    reportPlayerAttack({ hit: true, damage: 21, backstab: true, target });
    assert.equal(windupTag('stagger', f, false), 'Stagger');
    assert.deepEqual(dom.words()[1], ['hitnum hitnum-crit', '21', 'Backstab', 'Stagger'], 'beside a backstab\'s own');
    assert.equal(windupTag('break', f, false), null, 'a break inside the stagger guard says nothing - the mark going out says it');
    assert.equal(windupTag(null, f, true), 'Open', 'an overreached foe my blow could not stagger');
    assert.equal(windupTag('stagger', f, true), 'Stagger', '...and one it did');
    assert.equal(windupTag(null, f, false), null);
    // another target, or a number too old: the word rises alone
    const n = dom.words().length;
    tagHit({ name: 'rat' }, 'Holds');
    assert.deepEqual(dom.words()[n], ['hitnum hitnum-word', 'Holds'], 'a spell\'s landing raised no number: the word alone');
    reportPlayerAttack({ hit: true, damage: 3, target });
    tagHit(target, 'Holds', { now: Date.now() + TAG_JOIN_MS + 50 });
    assert.deepEqual(dom.words().at(-1), ['hitnum hitnum-word', 'Holds'], 'past the window it is not that number\'s');
    reportPlayerAttack({ hit: false, damage: 0, target });
    const m = dom.words().length;
    tagHit(target, 'Holds');
    assert.deepEqual(dom.words()[m], ['hitnum hitnum-word', 'Holds'], 'a miss is no blow to tag');
    // the door: my blow tags, a peer's or a foe's does not
    const g = { entity: { name: 'g' }, ai: { feet: [0, 0, 0], _tac: { state: 'windup', blow: { guard: 'iron', origin: [0, 0, 0], yaw: 0 } } } };
    const k = dom.words().length;
    assert.equal(windupDoor(g, 5, { kind: 'melee', weight: ORC_W, peer: true }), 'hold');
    assert.equal(windupDoor(g, 5, { kind: 'melee', weight: ORC_W, striker: { entity: {}, mobileType: M.Orc } }), 'hold');
    assert.equal(dom.words().length, k, 'a peer\'s blow and a foe\'s say nothing on my screen');
    assert.equal(windupDoor(g, 5, { kind: 'melee', weight: ORC_W }), 'hold');
    assert.equal(dom.words().length, k + 1, 'mine does');
    assert.deepEqual(dom.words().at(-1), ['hitnum hitnum-word', 'Holds']);
    // an overreached foe: my first blow staggers it ("Stagger"), one inside its stagger guard opens nothing more ("Open")
    const o = { entity: { name: 'o' }, ai: { feet: [0, 0, 0], _tac: { state: 'overreach', until: T + 1 } } };
    assert.equal(windupDoor(o, 5, { kind: 'melee', weight: ORC_W }), 'stagger');
    assert.deepEqual(dom.words().slice(k + 1), [['hitnum hitnum-word', 'Stagger']]);
    const o2 = { entity: { name: 'o2' }, ai: { feet: [0, 0, 0], _tac: { state: 'overreach', until: T + 1, staggerReady: T + 5 } } };
    assert.equal(windupDoor(o2, 5, { kind: 'melee', weight: ORC_W }), null);
    assert.deepEqual(dom.words().slice(k + 2), [['hitnum hitnum-word', 'Open']]);
    assert.equal(windupDoor(o2, 5, { kind: 'melee', weight: ORC_W, peer: true }), null);
    assert.equal(dom.words().length, k + 3, 'a peer\'s blow on it says nothing here');
    // a lone word: showWord; nothing once unmounted
    showWord('Perfect', 'perfect');
    assert.deepEqual(dom.words().at(-1), ['hitnum hitnum-perfect', 'Perfect']);
    unmountHitNumbers();
    assert.equal(showWord('Perfect', 'perfect'), null);
    assert.equal(tagHit(target, 'Holds'), null);
  } finally { unmountHitNumbers(); delete globalThis.document; }
});

test('TELL9: a perfect dodge says "Perfect" at its landing with its ring, once; an older one nothing (mutants: the word missing or twice)', () => {
  const dom = fakeDocument();
  try {
    mountHitNumbers();
    const mk = () => ({ mobileType: M.Orc, mobile: { meleeSeq: 0 }, ai: { feet: [0, 0, 0], _tac: { state: 'windup', key: LOCAL_TARGET, blow: { start: 10, land: 10.8 } }, _blowHold: true } });
    const f = mk();
    tellCues(f, null, 1, 10);
    Object.assign(f.ai, { _tac: { state: 'overreach', blow: null }, _blowLandedAt: 10.8, _blowHold: 'spent', _perfectAt: 10.8 });
    tellCues(f, null, 1, 10.81);
    tellCues(f, null, 1, 10.9);
    assert.deepEqual(dom.words().filter((w) => w[1] === 'Perfect'), [['hitnum hitnum-perfect', 'Perfect']]);
    const g = mk();
    tellCues(g, null, 1, 10);
    Object.assign(g.ai, { _tac: { state: 'overreach', blow: null }, _blowLandedAt: 10.8, _blowHold: 'spent', _perfectAt: 3 });
    tellCues(g, null, 1, 10.81);
    assert.equal(dom.words().filter((w) => w[1] === 'Perfect').length, 1, 'an older perfect dodge is not this one');
  } finally { unmountHitNumbers(); delete globalThis.document; }
});

// ── reading it: telegraph contrast ──────────────────────────────────

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('TELL9: telegraph contrast - a part of the Enhanced AI row, off by default, the player\'s online; the pass reads it each draw; thicker lines, a white keyline and a pattern for every guard (dots for poise, iron\'s hatch always) (mutants: the uniform never set; the pref unread; the dots on iron)', async () => {
  const row = FEATURES.find((x) => x.id === 'enhanced-ai');
  assert.deepEqual(row.control.also, [{ store: 'prefs', key: 'telegraphContrast', initial: false, online: 'player' }]);
  assert.deepEqual(row.control.parts, [{ key: 'telegraphContrast', label: 'Telegraph contrast' }]);
  assert.equal(PREF_DEFAULTS.telegraphContrast, false, 'off by default');
  assert.equal(CONTRAST_DOTS, 0.3);
  assert.equal(CONTRAST_DOT_R, 0.06);
  assert.match(TELEGRAPH_STYLE_GLSL, /vec4 telegraphContrast\(vec4 o, float edge, float fin, vec2 p, float iron, vec3 col, float fogK\)/);
  assert.match(TELEGRAPH_STYLE_GLSL, /vec3\(1\.0\) \* kw/, 'the white keyline');
  assert.match(TELEGRAPH_STYLE_GLSL, /\(1\.0 - iron\)/, 'the dots for poise alone - iron keeps its hatch');
  const P = rd('src/render/foeTelegraph.js');
  assert.match(P, /uniform float uContrast;/);
  assert.match(P, /if \(uContrast > 0\.5\) oColor = telegraphContrast\(oColor, dist, inside \? 1\.0 : 0\.0, vec2\(across, along\), uIron, uColor, fogK\);/);
  assert.ok(P.indexOf('telegraphContrast(oColor') < P.indexOf('if (uCut > 0.0)'), 'a cut feint dashes the bold mark too');
  const { FoeTelegraphPass } = await import('../src/render/foeTelegraph.js');
  const { gl, calls } = fakeGl();
  const pass = new FoeTelegraphPass(gl);
  const plain = makeBlow('slam', [0, 0, 0], 0, 0, BLOW_COLOR);
  const ups = () => calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uContrast').map((c) => c[2]);
  calls.length = 0;
  pass.draw([{ blow: plain, phase: { t: 0.5, flash: 0 } }], I, I);
  assert.deepEqual(ups(), [0]);
  setPref('telegraphContrast', true);
  calls.length = 0;
  pass.draw([{ blow: plain, phase: { t: 0.5, flash: 0 } }], I, I);
  assert.deepEqual(ups(), [1], 'read each draw: the switch flips the next frame');
  calls.length = 0;
  pass.draw([{ blow: plain, phase: { t: 0.5, flash: 0 } }], I, I, null, { contrast: false });
  assert.deepEqual(ups(), [0], 'a caller may say (the probe)');
  assert.match(rd('tools/foeTelegraphProbe.mjs'), /TELL9: contrast/, 'the probe reads it off a real frame');
});

// ── the bleed's own icon ────────────────────────────────────────────

test('TELL9: the bleed\'s own icon - two drops of blood on the kit\'s 16px grid, outlined; the enhanced widget\'s tile ("Bleeding", its ticks at its foot, the last blinking) and the classic row\'s, drawn from the glyph (mutants: the tile gone; the foot; the classic row drawing the atlas)', () => {
  const g = STATUS_GLYPHS.bleed;
  assert.ok(g, 'a glyph of its own');
  assert.equal(g.rows.length, 16);
  for (const r of g.rows) { assert.equal(r.length, 16); assert.match(r, /^[.kabc]+$/); }
  assert.deepEqual(Object.keys(g.pal).sort(), ['a', 'b', 'c']);
  for (const c of Object.values(g.pal)) { const n = parseInt(c.slice(1), 16); assert.ok((n >> 16) > ((n >> 8) & 255) + 60, `${c} is red`); }
  assert.equal(BLEED_GLYPH, 'bleed');
  // the enhanced widget
  assert.deepEqual(afflictionRows({ bleed: { per: 2, left: 3, next: 0 } }), [{ key: 'bleed', name: 'Bleeding', glyph: 'bleed', foot: '3', blink: false }]);
  assert.deepEqual(afflictionRows({ bleed: { per: 2, left: 1, next: 0 } })[0].blink, true, 'its last tick blinks');
  assert.deepEqual(afflictionRows({ bleed: { per: 2, left: 0 } }), []);
  assert.deepEqual(afflictionRows({ bleed: null }), []);
  const tiles = statusTiles({ afflictions: afflictionRows({ bleed: { per: 2, left: 1 } }) });
  assert.equal(tiles.length, 1);
  assert.equal(tiles[0].kind, 'debuff');
  assert.equal(tiles[0].glyph, 'bleed');
  assert.equal(tiles[0].foot, '1');
  assert.equal(tiles[0].blink, true);
  // the classic row: the glyph as a texture, never the atlas's first icon
  const c32 = statusGlyphColor32('bleed');
  assert.equal(c32.width, 16); assert.equal(c32.height, 16);
  const u8 = new Uint8Array(c32.colors.buffer);
  assert.equal(u8[3], 0, 'a "." is clear');
  const k = g.rows[1].indexOf('k');
  assert.deepEqual([...u8.slice((16 + k) * 4, (16 + k) * 4 + 4)], [5, 6, 8, 255], 'a "k" the kit\'s outline');
  assert.equal(statusGlyphColor32('nonsense'), null);
  const ent = { bleed: { per: 2, left: 2, next: 0 }, activeEffects: [] };
  const row = activeSpellIcons(ent).other.find((i) => i.displayName === 'Bleeding');
  assert.equal(row.iconIndex, BLEED_ICON, 'DFU\'s shape kept (the tooltip, the hit test)');
  assert.equal(row.glyph, 'bleed');
  _setSpellIconsForTests({ icons: { tex: 'ICONS', w: 320, h: 64 }, mask: { tex: 'MASK', w: 40, h: 80 } });
  try {
    const uploads = [], quads = [];
    const renderer = { uploadTexture: (a, r, c) => { uploads.push([a, r, c.width]); return `TEX:${a}/${r}`; }, drawScreenQuad: (tex) => quads.push(tex) };
    drawActiveSpells(renderer, { ox: 0, oy: 0, s: 1 }, ent, { schemeName: 'classic' });
    assert.deepEqual(uploads, [['glyph', 'bleed', 16]]);
    assert.deepEqual(quads, ['TEX:glyph/bleed'], 'its own picture, not ICON00I0\'s');
  } finally { _setSpellIconsForTests(null); }
});

// ── the Features note, the HUD, the sheet ───────────────────────────

test('TELL9: the Enhanced AI note gains its line - wound-up blows, the stagger, the punish, iron that cannot be stopped - and stays inside its budget', () => {
  const row = FEATURES.find((x) => x.id === 'enhanced-ai');
  assert.match(row.note, /Wound-up blows are marked on the ground: hit hard to stagger, dodge to punish; red, hatched iron cannot be stopped\./);
  assert.ok(row.note.length <= 450, `${row.note.length}`);
});

test('TELL9: the enhanced HUD draws the track under the foe\'s health - its state a class, its fill, its word; the sheet colours it (amber, iron red and hatched, the staggered flash, open) and honours reduced motion; the quest card clears the taller bar; the words wear the numbers\' face (mutants: the track never drawn; the hatch gone; the flash under reduced motion)', () => {
  const hud = rd('src/ui/enhancedHud.js');
  assert.match(hud, /const foePoise = el\('div', 'hud-foepoise'\);/);
  assert.match(hud, /foe\.append\(foeName, foeTrack, foeBlade, foePoise\);/);
  assert.match(hud, /const p = t\.poise;/);
  assert.match(hud, /parts\.foe\.classList\.toggle\('poised', !!p\)/);
  assert.match(hud, /width\(parts\.foePoiseFill, 'foePoiseFill', p\.fill \* 100\);/);
  assert.match(hud, /put\(parts\.foePoiseWord, 'foePoiseWord', p\.word\);/);
  const css = rd('src/ui/enhancedStyle.js');
  assert.match(css, /\.hud-foe\.poised \.hud-foepoise \{ display: block; \}/);
  assert.match(css, /\.hud-foepoise\.windup \.hud-poisefill \{ background: #e0a43a; \}/);
  assert.match(css, /\.hud-foepoise\.iron \.hud-poisefill \{ background: repeating-linear-gradient\(/, 'iron never by colour alone');
  // PIN MOVED (AUDIT TELL U3/U4): the flash on THIS foe's break alone; the word under the track, which the card clears
  assert.match(css, /\.hud-foepoise\.staggered \.hud-poisefill \{ background: #fff; \}\n\.hud-foepoise\.staggered\.flash \.hud-poisefill \{ animation: hud-poise-flash/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.hud-foepoise\.staggered\.flash \.hud-poisefill \{ animation: none; \} \}/);
  assert.match(css, /body:has\(\.hud-foe\.on\.poised\) \.qtrack \{ --qt-clear: calc\(18px \+ 28px \* var\(--hud-scale, 1\) \+ 30px \+ 74px \* var\(--hud-scale, 1\)\); \}/);
  assert.match(css, /\.hitnum-word \{/);
  assert.match(css, /\.hitnum-perfect \{/);
  assert.match(rd('src/scenes/hostCombat.js'), /setFoePoiseReader\(\(f\) => poiseTrack\(f\?\.ai\)\);/, 'the host registers the brain\'s reading (the HUD imports no brain)');
});
