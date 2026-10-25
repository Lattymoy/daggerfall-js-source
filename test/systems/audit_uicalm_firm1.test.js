// AUDIT UICALM-FIRM1 (2026-10-14, the owner: "Lets do an audit on everything") - every FIXED finding of the audit of
// UI-CALM and FIRM1 (bible/01-Overview/audits/Audit-UICalm-Firm1.md), pinned through the producers that mint the shapes in
// play: the real Worker over node:sqlite with every migration applied (test/accountDb.mjs), the real door and book,
// the real law, fold and damage door, the real ship scene.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { scene } from '../csaScene.mjs';
import {
  pathTo, packTree, unpackTree, treeStats, treeParts, blowPct, castCostPct, xpPct, scaleXp, scaleQty, statDef, isPrice, refundTakes, treeFault, starsFor,
  STAT_DEFS, BLOW_CAP, BLOW_TOTAL_CAP, CAST_COST_CAP, REFUND_FREE_BELOW_RENOWN, REFUND_SILVER_PER_STAR, FIRM_RESPEC_GOLD, FIRM_RENOWN_MAX, refundSilver,
} from '../../src/net/firmament/firmamentLaw.js';
import { FIRM_NODES, FIRM_EDGES } from '../../src/net/firmament/firmamentTree.js';
import { createFirmamentBook, FIRM_KEPT_KEY } from '../../src/net/firmament/firmamentBook.js';
import { accountFirmament, SESSION_KEY } from '../../src/net/accountClient.js';
import {
  setFirmamentTree, setFirmamentOnline, setFirmamentMentoring, onFirmamentChange, firmActMult, firmStat, _resetFirmamentLiveForTests,
} from '../../src/systems/firmamentLive.js';
import {
  firmamentLayer, firmamentFold, firmamentEvade, firmamentKill, firmamentRound, firmamentBlow, firmamentAbsorb, firmamentSpellPierce, withoutFirmament,
  _resetFirmamentPowersForTests, _setFirmamentPowersRandForTests,
} from '../../src/systems/firmamentPowers.js';
import { setFirmament, respecFirmament, FIRM_OPS_MAX, FIRM_PACKED_MAX } from '../../server-account/src/firmament.js';
import { setSigilDueling, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { createHerbAct } from '../../src/systems/herbAct.js';
import { renownMpOf } from '../../src/systems/renownLayer.js';
import { drawEnhancedSaddle, hideEnhancedSaddle, toggleSaddlePanel, saddlePanelOpen, saddleNote, SADDLE_PANEL_PREF, SADDLE_HELLO_MS } from '../../src/ui/enhanced/enhancedSaddle.js';
import { getPref, setPref, _resetForTests as _resetPrefsForTests } from '../../src/systems/uiPrefs.js';
import { HUD_LOCK_PREF } from '../../src/ui/hud/hudLayout.js';
import { markFoeStruck } from '../../src/ui/hud/hudFoeTarget.js';
import { fakeDoc, one } from '../decorFakes.mjs';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { SKILLS, skillValue } from '../../src/systems/skills.js';
import { liveStat } from '../../src/systems/statMods.js';
import { playerEntity, hurtPlayer } from '../../src/characters/playerEntity.js';
import { computeEntityMods, weaponBlowMods } from '../../src/systems/entityMods.js';
import { setStruck } from '../../src/systems/sigil/sigilSetPowers.js';
import { setRenownLayer } from '../../src/systems/renownLayer.js';
import { HULL } from '../../src/systems/naval/navalShips.js';
import { haulKey, nodeKey, herbPatches } from '../../src/net/nodeLaw.js';
import { harvestXp, xpForRank } from '../../src/net/professionLaw.js';
import { craftXp } from '../../src/net/recipeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DAY = 86_400;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
const realNow = Date.now;
Date.now = () => NOON * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0, _id = 0;
const rid = () => `audit-${String(++_rid).padStart(6, '0')}`;
const hid = () => (++_id).toString(16).padStart(12, '0');

/** A tree walked from `start` to each of `targets` in turn, by the law's own shortest path. */
function walk(start, ...targets) {
  const tree = { start, keys: [] };
  for (const t of targets) tree.keys.push(...pathTo(tree, t));
  return tree;
}
/** A notable's key, by its name. */
const named = (name) => [...FIRM_NODES.values()].find((n) => n.name === name)?.key ?? assert.fail(`no star ${name}`);

async function stand(env = { FIRMAMENT_OPEN: 'on' }) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...env });
  const raw = s.env.DB._raw;
  const state = (who) => s.call('/v1/firmament/state', { character: who.character }, who.secret);
  const set = (who, tree, id = rid()) => s.call('/v1/firmament/set', { character: who.character, tree: typeof tree === 'string' ? tree : packTree(tree), rid: id }, who.secret);
  const row = (who) => raw.prepare('SELECT tree FROM firmament WHERE player = ? AND char_id = ?').get(who.id, who.character)?.tree ?? null;
  const setXp = (who, profession, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, profession, xp);
  return { ...s, raw, state, set, row, setXp };
}
/** A device over the real Worker: the real door, its session in a Map; `net.drop` loses the next N answers after they
 *  reached the service. */
function device(s, who) {
  const m = new Map();
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  storage.setItem(SESSION_KEY, JSON.stringify({ secret: who.secret, id: who.id }));
  const net = { drop: 0, sets: /** @type {any[]} */ ([]) };
  const fetch = async (url, init) => {
    const u = new URL(url);
    const res = await s.fetch(`https://accounts.invalid${u.pathname}`, { method: init.method, headers: init.headers, body: init.body });
    if (u.pathname === '/v1/firmament/set') net.sets.push(JSON.parse(init.body));
    if (net.drop > 0) { net.drop--; throw new TypeError('network connection lost'); }
    return res;
  };
  return { storage, net, door: accountFirmament({ fetch, storage }) };
}
/** A door of answers alone, for the book's own law. */
function fakeDoor(answers) {
  const asked = [];
  return {
    asked,
    door: {
      account: () => 'acct',
      state: async () => answers.state?.() ?? { ok: true, data: { tree: '', renown: 5, stars: 8, craft: 0 } },
      set: async (c, tree, id) => { asked.push({ tree, id }); return answers.set?.(tree, id) ?? { ok: true, data: { tree } }; },
      respec: async () => answers.respec?.() ?? { ok: true, data: { tree: '' } },
    },
  };
}
function mapStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }

/** The player as the module made it - the combat pins below lay the sky on the page's own player (the kill and the round
 *  read it), so every other pin clones this. */
const FRESH = structuredClone(playerEntity);
const STATS = { strength: 70, intelligence: 50, willpower: 50, agility: 50, endurance: 70, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({ name: 'W', hp: 8, stats: STATS,
  skills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.HandToHand, SKILLS.Destruction, SKILLS.Mercantile, SKILLS.Swimming, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Climbing] });

beforeEach(() => { _resetFirmamentLiveForTests(); _resetFirmamentPowersForTests(); _setFirmamentPowersRandForTests(null); _resetSigilForTests(); });

// ─── LANE 1: the law, the sky and the powers ────────────────────────

test('AUDIT UICALM-FIRM1 L1 H1: a key star\'s raw points and a small star\'s share are ONE channel - the build that made +21 Strength and +86 Health makes +15 and +75, the budget\'s', () => {
  const t = walk('wr.start', 'wr.c7.2', named('Warlord'), named('Headsman'), named("Giant's Heart"), named("Troll's Blood"), named('Shield Wall'), named("The Lady's Favor"), named('Reaver'));
  const c = treeStats(t);
  assert.ok(c.strength > 0 && c['pct.strength'] > 0 && c.hp > 0 && c.hpPct > 0, 'the build carries both kinds of each');
  const p = structuredClone(FRESH);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.level = 30; p.activeEffects = []; p.rawMaxHealth = 600; p.health = p.maxHealth;   // FIRM2: the stars sum under the cap now - a Health big enough for the share to pass it
  setRenownLayer(p, 50);
  const s0 = liveStat(p, 'strength'), h0 = p.maxHealth;
  setFirmamentOnline(true); setFirmamentTree(t); computeEntityMods(p); firmamentLayer(p);
  assert.equal(liveStat(p, 'strength') - s0, statDef('strength').max, 'Strength +15');
  assert.equal(p.maxHealth - h0, statDef('hp').max, 'Health +75');
});

