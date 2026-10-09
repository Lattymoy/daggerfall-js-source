// DESYNC-ZERO (2026-10-09, the owner: "ive seen enemies desyncing for players in a party sometimes they only strike the
// air and on their ends are monsters" / "monster desyncs should never happen in dungeons and outside" / "when a party
// member kills the quest monsters it also counts for the quest owner or everyone who also has this quest" - "in the
// SAME party"). Four ways one player's foes were not another's, and the lag between them:
//   1. a reader stood at most twelve of an owner's encounter foes outdoors and four loose stands in a room - a Greater
//      Giant's call of ten went mostly unseen (ENCOUNTER_PUPPETS_MAX, dungeonContext.js LOOSE_PUPPETS_MAX - reader-side,
//      the relay and wire.js untouched);
//   2. a private quest's foe was never streamed, and a shared quest's stood for its party alone - a stranger beside
//      them saw the party fight the air (questPrivateTag, the `pv` bit, accepts/peerMayHit for everyone); the KILL
//      counts for the owner and every member of the owner's party holding the same quest (partyQuestFoe, the qk pose);
//   3. a dungeon host whose layout ran longer or shorter than a joiner's: the host's foes past the joiner's run were
//      dropped and the joiner's past the host's stood for the joiner alone (`lc`, surplus puppets, a notice);
//   4. a puppet stood a frame and an ease behind its owner's foe (scenes/puppetLead.js).
// Mounted, not matched: the world host's seam lifted out of world.js over the real quest machine, the dungeon's doors
// sliced out of its source, the pure doors imported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { CELL_PUPPETS_MAX, CELL_LOOSE_PUPPETS, CELL_FRAME_RECORDS_MAX } from '../src/net/wire.js';
import { validQuestTags, ENCOUNTER_PUPPETS_MAX, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { questShareTag, questPrivateTag, partyQuestFoe, sharedQuestFoe, questBehaviourFor, adoptsOrphanQuestFoe, KeptKillLedger } from '../src/scenes/questFoeHost.js';
import { puppetLead, LEAD_MAX_S, LEAD_DIST_MAX } from '../src/scenes/puppetLead.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const D = src('src/scenes/dungeonContext.js');
const W = src('src/scenes/world.js');

// ---- the quest machine over a one-Foe script ----
{
  const dir = join(ROOT, 'vendor', 'dfu-quests', 'Tables'), sources = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(dir, f), 'utf8').replace(/^\uFEFF/, '');
  loadQuestTables(sources);
}
const CORPUS = {
  __DZ: ['Quest: __DZ', 'QRC:', 'Message:  1030', ' The tiger is dead.', '', 'QBN:', 'Foe _tiger_ is Sabretooth_tiger', '',
    '_S.03_ task:', ' killed 1 _tiger_', ' say 1030', '', 'variable _pad_'],
};
function machine() {
  const m = new QuestMachine({ nowSeconds: () => 0, showPopup: () => {}, world: null, lastNPCClicked: () => null, getQuestSourceLines: (n) => CORPUS[n] ?? null });
  return m;
}
function holder() {
  const m = machine();
  const q = m.scheduleQuest(CORPUS.__DZ, 0, { rolls: () => 0 });
  m.tick();
  const tiger = [...q.resources.values()].find((r) => r.isFoe);
  return { m, q, tiger };
}
const questFoeOf = ({ q, tiger }) => ({ questBehaviour: { questUID: q.uid, targetSymbol: tiger.symbol }, entity: { team: 'Enemy' } });

// ---- world.js's questShareSeam, lifted ----
function lift(text, marker) {
  const at = text.indexOf(marker);
  assert.ok(at >= 0 && marker.endsWith('{'), `world.js carries ${marker}`);
  let i = at + marker.length - 1, depth = 0, q = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return text.slice(at, i + 1) + ';';
}
const makeSeam = new Function('d', `const { questShareTag, questPrivateTag, partyQuestFoe, sharedQuestFoe, questBehaviourFor, adoptsOrphanQuestFoe, questBridge, social, keptKills, online, player, peersNear } = d;\n${lift(W, '  const questShareSeam = {')}\nreturn questShareSeam;`);
const PARTY = new Set(['amy-0003', 'cat-0004']);
const seamFor = (self, m, keptKills = new KeptKillLedger()) => makeSeam({
  questShareTag, questPrivateTag, partyQuestFoe, sharedQuestFoe, questBehaviourFor, adoptsOrphanQuestFoe, keptKills,
  questBridge: { machine: m },
  social: { party: {}, isPartyPeer: (id) => PARTY.has(self) && PARTY.has(id) && id !== self, accountOfPeer: (id) => `acct-${id}` },
  online: { id: self }, player: { feetAt: () => [0, 0, 0] }, peersNear: () => [],
});

