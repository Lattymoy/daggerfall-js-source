// REVENANT-COMPANION + COMPANION-SLOTS + COMPANION-ROSTER + COMPANION-PORTAL + DISSOLVE (2026-10-02, Mac: "Spare should
// allow you to free the enemy, which then adds them as a companion, which you could keep send them away or keep them
// with you. Reuse the crew companion system. Companion slots should still be limited and will need a new enhanced plus
// UI feature"; "Companions when playing catch up, spawning in, or spawning out should use a unique portal animation
// instead of just popping in and out").
//
// The sworn party in the crew's shape; the slots one law for the crew and the sworn; the crew's own layer standing the
// sworn through portals - in, out (the body taken out only once the portal has it) and a catch-up's pair; the portal's
// art and life; the dissolve on the sprite in both billboard shaders; the roster page; the held pose.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
const N = await import('../src/systems/revenant.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const F = await import('../src/systems/revenantFate.js');
const D = await import('../src/systems/dissolve.js');
const P = await import('../src/scenes/portalFx.js');
const { createCrewAshore, CATCH_UP_M } = await import('../src/scenes/crewAshore.js');
const { createCompanions, COMPANION_WHY } = await import('../src/systems/naval/crewCompanions.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { drawCompanionsPage, _resetCompanionRosterForTests, _setCompanionRosterIconForTests, companionPageShown } = await import('../src/ui/companionRoster.js');
const { MobileUnit, HURT_ANIMS } = await import('../src/characters/mobileUnit.js');
const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = { isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-sworn', level: 8, health: 100, maxHealth: 100 };
function fresh() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  RC.setRetinuePlayer(me);
}
function sworn(state = 'with', { rank = 2, mobileType = MOBILE_TYPES.Orc } = {}) {
  const r = N.revenantDeed(me, { mobileType, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Orcs' }, 'fled', { mobileType, rolls: () => 0 });
  r.rank = rank;
  return N.revenantSpared(me, { revenant: { id: r.id } }, { state });
}

// ── the party and the slots ────────────────────────────────────────────────────────────────────────────────────
test('REVENANT-COMPANION the party in the crew\'s shape: the sworn at the player\'s side, one member object each (its key rv:, its title its name), knocked out to rest REVENANT_REST_MIN then fit again and away, its health carried; send away, call (refused while the slots are full or it is still hurt, and saying why), release (mutants: a fresh member each read; a knock without the rest; the wake never comes; a call past the slots)', () => {
  fresh();
  const a = sworn('with'), b = sworn('with');
  const party = RC.revenantParty();
  assert.deepEqual(party.party.map((m) => m.name), [a.id, b.id]);
  assert.equal(party.party[0], party.party[0], 'one member object (the layer keys its spells and its slot on it)');
  assert.equal(party.party[0].key, `rv:${a.id}`); assert.equal(party.party[0].title, a.name); assert.equal(party.party[0].mobile, MOBILE_TYPES.Orc);
  assert.equal(party.isAshore('rv', a.id), true);
  party.hurt('rv', a.id, 30, 90);
  assert.deepEqual([N.revenantById(a.id).companion.health, N.revenantById(a.id).companion.maxHealth], [30, 90], 'its health carried');
  assert.equal(party.knock('rv', a.id, 100), true);
  assert.equal(N.revenantById(a.id).companion.state, 'resting'); assert.equal(N.revenantById(a.id).companion.until, 100 + RC.REVENANT_REST_MIN);
  assert.equal(RC.callRefusal(N.revenantById(a.id), 200), 'Still recovering.');
  party.wake(100 + RC.REVENANT_REST_MIN);
  assert.equal(N.revenantById(a.id).companion.state, 'away', 'fit again: waiting for its call');
  assert.equal(RC.callRevenant(a.id, 1e6), null, 'called');
  assert.equal(N.revenantById(a.id).companion.state, 'with');
  const c = sworn('away');
  assert.equal(S.companionsWithYou(), 2);
  S.registerCompanionCount('crew', () => 1);
  assert.equal(RC.callRefusal(c, 0), 'Your companions are full (3).', 'the crew counts');
  assert.match(RC.callRevenant(c.id, 0), /full/);
  S.registerCompanionCount('crew', null);
  assert.equal(RC.sendRevenantAway(a.id), true);
  assert.equal(N.revenantById(a.id).companion.state, 'away');
  const out = RC.releaseRevenant(a.id);
  assert.equal(out.fate, 'released'); assert.equal(out.sworn, false); assert.equal(out.defeated, true, 'remembered among the fallen');
  assert.ok(!RC.retinue().includes(out));
});

test('COMPANION-SLOTS one law for the crew and the sworn: three at the player\'s side together - a crew hand is refused ashore when the sworn fill them ("no room at your side"); the sworn pick "away" when the crew fill them; the counts read together (mutants: the crew\'s refusal blind to the sworn; the bound four)', () => {
  fresh();
  assert.equal(S.COMPANION_SLOTS, 3);
  sworn('with'); sworn('with'); sworn('with');
  const crew = createCompanions();
  assert.equal(crew.why(7, { name: 'Hilda' }, 0), COMPANION_WHY.slots, 'the sworn hold every slot');
  RC.sendRevenantAway(RC.revenantsWithYou()[0].id);
  assert.equal(crew.why(7, { name: 'Hilda' }, 0), null, 'one sent away: room for her');
  S.registerCompanionCount('crew', () => 2);
  assert.equal(RC.swornPlace(), 'away', 'crew and sworn fill them: a newly spared one waits away');
  S.registerCompanionCount('crew', null);
  assert.equal(RC.swornPlace(), 'with', 'the crew back aboard: room again');
  RC.callRevenant(RC.revenantsAway()[0].id, 0);
  assert.equal(RC.swornPlace(), 'away', 'three sworn at the side: full');
});

test('REVENANT-COMPANION a sworn one\'s strength: its rank\'s health once (a carried whole kept) and its rank\'s blows, called by its own name everywhere (mutants: the health boosted at every door; the name lost)', () => {
  fresh();
  const r = sworn('with', { rank: 3 });
  const e = { maxHealth: 100, health: 100 };
  RC.applySwornStrength(e, r, { fresh: true });
  assert.equal(e.maxHealth, 175); assert.equal(e.health, 175); assert.equal(e.damageScale, 1.3);
  assert.deepEqual(e.revenant, { id: r.id, name: r.name, rank: 3, sworn: true });
  const again = { maxHealth: 175, health: 120 };
  RC.applySwornStrength(again, r, { fresh: false });
  assert.deepEqual([again.maxHealth, again.health], [175, 120], 'a door neither heals nor boosts it again');
});

// ── the layer through portals ──────────────────────────────────────────────────────────────────────────────────
test('COMPANION-PORTAL the crew\'s layer stands the sworn through portals: ARRIVE at its stand; LEAVE (sent away, knocked out) through one - the body taken out only when the portal has it; a catch-up JUMPS through a pair; a change of place lifts at once; a hand with no fx still pops (mutants: the arrival unasked; the body taken out at once; the jump without its pair)', async () => {
  fresh();
  const r = sworn('with');
  const calls = [], removed = [];
  let leaveDone = null;
  const bodies = [];
  const place = {
    key: 'street',
    spawn: async (mobile, feet) => { const rec = { ai: { feet: [...feet], resumeLive() {} }, entity: { maxHealth: 100, health: 100 } }; bodies.push(rec); return rec; },
    remove: (rec) => removed.push(rec), has: (rec) => !removed.includes(rec),
    fx: { arrive: (rec) => calls.push(['arrive', rec]), leave: (rec, done) => { calls.push(['leave', rec]); leaveDone = done; }, jump: (rec, from) => calls.push(['jump', rec, from]) },
  };
  let L = { feet: [0, 0, 0], yaw: 0, grounded: true };
  let where = place;
  const sworn1 = RC.revenantParty();   // one party, as the host keeps one
  const layer = createCrewAshore({ party: () => sworn1, place: () => where, leader: () => L, now: () => 0, onStood: (c, rec) => calls.push(['stood', c.name, rec.entity.name]) });
  layer.frame();
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(calls.map((c) => c[0]), ['arrive', 'stood'], 'through its portal, then stood');
  assert.equal(bodies[0].companion, `rv:${r.id}`); assert.equal(bodies[0].entity.name, r.name, 'its own name');
  // a catch-up: the pair
  L = { feet: [CATCH_UP_M + 10, 0, 0], yaw: 0, grounded: true };
  layer.frame();
  const jump = calls.find((c) => c[0] === 'jump');
  assert.ok(jump, 'jumped');
  assert.deepEqual(jump[2], [0, 0, 1.8].map((v, i) => (i === 2 ? jump[2][2] : v)).map((v, i) => (i === 0 ? 0 : v)), 'from where it stood');
  // sent away: out through its portal, the body kept until the portal has it
  RC.sendRevenantAway(r.id);
  layer.frame();
  assert.equal(calls.at(-1)[0], 'leave');
  assert.deepEqual(removed, [], 'not yet out');
  leaveDone();
  assert.deepEqual(removed, [bodies[0]], 'out once the portal has it');
  // a hand with no fx pops as ever
  RC.callRevenant(r.id, 0);
  delete place.fx;
  layer.frame();
  await new Promise((res) => setTimeout(res, 0));
  RC.sendRevenantAway(r.id);
  layer.frame();
  assert.equal(removed.length, 2, 'no portal: lifted at once');
  // a change of place lifts at once (the place it leaves is going)
  RC.callRevenant(r.id, 0);
  place.fx = { arrive() {}, leave: () => { throw new Error('a portal on a place being left'); }, jump() {} };
  layer.frame();
  await new Promise((res) => setTimeout(res, 0));
  where = { ...place, key: 'dungeon' };
  layer.frame();
  assert.equal(removed.length, 3, 'lifted with the old place');
});

test('COMPANION-PORTAL the portal: its art made here (an oval vortex - clear outside, lit inside, a hot rim), self-lit and blended; it tears open, holds, seals and is freed; a short one for a catch-up\'s far end; it stands a step behind the body from the eye (mutants: art outside the oval; never freed; the short hold the long; standing in front)', () => {
  const fr = P.portalFrame(0);
  assert.equal(fr.width, P.PORTAL_TEX.w); assert.equal(fr.colors.length, fr.width * fr.height * 4);
  const at = (x, y) => fr.colors[(y * fr.width + x) * 4 + 3];
  assert.deepEqual([...fr.colors.slice(0, 4)], [0, 0, 0, 0], 'a corner is clear - nothing drawn there');
  assert.ok(at(fr.width >> 1, fr.height >> 1) > 100, 'its heart is drawn');
  const rimY = fr.height >> 1, rimX = Math.round(fr.width * 0.94);
  assert.ok(fr.colors[(rimY * fr.width + rimX) * 4] > 150, 'a hot rim');
  assert.notDeepEqual(P.portalFrame(0).colors, P.portalFrame(3).colors, 'it turns');
  assert.equal(P.portalOpenAt(0).open, 0);
  assert.ok(P.portalOpenAt(P.PORTAL_MS.open - 1).open > 0.9, 'torn open');
  assert.equal(P.portalOpenAt(P.PORTAL_MS.open + 10).open, 1, 'held');
  assert.equal(P.portalOpenAt(P.portalLife()).done, true, 'sealed');
  assert.ok(P.portalLife({ short: true }) < P.portalLife(), 'a short one');
  const uploads = [], made = [], freed = [];
  let now = 0;
  const renderer = {
    uploadTexture: (a, r) => uploads.push(['tex', a, r]), uploadEmissionTexture: (a, r, c, o) => uploads.push(['em', a, r, !!o?.white]),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; made.push(b); return b; },
    destroyBillboardBatch: (b) => freed.push(b),
  };
  const set = P.createPortalSet({ renderer, now: () => now });
  const p = set.open([10, 0, 10]);
  assert.equal(uploads.filter((u) => u[0] === 'tex').length, P.PORTAL_FRAMES, 'its frames uploaded once');
  assert.ok(uploads.filter((u) => u[0] === 'em').every((u) => u[3]), 'self-lit');
  set.open([0, 0, 0], { short: true });
  assert.equal(uploads.filter((u) => u[0] === 'tex').length, P.PORTAL_FRAMES, '...once a renderer');
  assert.equal(p.batch.conceal.mode, 3, 'blended');
  now = 60; set.tick([10, 1.6, 0]);
  assert.ok(p.batch.conceal.alpha > 0 && p.batch.size.w < P.PORTAL_SIZE.w, 'tearing open');
  assert.ok(p.origin[2] > 10, 'a step behind the body from the eye');
  now = P.portalLife({ short: true }) + 1; set.tick();
  assert.equal(set.count, 1, 'the short one sealed first');
  now = P.portalLife() + 1; set.tick();
  assert.equal(set.count, 0); assert.equal(freed.length, 2, 'freed');
});

test('DISSOLVE the sprite burnt away or gathered: the batch\'s field (written on change, null whole); the execution in ember after its burst, the oath and a portal in arcane light - arriving whole again, leaving gone; both billboard shaders cut the grains and blaze the edge, the draw uploads it (mutants: the lane without it; the edge never lit; arriving backwards)', () => {
  const b = {};
  D.setBatchDissolve(b, 0.5, D.DISSOLVE_EMBER);
  assert.deepEqual(b.dissolve.slice(0, 4), [0.5, ...D.DISSOLVE_EMBER]);
  assert.ok(!b.noShadow, 'half whole: its shadow stands');
  const same = b.dissolve; D.setBatchDissolve(b, 0.8, D.DISSOLVE_EMBER); assert.equal(b.dissolve, same, 'one array, written in place');
  assert.equal(b.dissolve[0], 0.8);
  assert.equal(b.noShadow, true, 'AUDIT (2026-10-02): more gone than whole, it casts no shadow');
  D.setBatchDissolve(b, 0); assert.equal(b.dissolve, null, 'whole');
  assert.ok(!b.noShadow, 'and its shadow back');
  const lit = { noShadow: true }; D.setBatchDissolve(lit, 0.9); D.setBatchDissolve(lit, 0);
  assert.equal(lit.noShadow, true, 'a batch that never cast one keeps its word');
  const now = 100000;
  assert.equal(F.fateDissolve({ executing: { at: now } }, now), null, 'whole before the burst');
  assert.deepEqual(F.fateDissolve({ executing: { at: now - F.EXECUTION_MS.end } }, now), [1, ...D.DISSOLVE_EMBER], 'gone at its end, in ember');
  const arriving = F.fateDissolve({ portalFx: { dir: 'in', at: now - 100, delay: 0, ms: 400 } }, now);
  assert.ok(arriving[0] > 0.5 && arriving[0] < 1 && arriving[1] === D.DISSOLVE_ARCANE[0], 'gathering out of the light');
  assert.equal(F.fateDissolve({ portalFx: { dir: 'in', at: now - 500, delay: 0, ms: 400 } }, now), null, 'through: whole');
  assert.equal(F.fateDissolve({ portalFx: { dir: 'out', at: now - 500, delay: 0, ms: 400 } }, now)[0], 1, 'leaving: gone');
  const rd = read('src/render/renderer.js'), el = read('src/render/enhancedLighting.js');
  for (const [name, src, fs] of [['classic', rd, 'const BB_FS = `'], ['lane', el, 'export const EL_BB_FS = `']]) {
    const sh = src.slice(src.indexOf(fs), src.indexOf('}`;', src.indexOf(fs)));
    assert.match(sh, /\$\{FLAT_DISSOLVE_GLSL\}/, `${name}: the helper`);
    assert.match(sh, /if \(dissolveGone\(uv\)\) discard;/, `${name}: the grains cut`);
    // AUDIT (2026-10-02): the lane's edge decoded into its linear light - a display colour mixed there came out washed
    assert.match(sh, name === 'lane' ? /lit = dissolveLit\(lit, uv, elDecode\(uDissolve\.yzw\)\);/ : /lit = dissolveLit\(lit, uv, uDissolve\.yzw\);/, `${name}: the edge blazes`);
  }
  for (const [name, src] of [['classic', read('src/render/renderer.js')], ['lane', read('src/render/enhancedLighting.js')]]) assert.match(src, /uniform vec4 uDissolve;/, `${name}: the program declares it (AUDIT 47)`);
  assert.doesNotMatch(D.FLAT_DISSOLVE_GLSL, /uniform /, 'the block declares none');
  assert.match(rd, /this\.bbUDissolve = gl\.getUniformLocation\(this\.bbProgram, 'uDissolve'\);/);
  assert.match(rd, /if \(dv \|\| this\._bbDissolveOn\) \{ gl\.uniform4f\(this\.bbUDissolve, dv \? dv\[0\] : 0, dv \? dv\[1\] : 0, dv \? dv\[2\] : 0, dv \? dv\[3\] : 0\); this\._bbDissolveOn = !!dv; \}/);
  // AUDIT (2026-10-02): the reset SENDS the zero - a shadow set false over a uniform still holding the last burning
  // flat's share left every flat after it burnt away (the frame's last batch the dissolving one: a dungeon's lone foe)
  assert.match(rd, /this\._bbTipOn = false;\n\s*gl\.uniform4f\(this\.bbUDissolve, 0, 0, 0, 0\);[^\n]*\n\s*this\._bbDissolveOn = false;/, 'reset with the frame, the zero sent');
  for (const src of [rd, read('src/render/enhancedLighting.js')]) assert.match(src, /if \(uEliteGlow != 0\.0 && uConceal\.x == 0\.0 && uDissolve\.x <= 0\.0\) \{/, 'no elite rim round a body dissolving');
});

test('REVENANT-FATE the held pose: its hurt\'s last frame (or the one before, a breath), facing the camera as the clock\'s would, the unit\'s own state untouched (mutants: the state left changed; the first frame held)', () => {
  const basics = ENEMY_BASICS[MOBILE_TYPES.Orc];
  const m = new MobileUnit(MOBILE_TYPES.Orc, basics, () => 5);
  m.state = 'move'; m.frame = 2;
  const p = m.heldPose('hurt', -1, 0, [0, 0, 0], [0, 0, 5]);
  assert.equal(p.frame, 4, 'the last frame');
  assert.ok(HURT_ANIMS.some((a) => a.record === p.record), 'a hurt record');
  assert.equal(m.heldPose('hurt', -2, 0, [0, 0, 0], [0, 0, 5]).frame, 3, 'a breath');
  assert.equal(m.state, 'move'); assert.equal(m.frame, 2, 'its own clock untouched');
  const kneel = F.kneelPose({ mobile: m, ai: { yaw: 0, feet: [0, 0, 0] }, yielded: { at: 0 } }, [0, 0, 5], 1000);
  assert.equal(kneel.frame, 4, 'kneeling');
});

// ── the roster page ────────────────────────────────────────────────────────────────────────────────────────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '', isConnected: true,
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const byClass = (root, cls) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.classList?.contains(cls)) out.push(c); walk(c); } }; walk(root); return out; };
const buttons = (root, label) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent === label) out.push(c); walk(c); } }; walk(root); return out; };