test('FIRM2: a Strength already at 100 still takes the stars\' points, up to the sky\'s own +15 and no further', () => {
  const t = walk('wr.start', 'wr.c7.2', named('Warlord'), named('Headsman'), named("Giant's Heart"), named("Troll's Blood"), named('Shield Wall'), named("The Lady's Favor"), named('Reaver'));
  const p = structuredClone(FRESH);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.level = 30; p.activeEffects = []; p.stats.strength = 100;
  setRenownLayer(p, 50);
  assert.equal(liveStat(p, 'strength'), 100, 'Ascend\'s points alone stop at 100');
  setFirmamentOnline(true); setFirmamentTree(t); computeEntityMods(p); firmamentLayer(p);
  assert.equal(liveStat(p, 'strength'), 100 + statDef('strength').max, 'the sky takes it to 115, its own cap');
});

test('AUDIT UICALM-FIRM1 L1 M1: a mastered skill\'s share is held by the same budget - Stealth 200 (read 140) gains +15, not +53', () => {
  const t = walk('th.start', ...[...FIRM_NODES.values()].filter((n) => n.stats['skillPct.Stealth'] || n.stats['skill.Stealth']).map((n) => n.key).slice(0, 4));
  const p = structuredClone(FRESH);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.level = 30; p.activeEffects = []; p._online = true;
  p.skills[SKILLS.Stealth] = 200;
  setRenownLayer(p, 50);
  computeEntityMods(p);
  const before = skillValue(p, SKILLS.Stealth);
  setFirmamentOnline(true); setFirmamentTree(t); computeEntityMods(p);
  assert.ok(treeStats(t)['skillPct.Stealth'] > 0, 'the walk takes a Stealth share');
  assert.ok(skillValue(p, SKILLS.Stealth) - before <= statDef('skill.Stealth').max, `+${skillValue(p, SKILLS.Stealth) - before}`);
});

test('AUDIT UICALM-FIRM1 L1 M2: THE GAINS ARE CAPPED, THEN THE PRICE IS PAID - per channel and at the blow\'s group; only a keystone carries a price', () => {
  for (const n of FIRM_NODES.values()) for (const [k, v] of Object.entries(n.stats)) if (isPrice(k, v)) assert.equal(n.kind, 'keystone', `${n.key} ${k}`);
  // the mage past the spell's cap pays Martyr's Vow's -4
  const mage = walk('mg.start', 'mg.k', named('Searing Will'), named('Sundering Word'), named("Templar's Mace"), named('Glamoured Blade'));   // PIN MOVED (BAL10): Battlemage's Focus is the Ritual's Templar's Mace - its spellPower 4 the same
  const vow = { start: mage.start, keys: [...mage.keys, ...pathTo(mage, 'rt.k')] };
  assert.ok(treeParts(mage).gains.spellPower > statDef('spellPower').max, 'the mage stands past the cap');
  assert.equal(treeStats(mage).spellPower, statDef('spellPower').max);
  assert.equal(treeStats(vow).spellPower, statDef('spellPower').max + treeParts(vow).prices.spellPower);
  // Night Mother's Embrace: -5 in an open fight, though melee and short blades already pass the group's 30
  const without = walk('sh.start', named('Dagger Dance'), 'sh.c5.0', 'sh.c5.1', 'sh.c5.2', 'sh.c5.3', 'sh.c5.4', 'sh.c5.5', 'sh.c5.6', 'st.k');
  const nm = { start: without.start, keys: [...without.keys, ...pathTo(without, 'sh.k')] };
  const aware = (t) => blowPct(treeStats(t), { skill: 'ShortBlade', group: 'humanoid' });
  assert.equal(aware(without), 30);
  assert.equal(aware(nm), 25);
  assert.ok(blowPct(treeStats(nm), { skill: 'ShortBlade', unaware: true }) > blowPct(treeStats(without), { skill: 'ShortBlade', unaware: true }), 'and it pays off on the unaware');
  // through the real blow door
  const me = { isPlayer: true, health: 100, maxHealth: 100 };
  const foe = { isPlayer: false, affinity: 'Human', health: 100, maxHealth: 100 };
  const dagger = { templateIndex: 113 };
  setFirmamentOnline(true);
  const hundred = (t) => { setFirmamentTree(t); _resetFirmamentPowersForTests(); let n = 0; for (let i = 0; i < 100; i++) n += weaponBlowMods(dagger, 100, me, foe, { unaware: false }); return n; };
  assert.equal(hundred(nm), hundred(without) - 500);
  // and the price's own reader: a channel with no price reads as it did (a hand-made sheet has none)
  assert.equal(castCostPct({ castCost: 30 }), 25);
});

test('AUDIT UICALM-FIRM1 L1 M4: one damage-taken carry a channel - Atronach\'s Pact\'s harder blows and Spell Turning\'s lighter spells each carry their own fraction', () => {
  const t = walk('mg.start', 'mg.k', named('Spell Turning'));
  const c = treeStats(t);
  assert.ok(c.blowTaken > 0 && c.spellTaken < 0, 'opposite signs');
  setFirmamentOnline(true); setFirmamentTree(t);
  const me = { isPlayer: true, health: 1000, maxHealth: 1000, activeEffects: [] };
  const foe = { isPlayer: false, health: 50 };
  let blows = 0, spells = 0;
  for (let i = 0; i < 100; i++) {
    setStruck(foe, me, 10); let h = me.health; hurtPlayer(me, 10); blows += h - me.health;
    h = me.health; hurtPlayer(me, 10); spells += h - me.health; me.health = 1000;
  }
  assert.deepEqual([blows, spells], [1000 + 10 * c.blowTaken * 10 / 10, 1000 + 10 * c.spellTaken * 10 / 10]);
});

test('AUDIT UICALM-FIRM1 L1 L1: the sail\'s star moves her under the Classic helm too, by the same share', () => {
  const rad = (d) => (d * Math.PI) / 180;
  function helmOn(handling) {
    const s = scene({}); s.deps.handling = () => handling;
    const boat = s.helm(s.place(HULL.SmallShip, 0));
    const w = [-1.5 * Math.sin(rad(90)), 0, -1.5 * Math.cos(rad(90))];
    const hold = () => { s.rt.state.windVectorCurrent = [...w]; s.rt.state.windVectorTarget = [...w]; };
    hold(); s.rt.RaiseSails();
    for (let i = 0; i < 160; i++) { hold(); s.frame(); }
    return { drive: s.rt.state.MoveVectorTarget[2], way: s.rt.sailWayOf(boat) };
  }
  const tree = walk('st.start', named('Master and Commander'), named('Fair Winds'), named('Old Salt'), named('Child of Kynareth'));
  for (const handling of ['responsive', 'classic']) {
    setFirmamentOnline(false); setFirmamentTree(null);
    const a = helmOn(handling);
    setFirmamentOnline(true); setFirmamentTree(tree);
    const b = helmOn(handling);
    const share = 1 + firmStat('sailSpeed') / 100;
    assert.ok(share > 1);
    assert.ok(Math.abs(b.drive / a.drive - share) < 1e-3, `${handling} drive x${b.drive / a.drive}`);
    assert.ok(Math.abs(b.way / a.way - share) < 1e-3, `${handling} way x${b.way / a.way}`);
  }
});

test('AUDIT UICALM-FIRM1 L1 L2: mentoring puts the whole sky to sleep at once - the gathering windows and the sail with it, the fold told the same frame; partyFrame says so', () => {
  setFirmamentOnline(true);
  setFirmamentTree(walk('rt.start', named('Gentle Hands')));
  const herb = firmActMult('herbalism');
  assert.ok(herb > 1);
  let told = 0;
  onFirmamentChange(() => { told++; });
  setFirmamentMentoring(true);
  assert.deepEqual([told, firmActMult('herbalism'), firmStat('sailSpeed')], [1, 1, 0]);
  setFirmamentMentoring(true);
  assert.equal(told, 1, 'told once a change');
  setFirmamentMentoring(false);
  assert.deepEqual([told, firmActMult('herbalism')], [2, herb]);
  assert.match(read('src/scenes/world.js'), /const mentorWord = refreshMentor\(playerEntity, mentorLevels\);\n\s+setFirmamentMentoring\(!!playerEntity\._mentor\);/);
});

test('AUDIT UICALM-FIRM1 L1 L3: taking the seat back reads the book again', () => {
  assert.match(read('src/scenes/world.js'), /setFirmamentOnline\(true\);[^\n]*\n\s+firmBook\?\.read\(\)\.catch\(\(\) => \{\}\);/);
});