test('DESYNC-ZERO: a private quest\'s foe rides tagged `pv` - its quest and its Foe - and an ended quest\'s, or a world quest\'s, does not', () => {
  const h = holder();
  assert.deepEqual(questPrivateTag(h.m, questFoeOf(h)), { q: '__DZ', s: h.tiger.symbol.name, pv: 1 });
  assert.equal(questShareTag(h.m, questFoeOf(h), true), null, 'not a shared quest: the party\'s tag names none');
  assert.equal(questPrivateTag(h.m, { entity: {} }), null, 'no quest, no tag');
  assert.equal(questPrivateTag(null, questFoeOf(h)), null);
  h.q.questTombstoned = true;
  assert.equal(questPrivateTag(h.m, questFoeOf(h)), null, 'an ended quest\'s foe is nobody\'s quest any more');
  // the world host's seam: the shared tag first, the private one after
  const g = holder();
  const seam = seamFor('amy-0003', g.m);
  assert.deepEqual(seam.tagOf(questFoeOf(g)), { q: '__DZ', s: g.tiger.symbol.name, pv: 1 });
  assert.equal(seam.accepts('bob-0009', { q: '__DZ', s: 'tiger' }), true, 'everyone stands every quest foe it is sent');
});

test('DESYNC-ZERO: the frame\'s flag law - 4 is the private bit (never a marker), 1 the marker\'s, 2 touched; past 7 a malformed word', () => {
  const m = validQuestTags([[1, 'Q1', 'imp', 1], [2, 'Q1', 'imp', 4], [3, 'Q1', 'imp', 5], [4, 'Q1', 'imp', 6], [5, 'Q1', 'imp', 8], [6, 'Q1', 'imp']]);
  assert.deepEqual(m.get(1), { q: 'Q1', s: 'imp', mk: 1 });
  assert.deepEqual(m.get(2), { q: 'Q1', s: 'imp', pv: 1 });
  assert.deepEqual(m.get(3), { q: 'Q1', s: 'imp', pv: 1 }, 'a private quest\'s foe stands down nobody\'s marker copy');
  assert.deepEqual(m.get(4), { q: 'Q1', s: 'imp', tc: 1, pv: 1 });
  assert.equal(m.has(5), false);
  assert.deepEqual(m.get(6), { q: 'Q1', s: 'imp' });
});

test('DESYNC-ZERO: the kill counts for the owner and every member of the owner\'s party holding the same quest - linked or taken on their own - and for nobody off a stranger\'s foe; anyone\'s blow lands', () => {
  const owner = holder();
  const tag = { q: '__DZ', s: owner.tiger.symbol.name };
  const solo = holder();   // cat took __DZ on its own: never linked
  assert.equal(sharedQuestFoe(solo.m, tag), null, 'no link (DISC28-J\'s law found nothing to count on)');
  assert.equal(partyQuestFoe(solo.m, tag), solo.tiger, 'its own copy\'s Foe, by name and symbol');
  assert.equal(partyQuestFoe(machine(), tag), null, 'a machine with no such quest counts nothing');
  const seam = seamFor('cat-0004', solo.m);
  seam.onPuppetDied(tag, 'bob-0009', 3);   // a stranger's foe of the same quest fell
  assert.equal(solo.tiger.killCount, 0, 'a stranger\'s quest foe counts for nobody here');
  seam.onPuppetDied(tag, 'amy-0003', 3);   // the party member's
  assert.equal(solo.tiger.killCount, 1, 'the party member\'s counts on my own copy');
  seam.onPuppetDied(tag, 'amy-0003', 3);
  assert.equal(solo.tiger.killCount, 1, 'once - the pose that says it too finds it counted');
  seam.onPuppetHurt(tag, 'bob-0009');
  assert.notEqual(solo.tiger.injuredTrigger, true, 'a stranger\'s blow seen injures nothing of mine');
  seam.onPuppetHurt(tag, 'amy-0003');
  assert.equal(solo.tiger.injuredTrigger, true, 'a party member\'s does');
  assert.equal(seam.peerMayHit('bob-0009', { entity: { team: 'Enemy' } }), true, 'a stranger\'s blow on my quest foe lands');
  assert.equal(seam.peerMayHit('amy-0003', { entity: { team: 'PlayerAlly' } }), false, 'a quest\'s own ally takes no peer\'s blow');
  // my own quest foe's fall is said to the party (KEPT-KILL's pose), and the world host reads it for a party member alone
  assert.match(W, /if \(p\?\.qk && social\.inMyParty\(acct\)\) creditKeptKills\(questBridge\?\.machine, keptKills, acct, p\.qk, Date\.now\(\)\);/);
  assert.match(src('src/scenes/questFoeHost.js'), /export function creditKeptKills[\s\S]{0,800}?partyQuestFoe\(machine, /, 'the pose credits through the same door');
});

test('DESYNC-ZERO: a reader stands a whole call - the encounter\'s allowance outdoors and the room\'s loose allowance hold a Greater Giant\'s ten beside its encounter; the relay\'s law is untouched', () => {
  assert.ok(ENCOUNTER_PUPPETS_MAX >= MAX_ACTIVE_ENCOUNTER_FOES + 10, 'an encounter and a call of ten');
  assert.ok(ENCOUNTER_PUPPETS_MAX <= CELL_FRAME_RECORDS_MAX, 'and one frame carries it');
  assert.equal(CELL_PUPPETS_MAX, 12, 'wire.js as the relay runs it (RELAY_VERSION unbumped)');
  assert.equal(CELL_LOOSE_PUPPETS, 4);
  const m = /const LOOSE_PUPPETS_MAX = Math\.max\((\d+), CELL_LOOSE_PUPPETS\);/.exec(D);
  assert.ok(m && Number(m[1]) >= 10, 'the room\'s loose allowance holds a call of ten');
  assert.match(D, /ownPuppetsOf\(from, lo\) >= \(lo \? LOOSE_PUPPETS_MAX : QUEST_PUPPETS_MAX\)/);
  assert.match(src('src/scenes/exteriorFoes.js'), /: livePuppetsOf\(from\) >= ENCOUNTER_PUPPETS_MAX\)\) continue;/);
});