test('COMPANION-ROSTER the page: the slots a strip of wells (who stands in each, a crew hand by name, the open ones open), At your side with health and Send away, Away with Call (refused and saying why) and its rest, Release asked twice; the retinue\'s bound at the foot (mutants: the strip blind to the crew; Release at one press; the refusal unsaid)', () => {
  fresh();
  _resetCompanionRosterForTests();
  _setCompanionRosterIconForTests(() => ({ src: 'data:x', w: 30, h: 40 }));
  globalThis.document = undefined;
  const a = sworn('with'), b = sworn('away');
  S.registerCompanionRoster('crew', () => [{ name: 'Hilda', role: 'Bosun' }]);
  S.registerCompanionCount('crew', () => 1);
  assert.equal(companionPageShown(), true);
  const draw = () => { const d = el('div', 'px-qdetail'); drawCompanionsPage(d, () => {}, { el, divider: (t) => el('h4', 'px-divider', t), meter: (n, m) => el('div', 'px-meter', `${n}/${m}`), here: () => ({ health: 40, maxHealth: 80 }), kindName: () => 'Orc' }); return d; };
  let d = draw();
  const slots = byClass(d, 'cmp-slot');
  assert.equal(slots.length, 3, 'three wells');
  assert.equal(slots[0].title, a.name, 'the sworn at the side first');
  assert.equal(slots[1].title, 'Hilda (Bosun)', 'a crew hand by name');
  assert.ok(slots[2].classList.contains('is-open'), 'an open one');
  assert.match(d.textContent, /Companions \(2 of 3 at your side\)/);
  assert.match(d.textContent, /40\/80/, 'its live health');
  assert.equal(buttons(d, 'Send away').length, 1); assert.equal(buttons(d, 'Call').length, 1);
  // Call refused: the slots
  S.registerCompanionCount('crew', () => 2);
  buttons(d, 'Call')[0].onclick();
  d = draw();
  assert.match(d.textContent, /Your companions are full \(3\)\./, 'the refusal said under its row');
  assert.equal(N.revenantById(b.id).companion.state, 'away');
  S.registerCompanionCount('crew', () => 1);
  // Release asks
  buttons(d, 'Release')[0].onclick();
  d = draw();
  assert.match(d.textContent, new RegExp(`Release ${a.name.replace(/[.*+?^${}()|[\]\\']/g, '\\$&')}\\? Its oath is given back`));
  assert.ok(N.revenantById(a.id).sworn, 'not at one press');
  buttons(d, 'Release')[0].onclick();
  assert.equal(N.revenantById(a.id).fate, 'released');
  d = draw();
  assert.match(d.textContent, /Sworn to you: 1 of 6/);
  S.registerCompanionRoster('crew', null); S.registerCompanionCount('crew', null);
  _setCompanionRosterIconForTests(null);
});