test('AUDIT UICALM-FIRM1 L1 L4: a star no longer joined to the start drops on read with every star it held, free - never paying stats, never billed', () => {
  const full = walk('wr.start', 'wr.k');
  const cut = full.keys.filter((k) => k !== 'wr.s2');
  const row = `wr.start|${cut.join(',')}`;
  const t = unpackTree(row);
  assert.equal(treeFault(t, starsFor(50), 0), null, 'what is read is whole');
  assert.ok(!t.keys.includes('wr.k'), 'the keystone cut off with its road');
  assert.equal(treeStats(t).rageDmg, undefined, 'and pays nothing');
  assert.deepEqual(refundTakes(t, 'wr.k'), [], 'nothing left to bill');
});

// ─── LANE 2: the service and the client book ────────────────────────

test('AUDIT UICALM-FIRM1 L2 M4: THE SWITCH IS THE WHOLE HAND - shut, or at "dev" for a player, a stored tree moves no harvest\'s XP', async () => {
  const s = await stand();
  const bo = await s.seated('Bobby', { renown: 1 });
  s.setXp(bo, 'fishing', xpForRank(55));
  s.setXp(bo, 'mining', xpForRank(100));
  s.setXp(bo, 'herbalism', xpForRank(100));   // the Craft points the life keystone's road costs
  const haul = () => s.call('/v1/prof/harvest', { character: bo.character, node: haulKey({ x: 300, y: 200, day: utcDay(NOON), id: hid() }), kind: 'fish', climate: 231, region: 17, act: { clean: false }, at: NOON - 2, rid: rid() }, bo.secret);
  const tree = walk('st.start', 'st.lk');
  assert.equal((await s.set(bo, tree)).status, 200);
  const plain = harvestXp(5, 55, false);
  assert.ok(scaleXp(plain, xpPct(treeStats(tree), 'fishing')) > plain, 'the tree moves it, open');
  for (const sw of ['off', 'dev']) {
    s.env.FIRMAMENT_OPEN = sw;
    assert.equal((await s.state(bo)).status, 403);
    const h = await haul();
    assert.deepEqual([h.status, h.body.xp], [200, plain], sw);
  }
});

test('AUDIT UICALM-FIRM1 L2 M4: a shut read leaves no tree in force on the device', async () => {
  const { door } = fakeDoor({ state: () => ({ ok: false, error: 'firm-closed', status: 403 }) });
  const book = createFirmamentBook({ door, character: () => 'c1' });
  book.state.tree = { start: 'wr.start', keys: ['wr.s1'] };
  book.state.character = 'c1';
  await book.read();
  assert.deepEqual([book.state.open, book.state.tree], [false, { start: null, keys: [] }]);
});

// PIN MOVED (FIRMAMENT-ON, 2026-10-15, the owner: "switch it on for players"): the config and the record still say one
// thing - now "on"
test('AUDIT UICALM-FIRM1 L2 M5, FIRMAMENT-ON: FIRMAMENT_OPEN is "on", as the record says', () => {
  assert.match(read('server-account/wrangler.toml'), /^FIRMAMENT_OPEN = "on"$/m);
  assert.match(read('bible/06-Systems/Firmament.md'), /then opened: \*\*`on`\*\* \(FIRMAMENT-ON, 2026-10-15/);
});

test('AUDIT UICALM-FIRM1 L2 M2: AN ID NAMES ONE TREE - the service refuses another tree under a made change\'s id; the book asks a newer tree under its own', async () => {
  const s = await stand();
  const kay = await s.seated('Kay', { renown: 8 });
  const X = walk('wr.start', 'wr.g'), Y = walk('wr.start', 'wr.k1');
  const id = rid();
  assert.equal((await s.set(kay, X, id)).status, 200);
  const again = await s.set(kay, X, id);
  assert.deepEqual([again.status, again.body.repeat], [200, true], 'the same tree: its repeat');
  const other = await s.set(kay, Y, id);
  assert.deepEqual([other.status, other.body], [400, { error: 'firm-rid' }]);
  assert.equal(s.row(kay), packTree(X));
  // the book: X lands and its answer is lost; Y is asked under an id of its own and lands
  const k2 = await s.seated('Lee', { renown: 8 });
  const dev = device(s, k2);
  const book = createFirmamentBook({ door: dev.door, storage: dev.storage, character: () => k2.character });
  await book.read();
  dev.net.drop = 1;
  assert.deepEqual(await book.commit(X), { ok: false, error: 'offline' });
  const r = await book.commit(Y);
  assert.equal(r.ok, true);
  assert.equal(s.row(k2), packTree(Y));
  assert.notEqual(dev.net.sets.at(-1).rid, dev.net.sets[0].rid);
});

test('AUDIT UICALM-FIRM1 L2 M1: no change is taken while a respec is on its way; the window\'s Accept waits for it', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { door, asked } = fakeDoor({ respec: async () => { await gate; return { ok: true, data: { tree: '' } }; } });
  const book = createFirmamentBook({ door, character: () => 'c1', wallet: () => ({ gold: () => 1e6, pay: () => {} }), realm: { act: async (o) => { o.reserve?.(); return o.call(null); } } });
  book.state.tree = { start: 'wr.start', keys: ['wr.s1'] };
  const going = book.respec();
  assert.deepEqual(await book.commit(walk('wr.start', 'wr.g')), { ok: false, error: 'firm-busy' });
  release();
  assert.equal((await going).ok, true);
  const Z = walk('mg.start', 'mg.s1');
  assert.equal((await book.commit(Z)).ok, true);
  assert.deepEqual(asked.map((a) => a.tree), [packTree(Z)], 'Z alone - nothing parked behind the respec');
  assert.match(read('src/ui/firmamentWindow.js'), /goBtn\.disabled = !n \|\| !online \|\| respecking;/);
});

test('AUDIT UICALM-FIRM1 L2 M3: the Worker\'s own `rate` and `maintenance` keep the change, to be asked again', async () => {
  for (const word of ['rate', 'maintenance']) {
    const storage = mapStorage();
    const { door } = fakeDoor({ set: () => ({ ok: false, error: word }) });
    const book = createFirmamentBook({ door, storage, character: () => 'c1' });
    assert.deepEqual(await book.commit(walk('wr.start', 'wr.g')), { ok: false, error: word });
    assert.equal(Object.keys(JSON.parse(storage.getItem(FIRM_KEPT_KEY) ?? '{}')).length, 1, word);
  }
});

test('AUDIT UICALM-FIRM1 L2 L4: a kept change the service refuses on its retry is SAID - the state\'s word, the listeners told', async () => {
  const storage = mapStorage();
  let refuse = false;
  const { door } = fakeDoor({ set: () => (refuse ? { ok: false, error: 'marks-short' } : { ok: false, error: 'offline' }) });
  const book = createFirmamentBook({ door, storage, character: () => 'c1' });
  await book.commit(walk('wr.start', 'wr.g'));
  refuse = true;
  const heard = [];
  book.onChange((st) => heard.push(st.error));
  assert.equal(await book.read(), true);
  assert.equal(book.state.error, 'marks-short');
  assert.ok(heard.includes('marks-short'));
  assert.equal(storage.getItem(FIRM_KEPT_KEY), '{}', 'and let go');
});

test('AUDIT UICALM-FIRM1 L2 L1: THE GOLD IS THE RECORD\'S - a respec with no realm record is refused on the service and on the device, the sky unmoved', async () => {
  const s = await stand();
  const p = await s.seated('Nell', { renown: 12 });
  const t = walk('mg.start', 'mg.s1');
  assert.equal((await s.set(p, t)).status, 200);
  const r = await s.call('/v1/firmament/respec', { character: p.character, rid: rid() }, p.secret);
  assert.deepEqual([r.status, r.body], [400, { error: 'realm-needed' }]);
  assert.equal(s.row(p), packTree(t));
  const { door } = fakeDoor({});
  const book = createFirmamentBook({ door, character: () => 'c1', wallet: () => ({ gold: () => 1e6, pay: () => {} }) });
  book.state.tree = t;
  assert.equal(book.canRespec(), false);
  assert.deepEqual(await book.respec(), { ok: false, error: 'realm-needed' });
});

test('AUDIT UICALM-FIRM1 L2 L2: a realm character\'s delete takes its sky with it (the ids\' memory stays)', async () => {
  const s = await stand();
  const p = await s.seated('Dee', { renown: 12 });
  const R = await seatRealm(s.env, p.secret, 'Dee', { name: 'Dee', level: 3, goldPieces: 100, items: [] });
  s.raw.prepare('UPDATE renown_tracks SET char_id = ? WHERE player = ? AND char_id = ?').run(R.id, p.id, p.character);
  const q = { ...p, character: R.id };
  assert.equal((await s.set(q, walk('mg.start', 'mg.k1'))).status, 200);
  assert.equal((await s.call('/v1/realm/delete', { id: R.id }, p.secret)).status, 200);
  const left = (t) => s.raw.prepare(`SELECT COUNT(*) n FROM ${t} WHERE player = ? AND char_id = ?`).get(p.id, R.id).n;
  assert.deepEqual([left('firmament'), left('firmament_sets')], [0, 1]);
});