test('DESYNC-ZERO: a puppet leads its last word along its way while the word ages - bounded in time and distance, flat, never for a jump or a foe that stands', () => {
  const p = { moving: true };
  const t0 = [0, 1, 0];
  assert.equal(puppetLead(p, t0, 10), t0, 'one word: nothing to lead by');
  const t1 = [1, 1, 0];
  assert.deepEqual([...puppetLead(p, t1, 10.2)], t1, 'a fresh word stands where it says');
  assert.deepEqual([...puppetLead(p, t1, 10.3)].map((v) => Math.round(v * 1000) / 1000), [1.5, 1, 0], '5 m/s, a tenth of a second on');
  const far = puppetLead(p, t1, 12);
  assert.ok(Math.hypot(far[0] - 1, far[2]) <= Math.min(5 * LEAD_MAX_S, LEAD_DIST_MAX) + 1e-9, 'never past LEAD_MAX_S or LEAD_DIST_MAX of it');
  assert.equal(far[1], 1, 'the height is the word\'s');
  const slow = { moving: true };   // 1 m/s: the time bound binds before the distance's
  puppetLead(slow, [0, 0, 0], 0); puppetLead(slow, [0.2, 0, 0], 0.2);
  assert.equal(Math.round(puppetLead(slow, [0.2, 0, 0], 5)[0] * 1000) / 1000, Math.round((0.2 + LEAD_MAX_S) * 1000) / 1000, 'a word is carried LEAD_MAX_S at most');
  p.moving = false;
  assert.equal(puppetLead(p, t1, 10.3), t1, 'its owner says it stands: no lead');
  const j = { moving: true };
  puppetLead(j, [0, 0, 0], 0); puppetLead(j, [30, 0, 0], 0.2);
  assert.deepEqual(puppetLead(j, [30, 0, 0], 0.3), [30, 0, 0], 'a jump (a snap, a floating-origin shift) leads nothing');
  assert.equal(puppetLead(null, t1, 1), t1);
  assert.match(D, /const feet = f\.ai\.feet, t = puppetLead\(p, p\.feet, performance\.now\(\) \/ 1000\);/, 'the dungeon\'s step walks toward the lead');
  assert.match(src('src/scenes/exteriorFoes.js'), /t = p\.wire \? puppetLead\(p, _net\.toScene\(p\.wire\), performance\.now\(\) \/ 1000\) : null;/, 'and the open air\'s');
});

// ---- the dungeon's layout-count doors, sliced out of the source ----
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });
function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const fnSrc = (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, `src has function ${name}`); return D.slice(n.start, n.end); };
const declSrc = (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `src declares ${name}`); return D.slice(n.start, n.end); };
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const tick = async () => { for (let k = 0; k < 4; k++) await new Promise((r) => setTimeout(r, 0)); };