test('REVENANT-COMPANION the world\'s wiring: the sworn stood by the crew\'s own layer (never the naval arc\'s gate), its strength on its stand, the places\' portals handed to it, its pack and its card beside the crew\'s, the roster\'s acts heard; the street, a building and a dungeon each draw their portals with their foes (mutants: the sworn under the naval gate; a place without its fx; the cards without them)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const revenantAshore = createCrewAshore\(\{\n\s*party: \(\) => \(playerSpawned \? _revenantParty : null\),\n\s*place: \(\) => companionPlace\(\{ crew: false \}\),/);
  assert.match(w, /function companionPlace\(\{ crew = true \} = \{\}\) \{[^\n]*\n\s*if \(\(crew && !navalOn\(\)\) \|\|/);
  assert.match(w, /applySwornStrength\(rec\.entity, r, \{ fresh: !\(c\.maxHealth > 0\) \}\);/);
  assert.match(w, /spot: spotOf\(collider\), fx: exteriorFoes\.companionFx, turn: turnIn\(exteriorFoes\) \};/);   // PIN MOVED (RVN11c: and a betrayer's turning, hostile where it stood)
  assert.match(w, /spot: spotOf\(modes\?\.interiorCollider\), fx: pool\.companionFx, turn: turnIn\(pool\) \} : null;/);   // PIN MOVED (RVN11c)
  assert.match(w, /spot: spotOf\(d\.collider\), fx: d\.companionFx \?\? null,/);
  assert.match(w, /if \(isRevenantCompanionKey\(key\)\) return openSwornPack\(rec\);/);
  assert.match(w, /const sworn = swornCards\?\.\(\) \?\? \[\];/);
  assert.match(w, /registerCompanionCount\('crew', /);
  assert.match(w, /setRetinueListener\(\(kind, r, extra\) => \{/);
  assert.match(w, /crewAshoreTick\(\);   \/\/ CREW-COMPANIONS: the party stood on the street\n\s*revenantAshoreTick\(\);/);
  const x = read('src/scenes/exteriorFoes.js'), d = read('src/scenes/dungeonContext.js');
  assert.match(x, /return \[\.\.\.out, \.\.\.corpseBatches\.map\(\(c\) => c\.batch\), \.\.\.portals\.batches\(\)\];/);
  assert.match(d, /const _dropBatches = \[\.\.\.droppedLoot\.batches\(\), \.\.\.portals\.batches\(\)\];/);
});