test('AUDIT UICALM-FIRM1 L2 L3: a temper\'s XP takes the tree\'s hand, as the anvil\'s does', async () => {
  const s = await stand();
  const p = await s.seated('Mac', { renown: 50 });
  s.setXp(p, 'smithing', xpForRank(10));
  // FIRM2: the stars came down under their caps, so one small star's few percent of a temper's XP floors to nothing -
  // the anvil's own notable is the walk (Anvil's Song)
  const best = walk('wr.start', named("Anvil's Song"));
  assert.equal((await s.set(p, best)).status, 200);
  s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ingot:steel', 'own', 10)").run(p.id, p.character);
  const r = await s.call('/v1/prof/temper', { character: p.character, recipe: 'longsword:steel', quality: 1, provenance: null, rid: rid() }, p.secret);
  const pct = xpPct(treeStats(best), 'smithing');
  assert.ok(pct > 0);
  assert.deepEqual([r.status, r.body.xp], [200, scaleXp(craftXp(2, 10), pct)]);
  assert.ok(r.body.xp > craftXp(2, 10));
});

// ─── LANE 5: what the pins could not fail ───────────────────────────

test('AUDIT UICALM-FIRM1 L5 H1: THE SWITCH SHUTS EVERY DOOR - a change and a respec refused (firm-closed) shut and, at "dev", for a player; the row unmoved', async () => {
  for (const env of [{}, { FIRMAMENT_OPEN: 'dev' }]) {
    const s = await stand(env);
    const bo = await s.seated('Bobby', { renown: 12 });
    const set = await s.set(bo, walk('mg.start', 'mg.s1'));
    assert.deepEqual([set.status, set.body], [403, { error: 'firm-closed' }], JSON.stringify(env));
    const R = await seatRealm(s.env, bo.secret, 'Bobby', { name: 'Bobby', level: 9, goldPieces: 30_000, items: [] });
    const re = await s.call('/v1/firmament/respec', { character: R.id, rid: rid(), realm: R.at() }, bo.secret);
    assert.deepEqual([re.status, re.body], [403, { error: 'firm-closed' }]);
    assert.equal(s.row(bo), null);
  }
});

test('AUDIT UICALM-FIRM1 L5 M11: the guards - an hour\'s changes (refusals count), the packed tree\'s length, a refund with Marks shut, a change or a respec made over a tree another change replaced', async () => {
  const s = await stand();
  const ray = await s.seated('Ray', { renown: 20 });
  for (let i = 0; i < FIRM_OPS_MAX; i++) assert.equal((await s.set(ray, 'mg.start|nope')).status, 400);
  const over = await s.set(ray, walk('mg.start', 'mg.s1'));
  assert.deepEqual([over.status, over.body], [429, { error: 'firm-rate' }]);
  const player = (who) => s.raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id);
  let k = 0;
  const ctx = (db = s.env.DB) => ({ db, nowS: NOON, rand: (b) => { for (let i = 0; i < b.length; i++) b[i] = (k++ * 37 + i) & 255; return b; }, bucket: s.env.SAVES });
  const env = { FIRMAMENT_OPEN: 'on', MARKS_OPEN: 'on' };
  // a packed tree past the length is refused before it is read or counted: an hour of them leaves the hour's changes
  const sid = await s.seated('Sid', { renown: 20 });
  for (let i = 0; i <= FIRM_OPS_MAX; i++) assert.deepEqual(await setFirmament(ctx(), player(sid), env, { character: sid.character, tree: `mg.start|${'x'.repeat(FIRM_PACKED_MAX)}`, rid: rid() }), { error: 'firm-key' });
  assert.ok(!(await setFirmament(ctx(), player(sid), env, { character: sid.character, tree: packTree(walk('mg.start', 'mg.s1')), rid: rid() })).error, 'not counted');
  // a change that costs nothing, made over a tree another change replaced between its read and its batch
  const sue = await s.seated('Sue', { renown: 20 });
  const W2 = walk('wr.start', 'wr.k1');
  const two = { start: 'wr.start', keys: W2.keys.slice(0, 2) }, three = { start: 'wr.start', keys: W2.keys.slice(0, 3) };
  assert.ok(!(await setFirmament(ctx(), player(sue), env, { character: sue.character, tree: packTree(two), rid: rid() })).error);
  const swap = Object.create(s.env.DB);
  swap.prepare = (sql) => s.env.DB.prepare(sql);
  const one = packTree({ start: 'wr.start', keys: W2.keys.slice(0, 1) });
  swap.batch = async (list) => { s.raw.prepare('UPDATE firmament SET tree = ? WHERE player = ? AND char_id = ?').run(one, sue.id, sue.character); return s.env.DB.batch(list); };
  assert.deepEqual(await setFirmament(ctx(swap), player(sue), env, { character: sue.character, tree: packTree(three), rid: rid() }), { error: 'firm-stale' });
  assert.equal(s.row(sue), one);
  const ann = await s.seated('Ann', { renown: 20 });
  // a refund with Marks shut
  const T = walk('wr.start', 'wr.k1');
  const madeId = rid();
  assert.ok(!(await setFirmament(ctx(), player(ann), env, { character: ann.character, tree: packTree(T), rid: madeId })).error, 'a change made under an id');
  const shut = await setFirmament(ctx(), player(ann), { FIRMAMENT_OPEN: 'on' }, { character: ann.character, tree: packTree({ start: 'wr.start', keys: T.keys.slice(0, 2) }), rid: rid() });
  assert.deepEqual(shut, { error: 'marks-closed' });
  // a change made over a tree another change replaced between its read and its batch: refused, the other's row stands
  s.seedMarks(ann, 1000);
  const interloper = (tree) => {
    const db = Object.create(s.env.DB);
    db.prepare = (sql) => s.env.DB.prepare(sql);
    db.batch = async (list) => { s.raw.prepare('UPDATE firmament SET tree = ? WHERE player = ? AND char_id = ?').run(tree, ann.id, ann.character); return s.env.DB.batch(list); };
    return db;
  };
  const theirs = packTree({ start: 'wr.start', keys: T.keys.slice(0, 1) });
  const burnt = () => Number(s.raw.prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM marks_ledger WHERE actor = ? AND kind = 'firmament'").get(ann.id).n);
  const stale = await setFirmament(ctx(interloper(theirs)), player(ann), env, { character: ann.character, tree: packTree({ start: 'wr.start', keys: T.keys.slice(0, 3) }), rid: rid() });
  assert.deepEqual([stale, s.row(ann), burnt()], [{ error: 'firm-stale' }, theirs, 0]);
  // and a realm respec over a replaced tree: refused, the record's gold untouched
  const R = await seatRealm(s.env, ann.secret, 'Ann', { name: 'Ann', level: 9, goldPieces: 30_000, items: [] });
  s.raw.prepare('UPDATE renown_tracks SET char_id = ? WHERE player = ? AND char_id = ?').run(R.id, ann.id, ann.character);
  const q = { ...ann, character: R.id };
  assert.equal((await s.set(q, T)).status, 200);
  const gold = () => { const row = s.raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id); return JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))).goldPieces; };
  const db = Object.create(s.env.DB);
  db.prepare = (sql) => s.env.DB.prepare(sql);
  db.batch = async (list) => { s.raw.prepare('UPDATE firmament SET tree = ? WHERE player = ? AND char_id = ?').run(theirs, ann.id, R.id); return s.env.DB.batch(list); };
  const re = await respecFirmament(ctx(db), player(ann), env, { character: R.id, rid: rid(), realm: R.at() });
  assert.deepEqual([re.error, s.row(q), gold()], ['firm-stale', theirs, 30_000]);
  // a respec under an id another character's change made is refused
  const other = await respecFirmament(ctx(), player(ann), env, { character: R.id, rid: madeId, realm: R.at() });
  assert.deepEqual(other, { error: 'firm-rid' }, JSON.stringify(other));
});