function room(layout = 5) {
  const mk = (i) => ({ i, mobileType: 5, dead: false, batch: { b: i }, ai: { feet: [i, 0, 0] }, entity: { health: 30 } });
  const foes = Array.from({ length: layout }, (_, i) => mk(i));
  const said = [], destroyed = [], built = [];
  const state = {
    foes, _layoutFoes: layout, _authority: false, _ctxDead: false, CELL_FRAME_RECORDS_MAX, GENDER_BIT: ['male', 'female'],
    renderer: { destroyBillboardBatch: (b) => destroyed.push(b) }, freeCorpse() {}, dropCandidate() {},
    hudText: { add: (t) => said.push(t) }, LAYOUT_MISMATCH_TEXT: 'MISMATCH',
    validFoeRecord: (r) => (r && Number.isInteger(r.i) ? r : null), canStandFoe: () => true,
    applyFoeRecord: (f, r) => { if (r.h != null) f.entity.health = r.h; if (r.d === 1) f.dead = true; },
    buildFoeAt: async (e, _w, o) => { const f = { mobileType: e.mobileType, dead: false, batch: { b: 'pup' }, ai: { feet: [e.x, e.y, e.z] }, entity: { health: 1 }, puppet: o?.puppet }; foes.push(f); built.push(f); return f; },
    console: { warn() {}, error: (...a) => assert.fail(a.join(' ')) },
  };
  const api = mount(`
    ${['FOE_SEQ_MAX_SURPLUS', '_surplus', '_surplusPending', '_hiddenFrom', '_layoutMismatchSaid'].map(declSrc).join('\n')}
    ${['sayLayoutMismatch', 'hideBeyondHostLayout', 'surplusRecord', 'dropSurplus', 'clearSurplus'].map(fnSrc).join('\n')}
    return { hideBeyondHostLayout, surplusRecord, clearSurplus, surplus: () => _surplus };
  `, state);
  return { ...api, state, foes, said, destroyed, built };
}

test('DESYNC-ZERO: a dungeon host whose layout runs SHORTER - my foes past its count are not the room\'s: hidden here, said once', () => {
  const r = room(5);
  r.hideBeyondHostLayout(3);
  assert.deepEqual(r.foes.map((f) => f.dead), [false, false, false, true, true], 'the two past the host\'s count go');
  assert.ok(r.foes.slice(3).every((f) => f._absentHere && f._gone && f.batch === null), 'unseen, unstruck, unbodied');
  assert.deepEqual(r.said, ['MISMATCH'], 'the player is told');
  r.hideBeyondHostLayout(3); r.hideBeyondHostLayout(4);
  assert.deepEqual(r.said, ['MISMATCH'], 'once a dungeon - and a longer count later stands nothing back up');
  const same = room(5);
  same.hideBeyondHostLayout(5); same.hideBeyondHostLayout(9);
  assert.deepEqual(same.said, [], 'a host as long or longer hides nothing here');
});

test('DESYNC-ZERO: a dungeon host whose layout runs LONGER - its foes past my run stand as puppets of the room by its number, and go with the seat', async () => {
  const r = room(3);
  r.surplusRecord(5, { i: 5, t: 7, f: [5, 0, 5], h: 20, d: 0 });
  r.surplusRecord(5, { i: 5, t: 7, f: [5, 0, 5], h: 12, d: 0 });   // a newer word while it builds
  await tick();
  assert.equal(r.built.length, 1, 'one puppet, not one a record');
  const pup = r.surplus().get(5);
  assert.equal(pup._surI, 5, 'struck by the host\'s number');
  assert.equal(pup.entity.health, 12, 'the newest word landed on it');
  assert.equal(pup.puppet, true);
  assert.deepEqual(r.said, ['MISMATCH']);
  r.surplusRecord(8, { i: 8, t: 7, f: [8, 0, 8], h: 9, d: 0 });
  await tick();
  assert.equal(r.built.length, 2);
  assert.deepEqual(r.said, ['MISMATCH'], 'said once a dungeon, however many foes it is');
  r.surplusRecord(6, { i: 6, t: 7, d: 1, f: [0, 0, 0] });
  r.surplusRecord(7, null);
  await tick();
  assert.equal(r.built.length, 2, 'a body I never saw standing, or junk, stands nothing');
  r.clearSurplus();
  assert.ok(pup.dead && pup._gone, 'a new host, or the seat mine: the old host\'s layout goes');
  assert.equal(r.foes.includes(pup), false, 'out of the roll');
  // the doors are wired: the full frame says its count, the frame in reads it, the blow names the host's number
  assert.match(D, /if \(full\) frame\.lc = _layoutFoes;/);
  assert.match(D, /if \(!f \|\| i >= _layoutFoes\) \{ surplusRecord\(i, r\); continue; \}/);
  assert.match(D, /\{ i: foe\._surI \?\? pi \}\), dmg: damage, kind,/);
  assert.match(D, /const isRoomFoe = \(f, i = foes\.indexOf\(f\)\) => \(i >= 0 && i < _layoutFoes\) \|\| \(f != null && \(f\._encId != null \|\| f\._surI != null\)\);/);
});