test('AUDIT UICALM-FIRM1 L5 H4: THE TREE\'S HAND ON A HARVEST\'S YIELD - the quantity the profession\'s percent more on the service\'s own die, drawn for a tree that moves it', async () => {
  const realGrv = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  /** the service's dice, a seeded sequence - the same seed draws the same haul */
  const seeded = (seed) => { let x = seed >>> 0; globalThis.crypto.getRandomValues = (b) => { for (let i = 0; i < b.length; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; b[i] = x; } return b; }; };
  try {
    const s = await stand();
    // the herb's yield: a life keystone's 10%, a notable's 6, another's 3 and the stars on the way (FIRM2: the keystone's
    // 20% came down to 10, and a share that small hid a tripled yield in the floor - the walk takes the herb's whole wheel)
    const tree = walk('rt.start', named("Hermit's Covenant"), named('Green Thumb'), named("Druid's Path"));
    const pct = treeStats(tree)['yield.herbalism'];
    assert.ok(pct > 0);
    const bare = await s.seated('Bare', { renown: 50 }), sky = await s.seated('Sky', { renown: 50 });
    for (const who of [bare, sky]) for (const pr of ['fishing', 'mining', 'herbalism', 'logging', 'hunting']) s.setXp(who, pr, xpForRank(100));
    assert.equal((await s.set(sky, tree)).status, 200, 'the yield star bought');
    const herb = (x) => nodeKey({ kind: 'herb', x, y: 200, day: utcDay(NOON), slot: herbPatches({ x, y: 200, day: utcDay(NOON), climate: 231 })[0].slot });
    const haul = (who, x) => s.call('/v1/prof/harvest', { character: who.character, node: herb(x), kind: 'herbs', climate: 231, region: 21, act: {}, at: NOON - 2, rid: rid() }, who.secret);
    let more = 0;
    for (let seed = 1; seed <= 12; seed++) {
      seeded(seed); const a = await haul(bare, 300 + seed);
      seeded(seed); const b = await haul(sky, 300 + seed);
      assert.deepEqual([a.status, b.status], [200, 200]);
      const q = a.body.qty, exact = (q * (100 + pct)) / 100;
      assert.ok(b.body.qty === Math.floor(exact) || b.body.qty === Math.floor(exact) + 1, `seed ${seed}: ${q} -> ${b.body.qty} at +${pct}%`);
      if (b.body.qty > q) more++;
    }
    assert.ok(more > 0, 'the yield moved some hauls');
  } finally { globalThis.crypto.getRandomValues = realGrv; }
  assert.equal(scaleQty(1, -30, 0.99), 1, 'never under 1 where it was at least 1');
});

test('AUDIT UICALM-FIRM1 L5 H4: every craft route takes the tree\'s hand on its XP - a smelt by execution, the anvil, the brew and the disenchant by their lines', async () => {
  const s = await stand();
  const p = await s.seated('Mac', { renown: 50 });
  s.setXp(p, 'smithing', xpForRank(10));
  let best = null;
  for (const [k, n] of FIRM_NODES) if (n.stats['xp.smithing']) for (const st of ['wr.start', 'mg.start', 'th.start', 'st.start', 'sh.start', 'rt.start', 'sp.start']) {
    const t = walk(st, k);
    if (t.keys.length && (!best || t.keys.length < best.keys.length)) best = t;
  }
  const plainSmelt = async (who) => {
    s.raw.prepare("INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'metal:iron', 'own', 40) ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = 40").run(who.id, who.character);
    return s.call('/v1/prof/smelt', { character: who.character, recipe: 'ingot:iron', count: 10, rid: rid() }, who.secret);
  };
  const before = await plainSmelt(p);
  assert.equal(before.status, 200, JSON.stringify(before.body));
  assert.equal((await s.set(p, best)).status, 200);
  s.setXp(p, 'smithing', xpForRank(10));
  const after = await plainSmelt(p);
  assert.equal(after.body.xp, scaleXp(before.body.xp, xpPct(treeStats(best), 'smithing')));
  assert.ok(after.body.xp > before.body.xp);
  const prof = read('server-account/src/professions.js'), alch = read('server-account/src/alchemy.js');
  assert.match(prof, /\n {4}xpPct\(await firmStatsOf\(db, player, env, character\), craft\)\);   \/\/ FIRM1: the Firmament's hand on the craft's XP/);
  assert.match(alch, /const xp = scaleXp\(brewXp\(potion, rank\), xpPct\(await firmStatsOf\(db, player, env, character\), trackOf\('alchemy'\)\)\);/);   // PIN MOVED (FIRST-BUDGET): the brew's law takes no first - brewFirstXp beside it, never scaled
  assert.match(alch, /const xp = scaleXp\(disenchantXp\(r, rank, base, p\.bought_with == null\), xpPct\(await firmStatsOf\(db, player, env, character\), 'enchanting'\)\);/);   // PIN MOVED (CLOTH-GEMS): the piece's own origin read
});

test('AUDIT UICALM-FIRM1 L5 M3: the budget\'s numbers as the design page says them, and every price small, whichever way its channel reads', () => {
  const at = (k) => [STAT_DEFS[k].min, STAT_DEFS[k].max];
  assert.deepEqual([STAT_DEFS.strength.max, statDef('skill.LongBlade').max, STAT_DEFS.hp.max, STAT_DEFS.mp.max], [15, 15, 75, 75]);
  assert.deepEqual([at('spellPower')[1], at('castCost')[1], at('castSpeed')[1], at('blowTaken')[0], at('evade')[1]], [30, 25, 15, -15, 10]);
  assert.deepEqual([BLOW_CAP, BLOW_TOTAL_CAP, CAST_COST_CAP], [30, 50, 25]);
  assert.deepEqual([REFUND_FREE_BELOW_RENOWN, REFUND_SILVER_PER_STAR, FIRM_RESPEC_GOLD, FIRM_RENOWN_MAX], [10, 10, 10_000, 50]);
  assert.deepEqual([refundSilver(3, 9), refundSilver(3, 10)], [0, 30]);
  assert.deepEqual([starsFor(50), starsFor(51)], [98, 98]);
  // a price is small whichever way its channel reads (the design page's largest: Atronach's Pact's blows 7% harder)
  for (const n of FIRM_NODES.values()) for (const [k, v] of Object.entries(n.stats)) if (isPrice(k, v)) assert.ok(Math.abs(v) <= 7, `${n.name}: ${k} ${v}`);
  // the caps a sheet past every one of them reads
  const huge = Object.fromEntries(['weaponDmg', 'meleeDmg', 'shortDmg', 'unawareDmg', 'rageDmg', 'castCost', 'castCost.Destruction'].map((k) => [k, 99]));
  assert.equal(blowPct(huge, { skill: 'ShortBlade', unaware: true, wounded: true }), BLOW_TOTAL_CAP);
  assert.equal(castCostPct(huge, ['Destruction']), CAST_COST_CAP);
});

test('AUDIT UICALM-FIRM1 L5 M4: no line of the sky runs through a star it does not join (the drawn radius and the breath round it)', () => {
  const R = (k) => ({ start: 30, keystone: 25, notable: 16 })[k] ?? 9;
  const hits = [];
  for (const e of FIRM_EDGES) {
    if (e.arc) continue;
    const p = FIRM_NODES.get(e.a), q = FIRM_NODES.get(e.b);
    const dx = q.x - p.x, dy = q.y - p.y, L2 = dx * dx + dy * dy || 1;
    for (const m of FIRM_NODES.values()) {
      if (m.key === e.a || m.key === e.b) continue;
      const t = ((m.x - p.x) * dx + (m.y - p.y) * dy) / L2;
      if (t <= 0 || t >= 1) continue;
      if (Math.hypot(m.x - (p.x + t * dx), m.y - (p.y + t * dy)) < R(m.kind)) hits.push(`${e.a}-${e.b} through ${m.key}`);
    }
  }
  assert.deepEqual(hits, []);
  assert.ok(!read('vite.config.js').includes('firmamentProbe.mjs'), 'no probe named that the tree does not hold');
});

test('AUDIT UICALM-FIRM1 L5 H5: the combat channels as they act - an evasion on the dice, a kill\'s and a round\'s heal, a felled player feeding nothing, a ward, a peer, a duel, the sky taken off', () => {
  const t = { start: 'mg.start', keys: [] };
  setFirmamentOnline(true);
  const stats = { evade: 0, killHeal: 0, hpRegen: 0 };
  // a tree carrying each channel the pins read, walked to the nearest star that gives it
  for (const ch of ['evade', 'killHeal', 'hpRegen', 'absorb', 'spellPierce', 'weaponDmg']) {
    const star = [...FIRM_NODES.values()].filter((n) => (n.stats[ch] ?? 0) > 0 && n.kind !== 'keystone').sort((a, b) => pathTo(t, a.key).length - pathTo(t, b.key).length)[0];
    if (star) t.keys.push(...pathTo(t, star.key));
  }
  setFirmamentTree(t);
  const c = treeStats(t);
  for (const k of Object.keys(stats)) assert.ok(c[k] > 0, `the tree carries ${k}`);
  const me = playerEntity;
  me.isPlayer = true; me.peer = false; me.activeEffects = []; me.maxHealth = 1000; me.health = 500; me.maxMagicka = 100; me.magicka = 50;
  const foe = { isPlayer: false, health: 50 };
  // an evasion asked at the door, on the dice: just under the chance, the blow misses; just over, it lands
  const blow = (roll) => { _setFirmamentPowersRandForTests(() => roll); me.health = 500; setStruck(foe, me, 10); hurtPlayer(me, 10); return 500 - me.health; };
  assert.equal(blow((c.evade - 0.5) / 100), 0);
  assert.ok(blow((c.evade + 0.5) / 100) > 0);
  assert.equal(firmamentEvade(me), false, 'no blow at the door, no evasion');
  me.health = 500; firmamentKill({ isPlayer: false, health: 0 });
  assert.equal(me.health, 500 + (1000 * c.killHeal) / 100);
  me.health = 500; firmamentKill({ isPlayer: true, health: 0 });
  firmamentKill({ isPlayer: false, peer: true, health: 0 });
  assert.equal(me.health, 500, 'a felled player, a peer: no kill star');
  me.health = 500; firmamentRound(me);
  assert.ok(Math.abs(me.health - (500 + (me.maxHealth * c.hpRegen) / 1000)) < 1e-9, `${me.health}`);
  // a ward and a peer: a fist's blow the sky raises, never through a ward
  const fists = [...FIRM_NODES.values()].filter((n) => (n.stats.fistDmg ?? 0) > 0 && n.kind !== 'keystone').sort((a, b) => pathTo(t, a.key).length - pathTo(t, b.key).length)[0];
  const ft = { start: t.start, keys: [...t.keys] };
  for (const s of ['mg.start', 'wr.start', 'th.start', 'st.start', 'sh.start', 'rt.start', 'sp.start']) { const w = walk(s, fists.key); if (w.keys.length) { ft.start = w.start; ft.keys = w.keys; break; } }
  setFirmamentTree(ft);
  assert.ok(firmamentBlow(null, 100, me, { isPlayer: false, affinity: 'Human' }, {}) > 100, 'the sky raises a fist');
  assert.equal(firmamentBlow(null, 100, me, { isPlayer: false, affinity: 'Human', warded: true }, {}), 100, 'never through a ward');
  setFirmamentTree(t);
  assert.deepEqual(firmamentFold({ ...me, peer: true }).stats ?? {}, {});
  // a duel puts the absorption and the pierce to sleep
  if (c.absorb) { assert.equal(firmamentAbsorb(me), c.absorb); setSigilDueling(true); assert.equal(firmamentAbsorb(me), 0); setSigilDueling(false); }
  if (c.spellPierce) { assert.equal(firmamentSpellPierce(me), c.spellPierce); setSigilDueling(true); assert.equal(firmamentSpellPierce(me), 0); setSigilDueling(false); }
  // the sky taken off: the life channels with the rest
  setFirmamentTree(walk('st.start', named('Old Salt')));
  const carry = firmamentFold(me).weightMult;
  if (carry) assert.equal(withoutFirmament(me, () => firmamentFold(me).weightMult ?? 0), 0);
});

test('AUDIT UICALM-FIRM1 L5 H5: a small star\'s Spell Points share is of the maximum without Renown\'s layer', () => {
  const p = structuredClone(FRESH);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.level = 30; p.activeEffects = [];
  setRenownLayer(p, 50);
  const star = [...FIRM_NODES.values()].find((n) => (n.stats.mpPct ?? 0) > 0 && n.kind !== 'keystone');
  let t = null;
  for (const st of ['wr.start', 'mg.start', 'th.start', 'st.start', 'sh.start', 'rt.start', 'sp.start']) { const w = walk(st, star.key); if (!t || w.keys.length < t.keys.length) t = w; }
  computeEntityMods(p);
  const renownOnly = renownMpOf(p), base = p.maxMagicka - renownOnly;
  const c = treeStats(t);
  assert.ok(Math.floor((renownOnly * c.mpPct) / 100) >= 1, 'Renown\'s layer large enough to tell the two bases apart');
  setFirmamentOnline(true); setFirmamentTree(t); firmamentLayer(p);
  assert.equal(renownMpOf(p) - renownOnly, Math.min(statDef('mp').max, (c.mp ?? 0) + Math.floor((base * c.mpPct) / 100)));
});

test('AUDIT UICALM-FIRM1 L5 H2/H3: the hosts - every strike and spell at a player rolled with the sky off; offline no sky; the seat given up puts it to sleep; the book\'s tree the one in force; a rise read and said as its own Stars', () => {
  const w = read('src/scenes/world.js');
  const strikes = [...w.matchAll(/duelAttackerOf\(playerEntity, weapon\)/g)].map((m) => w.slice(m.index - 48, m.index));
  assert.ok(strikes.length >= 4, `${strikes.length} strikes`);
  for (const pre of strikes) assert.match(pre, /withoutFirmament\(playerEntity, \(\) => $/, pre);
  const spells = [...w.matchAll(/siegeSpellNumbers\(sp, /g)].map((m) => w.slice(m.index - 48, m.index));
  assert.ok(spells.length >= 3);
  for (const pre of spells) assert.match(pre, /withoutFirmament\(playerEntity, \(\) => $/, pre);
  assert.match(w, /\n {2}setFirmamentOnline\(params\.has\('online'\)\);/);
  assert.match(w, /\n {4}setFirmamentOnline\(false\);   \/\/ FIRM1: the sky sleeps offline/);
  assert.match(w, /\n {2}firmBook\?\.onChange\(\(st\) => setFirmamentTree\(st\.tree\)\);/);
  assert.match(w, /announceRenownRise\(level, \{ stars: starsFor\(level\) - starsFor\(was\),/);
  assert.match(w, /firmBook\?\.read\(\)\.catch\(\(\) => \{\}\);   \/\/ FIRM1: a Renown level is a Star/);
});

test('AUDIT UICALM-FIRM1 L5 H5: the herb act\'s Basket glints longer by the steadier hand', () => {
  const plain = createHerbAct({ kind: 'basket', rng: () => 0.5 });
  setFirmamentOnline(true);
  setFirmamentTree(walk('rt.start', named('Gentle Hands')));
  const mult = firmActMult('herbalism');
  assert.ok(mult > 1);
  const steady = createHerbAct({ kind: 'basket', rng: () => 0.5 });
  const g = (a) => a.state?.glint ?? a.glint;
  assert.ok(Number.isFinite(g(plain)), 'the act says its glint');
  assert.ok(Math.abs(g(steady) - g(plain) * mult) < 1e-9);
});

// ─── LANE 4 and LANE 5: the saddle panel, the calm HUD ──────────────

const SADDLE = (o = {}) => ({
  mode: 'Horse', name: 'Shadow', wagonName: '', speed: 0, galloping: false,
  horse: { breath: 1, winded: false, hunger: 'Fed', hungerKey: 'fed', fedHours: 14, full: false, tier: 'Familiar', bond: 45, tierAt: 35, next: { name: 'Trusting', at: 55 } },
  wagon: null, oats: 3, apples: 0, kits: 0, load: null, near: true, wagonNear: true, cargo: null, view: false, hcc: true, ...o,
});

test('AUDIT UICALM-FIRM1 L5 M5 / L4 M1: the saddle panel When needed, on a page - a need a line, the hello its first seconds, then nothing; its key puts it up, kept WITH the choice it was pressed under', () => {
  _resetPrefsForTests();
  const doc = fakeDoc();
  const keyOf = (a) => (a === 'SaddlePanel' ? 'F2' : '');
  const show = (state) => drawEnhancedSaddle({ keyOf, ...state }, {}, { doc })?.dataset?.show;
  try {
    assert.equal(show({ saddle: SADDLE(), now: 1000 }), 'hello', 'mounted: the hello');
    assert.match(one(doc.body, 'saddlepanel-hint').textContent, /F2/, 'it names the key');
    assert.equal(show({ saddle: SADDLE(), now: 1000 + SADDLE_HELLO_MS + 1 }), 'none', 'then nothing');
    const winded = SADDLE({ horse: { ...SADDLE().horse, winded: true, breath: 0 } });
    assert.equal(show({ saddle: winded, now: 9000 }), 'note');
    assert.equal(one(doc.body, 'saddlepanel-hint').textContent, saddleNote(winded));
    assert.equal(toggleSaddlePanel(), true);
    assert.equal(show({ saddle: SADDLE(), now: 9500 }), 'full', 'the key: up');
    assert.deepEqual(getPref('saddlePanelOpen'), { open: true, mode: 'auto' });
    // the choice moves: the old press is the old choice's
    setPref(SADDLE_PANEL_PREF, 'off');
    assert.equal(saddlePanelOpen(), false);
    assert.equal(show({ saddle: SADDLE(), now: 9600 }), 'none', 'Off after an old F2: nothing');
    assert.equal(show({ saddle: SADDLE(), now: 9600, touch: true }), 'chip', 'a finger keeps its plate');
    setPref(SADDLE_PANEL_PREF, 'always');
    assert.equal(show({ saddle: SADDLE(), now: 9700 }), 'full', 'Always after an old F2 away: up');
    toggleSaddlePanel();
    assert.equal(show({ saddle: SADDLE(), now: 9800 }), 'none', 'and its own key puts it away');
  } finally { hideEnhancedSaddle(); _resetPrefsForTests(); }
  assert.match(read('src/ui/enhanced/enhancedSaddle.js'), /if \(last\.place === 0\) \{ if \(state\.touch\) placeTouch\(doc, parts, last\); else placeBar\(doc, parts, last\); \}/, 'a finger\'s block placed under the compass');   // PIN MOVED (THE MERGE of main into FIELD BUGS 2026-10-14: HUD-SADDLE's preview paints through the same code, so the placers take the nodes they place)
});

test('AUDIT UICALM-FIRM1 L5 M7 / L4 M3, N1: the calm HUD - the vitals rest after VITALS_REST_S full, and not a moment before; the player\'s Off, a lost point, a foe in the bar and the HUD arranged keep them up', async () => {
  _resetPrefsForTests();
  const mk = (tag = 'div') => ({
    tag, className: '', textContent: '', src: '', alt: '', children: [], dataset: {}, attrs: {},
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, on) { if (on ?? !this._s.has(c)) this._s.add(c); else this._s.delete(c); return this._s.has(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(a) { delete this.attrs[a]; }, remove() {},
    append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; }, addEventListener() {},
  });
  const find = (node, cls) => {
    if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
    for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
    return null;
  };
  const prev = globalThis.document;
  globalThis.document = { createElement: (t) => mk(t), createElementNS: () => mk(), getElementById: () => null, head: mk(), body: mk(), querySelector: () => null, querySelectorAll: () => [] };
  const { drawEnhancedHud, destroyEnhancedHud, HUD_CALM_PREF, VITALS_REST_S } = await import('../../src/ui/enhanced/enhancedHud.js');
  try {
    const v = { health: 300, maxHealth: 300, fatigue: 100, maxFatigue: 100, magicka: 50, maxMagicka: 50 };
    drawEnhancedHud(v, 0, 0, {});
    const root = globalThis.document.body.children.find((n) => n.className === 'hud');
    const bars = find(root, 'hud-bars');
    const rest = () => bars.classList.contains('rest');
    const run = (s, vit = v) => { for (let t = 0; t < s; t += 0.5) drawEnhancedHud(vit, 0, 0.5, {}); return rest(); };
    assert.equal(VITALS_REST_S, 4);
    assert.equal(run(3.5), false, 'not before the seconds');
    assert.equal(run(1), true, 'then at rest');
    assert.equal(run(0.5, { ...v, health: 299 }), false, 'one whole point of 300 lost: up at once');
    assert.equal(run(4.5), true);
    setPref(HUD_CALM_PREF, false);
    assert.equal(run(0.5), false, 'the player\'s Off');
    setPref(HUD_CALM_PREF, true);
    assert.equal(run(4.5), true);
    setPref(HUD_LOCK_PREF, false);
    assert.equal(run(0.5), false, 'the HUD arranged: never at rest');
    setPref(HUD_LOCK_PREF, true);
    assert.equal(run(4.5), true);
    markFoeStruck({ name: 'Rat', entity: { health: 5, maxHealth: 10 } });
    assert.equal(run(0.5), false, 'a foe in the bar');
  } finally {
    destroyEnhancedHud();
    globalThis.document = prev;
    _resetPrefsForTests();
  }
});

test('AUDIT UICALM-FIRM1 L4 H1, M4, M5, L1-L4 (text pins - the window wants a canvas): the bar inside the gutters, the say box and hint take no taps, a finger reads before it learns, the overlays\' close asks, a sign alone is a change, the keys hold the sky, Enter on a press is its own, every refusal said', () => {
  const w = read('src/ui/firmamentWindow.js');
  assert.match(w, /\.fmt-bar \{ position: absolute; left: 16px; right: 16px; margin-inline: auto; width: fit-content;/);
  assert.doesNotMatch(w, /\.fmt-bar \{[^}]*translateX/);
  assert.match(w, /\.fmt-hint \{[^}]*pointer-events: none;/);
  assert.match(w, /\.fmt-say \{[^}]*pointer-events: none;/);
  assert.match(w, /view\.y = Math\.max\(40, barFoot\(\) \/ 2\);/);
  assert.match(w, /view\.y = -n\.y \* view\.z \+ barFoot\(\) \/ 2;/);
  assert.match(w, /if \(e\.pointerType === 'touch' && d\.button !== 2 && hover !== key\) \{ setHover\(key, p\.x, p\.y\); return; \}/);
  assert.match(w, /canvas\.addEventListener\('pointerleave', \(e\) => \{ if \(!drag && e\.pointerType !== 'touch'\) setHover\(null, 0, 0\); \}\);/);
  // PIN MOVED (AUDIT GROWTH LANE5-1): the ask re-armed first (LANE3-8's rearm), its words the window's own t() line
  assert.match(w, /const overlayClose = \(\) => \{\n\s+rearm\(\);\n\s+if \(!dead && unaccepted\(\) && !armedClose\) \{\n\s+arm\(\);\n\s+say\(unacceptedClose\(\), true\);\n\s+unregister = registerOverlay\(overlayClose\);\n\s+return;/);
  assert.match(w, /const unacceptedClose = \(\) => t\('firmament\.unacceptedClose', 'You have unaccepted changes\. Press \{accept\} to keep them, or close again to discard them\.', \{ accept: t\('firmament\.accept', 'Accept'\) \}\);/);   // PIN MOVED (AUDIT GROWTH LANE5-2): the button's own word
  assert.match(w, /if \(used && e\.key !== 'Escape'\) armedClose = false;/);
  assert.match(w, /function unaccepted\(\) \{ const c = changes\(\); return !!\(c\.added \|\| c\.removed \|\| \(c\.startChanged && pending\.start\)\); \}/);
  assert.match(w, /const n = c\.added \+ c\.removed \+ \(c\.startChanged && pending\.start \? 1 : 0\);/);
  assert.match(w, /if \(!c\.added && !c\.removed && !\(c\.startChanged && pending\.start\)\) return;/);
  for (const d of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) assert.match(w, new RegExp(`case '${d}': view\\.[xy] [-+]= 60; hold\\(\\); dirty = true; break;`), d);
  assert.match(w, /case 'Enter': if \(e\.target\?\.tagName === 'BUTTON'\) \{ used = false; break; \}/);
  assert.match(w, /return \/\*\* @type \{Record<string, string>\} \*\/ \(REFUSALS\)\[error\] \?\? accountRefusalText\(error\);/);
  assert.match(w, /if \(st\.error === 'firm-closed'\) return t\('firm\.readFail\.closed',/);
  assert.match(w, /say\(refusalText\(r\?\.error, true\), true\);/);
  // L4 M6, L5, L6: the pause tabs wrap where a language's six do not fit; a page press's key in page ink; the Stable's
  // stepper on the card
  assert.doesNotMatch(read('src/ui/uiCalmStyle.js'), /\.px-tabs \{ flex-wrap: nowrap/);
  assert.match(read('src/ui/grimoireDress.js'), /\$\{G\} \[data-grim-on="page"\] \[class\$="-key"\] \{ color: \$\{T\.inkSoft\} !important;/);
  assert.match(read('src/ui/holdingsPages.js'), /\.px-sys \.hld-pick:has\(\.hld-step\) \{ grid-template-columns: auto minmax\(0, 1fr\) auto; \}/);
  // the type floor: no word of the window under 12px
  assert.deepEqual([...w.matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1])).filter((n) => n < 12), []);
});

test('AUDIT UICALM-FIRM1 L3 H1, M1-M8, L1-L4, N1 (text pins - the door and the walk want a screen; each was proven by a probe): the stage ends at the measured foot, the book stands where it is tall enough, a double click is one door, a class\'s way by its key, the walk\'s bar and sheet keep the screen, a waiting way on reads, the map\'s plates re-laid as they grow, the Grimoire\'s phone rail on its page, the keyboard back on its door', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  const calm = read('src/ui/uiCalmStyle.js');
  const grim = read('src/ui/grimoireDress.js');
  const gen = read('src/ui/enhanced/enhancedChargen.js');
  // H1: the foot says its height, the stage ends there; a phone's plaques wrap
  assert.match(menu, /const reserve = \(\) => \{ const h = Math\.ceil\(foot\.getBoundingClientRect\?\.\(\)\.height \?\? 0\); if \(h > 0\) home\.style\?\.setProperty\?\.\('--px-foot-h', `\$\{h\}px`\); \};\n\s+reserve\(\);\n\s+try \{ footObs = new globalThis\.ResizeObserver\(reserve\); footObs\.observe\(foot\); \}/);
  assert.match(calm, /\.px-home:not\(\.px-over\)\[style\*="--px-foot-h"\] > \.px-stage:not\(\.px-acctstage\) \{ height: calc\(100% - var\(--px-foot-h\)\); padding-bottom: 12px; \}/);
  assert.match(calm, /\.px-home:not\(\.px-over\) \.px-footright, \.px-home:not\(\.px-over\) \.px-footleft \{ display: contents; \}/);
  // M1: the book needs the height its type was set for
  assert.match(grim, /const BOOK_MQ = '\(min-width: 900px\) and \(min-aspect-ratio: 5\/4\) and \(min-height: 561px\)';/);
  // M2: a double click's second click opens no door
  assert.match(menu, /b\.onclick = \(e\) => \{ if \(e\?\.detail > 1\) return; onClick\(e\); \};/);
  // M3: a class's way by the career's own key, never its shown (translated) name
  assert.match(gen, /const w = custom \? 'Your own' : classWayOf\(flow\.careers\[i\]\?\.name\);/);
  assert.match(gen, /const pickedWay = flow\.classListIndex === flow\.careers\.length \? null : classWayOf\(flow\.careers\[flow\.classListIndex\]\?\.name\);/);
  assert.doesNotMatch(gen, /classWayOf\((name|picked)\)/);
  // M4: a phone's action bar wraps, its way on with no floor
  assert.match(calm, /@media \(max-width: 860px\) \{\n\s+\.wizard \.actionbar \{ flex-wrap: wrap; \}\n\s+\.wizard \.actionbar \.act\.primary \{ min-width: 0; \}/);
  // M5: a waiting way on in an ink of its own, both dresses
  assert.match(calm, /\$\{P\} \.wizard \.act\.primary\[disabled\] \{ opacity: 1; color: #bdb4a0; \}/);
  assert.match(grim, /\$\{G\} \.wizard :is\(\.actionbar, \.choose \.acts, \.skillpane \.acts\) \.act\.primary:disabled \{ opacity: 0\.85 !important; \}/);
  // M6: every plate watched, so a late face re-lays them
  assert.match(gen, /ro\.observe\(box\);\n\s+for \(const q of plates\) ro\.observe\(q\.tag\);/);
  // M7: a phone's sheet bounds its confirm card - its words scroll, its presses stand
  assert.match(calm, /\.wizard \.stagebody > \.detail\.wizsheet:has\(> \.dcard\.confirm\) \{ display: flex; flex-direction: column; overflow: hidden; \}/);
  assert.match(calm, /\.wizard \.stagebody > \.detail\.wizsheet > \.dcard\.confirm \{ flex: 1 1 auto; min-height: 0; max-height: none; \}/);
  // M8: the Grimoire's phone rail on its page, its head in the whole deep red
  assert.match(grim, /@media \(max-width: 860px\), \(pointer: coarse\) \{ \$\{G\} \.shell:not\(\.wizard\) \.rail \{ background: \$\{PAGE\} !important; \} \}/);
  assert.match(grim, /\$\{G\} \.rail \.railgroup \{ margin: 18px 24px 2px;[^\n]*\n\s+color: \$\{T\.redDeep\}; border-bottom: 1px solid rgba\(43,26,12,0\.25\); padding-bottom: 2px; \}/);
  // L1: the keyboard back on the door a level or a section was left by
  assert.match(menu, /: section !== 'home' \? \(\) => \{ const from = section; go\('home'\); if \(mode !== 'pause'\) focusDoor\(from\); \}/);
  assert.match(menu, /focusDoor\(from\); \}   \/\/ UI-CALM: the offline doors back out to the two questions/);
  // L2: a level's health as the roll gives it
  assert.match(gen, /`\$\{Math\.trunc\(career\.hitPointsPerLevel \/ 2\)\}-\$\{career\.hitPointsPerLevel\} a level, more with Endurance`/);
  // L3: the floor's 11px words
  assert.match(calm, /\.opt-tools \.act, \.wizard \.poolk \{ font-size: 12px; \}/);
  assert.match(calm, /\.wizard \.maplabel \{ font-size: 12px; padding: 2px 5px; \}/);
  // L4: a phone's rail head takes a row of its own
  assert.match(calm, /\.shell:not\(\.wizard\) \.rail \.railgroup \{ flex: 0 0 100%; margin: 8px 12px 0; \}/);
  // N1: Settings and Overhauls keep the level they were opened from
  assert.match(menu, /else if \(section === 'online'\) homeLevel = 'top';/);
  assert.doesNotMatch(menu, /HOME_LINKS\.some\(\(l\) => idOf\(l\) === section\)\) homeLevel = 'top'/);
});

test('AUDIT UICALM-FIRM1 L5 M9, L5 L3, L3 N2, N3 (text pins): the enhanced door\'s offline doors and the foot\'s plaques in the player\'s language; the class bars\' colours each dress\'s own; an Acrobat', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  const calm = read('src/ui/uiCalmStyle.js');
  const grim = read('src/ui/grimoireDress.js');
  const gen = read('src/ui/enhanced/enhancedChargen.js');
  // L5 M9: the two-question door's offline doors by railLabel (the L10N1b pin reads the classic list's loop alone)
  assert.match(menu, /for \(const label of HOME_OFFLINE\.slice\(0, 3\)\) games\.append\(doorBtn\(idOf\(label\), railLabel\(label\), '', \(\) => go\(idOf\(label\)\)\)\);/);
  assert.match(menu, /for \(const label of HOME_OFFLINE\.slice\(3\)\) more\.append\(doorBtn\(idOf\(label\), railLabel\(label\), '', \(\) => go\(idOf\(label\)\)\)\);/);
  assert.match(menu, /\.append\(doorBtn\('online', railLabel\('Online'\), t\('menu\.home\.onlineSub', /);
  assert.match(menu, /\.append\(doorBtn\('offline', t\('menu\.home\.offline', 'Offline'\), t\('menu\.home\.offlineSub', /);
  // L3 N3: the foot's two plaques
  assert.match(menu, /const tuts = el\('button', 'px-about px-tuts door-tutorials', RAIL_TEXT\.tutorials\(\)\);/);
  assert.match(menu, /const shots = el\('button', 'px-about px-shots', RAIL_TEXT\.screenshots\(\)\);/);
  // L5 L3: the bars' dark and amber Plus's (uicalm's rule-by-rule scope pin), the Grimoire's in its ink and red
  assert.match(calm, /\$\{P\} \.wizard \.cprof-bar \{ border-color: #050608; background: rgba\(5,6,8,0\.6\); box-shadow: 0 0 0 1px #5a5446; \}\n\$\{P\} \.wizard \.cprof-fill \{ background: #c08a3e; \}/);
  assert.match(grim, /\$\{G\} \.wizard \.cprof-bar \{ border-color: rgba\(43,26,12,0\.55\); background: rgba\(43,26,12,0\.12\); \}\n\$\{G\} \.wizard \.cprof-fill \{ background: \$\{T\.redDeep\}; \}/);
  // L3 N2: Play as an Acrobat
  assert.match(gen, /`Play as \$\{\/\^\[aeiou\]\/i\.test\(named\) \? 'an' : 'a'\} \$\{named\}`/);
  assert.match(gen, /`Play as \$\{\/\^\[aeiou\]\/i\.test\(picked\) \? 'an' : 'a'\} \$\{picked\}`/);
  assert.doesNotMatch(gen, /Play as a \$\{/);
});
