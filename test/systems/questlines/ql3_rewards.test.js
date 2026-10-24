// QL3 (bible/06-Systems/Questlines-Arc.md section 5.2): WHAT AN OUTCOME PAYS, PINNED - AUDIT QUESTLINES REWARD-9 found the
// reward law held by nothing (eight probe mutants lived through every questlines pin: the class fit removed, a lesser
// outcome's gold at 1, a greater one's at 1 with no rung, tier 1 paying Rare, the roll on Math.random, a named piece every
// time, its name never set, the letter rule). Each is held here, through the real bridge where a quest's own script is
// the claim, and beside them the audit's fixes: the gold an ending settles (REWARD-3), a named piece made from its base
// (REWARD-5), the row's promise of gear (REWARD-6), tier 4 at Rare (REWARD-7), the armour fallback (REWARD-10), the
// party's share named after the scale (REWARD-11), an individual faction only (REWARD-12), no door no cut (REWARD-13), a
// named piece spent when taken and kept past the cap (LINES-20), the dropped offer said (REWARD-8), the sheet keys by kind
// (LAW-10) and the journal's row kept (LAW-11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { questSource, loadTables, ROOT } from '../../qlSources.mjs';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF, freshState } from '../../../src/systems/questlines/qlLaw.js';
import { SHEETS, SHEET_FAMILIES, sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import {
  PAY_PROFILES, TIER_FLOORS, OUTCOME_GOLD_MIN, OUTCOME_GOLD_MAX, goldFactor, scaleGold, rewardTier, pieceRarity, rollRewardChoice,
  fitsPlayer, namedBaseOf, factionIdOf, goldStillOwed, bestWeaponSkills, payProfileOf,
} from '../../../src/systems/questlines/qlRewards.js';
import { weaponSkillUsed } from '../../../src/characters/weapons.js';
import { createQuestlines, OFFERS_MAX, trimOffers, sheetTextKey } from '../../../src/systems/questlines/qlLayer.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { isForbiddenEquip } from '../../../src/systems/equip.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { itemLongName } from '../../../src/systems/item/itemInfo.js';
import { itemFindings } from '../../../src/systems/item/itemLaw.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { goldStack } from '../../../src/systems/inventory.js';
import { patchLocaleTable, currentLocale, TextCollections, runtimeCollectionName } from '../../../src/systems/textManager.js';
import { quietText } from '../../../src/ui/quest/questLens.js';

loadTables();
setPref(QUESTLINES_PREF, true);

const skills = (best) => { const s = new Array(35).fill(20); for (const [k, v] of Object.entries(best)) s[SKILLS[k]] = v; return s; };
const FREE = { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 };
const FIGHTER = { level: 12, career: FREE, skills: skills({ LongBlade: 70, Axe: 50 }) };
const ARCHER = { level: 12, career: FREE, skills: skills({ Archery: 70, ShortBlade: 50 }) };
/** Chain, plate and every shield barred (armour bits 6-8: leather 1, chain 2, plate 4; shields bits 9-12). */
const MAGE = { level: 12, career: { weaponArmorShieldsBitfield: (6 << 6) | (0xf << 9), forbiddenMaterialsFlags: 0 }, skills: skills({ ShortBlade: 40, BluntWeapon: 35 }) };
/** A class barred from every armour and shield (a custom class may take it). */
const NO_ARMOUR = { level: 12, career: { weaponArmorShieldsBitfield: (7 << 6) | (0xf << 9), forbiddenMaterialsFlags: 0 }, skills: skills({ LongBlade: 70 }) };
const NAMED = [];
for (const fam of SHEET_FAMILIES) for (const s of fam.sheets) for (const o of s.outcomes ?? []) if (o.named) NAMED.push({ quest: s.quest, outcome: o.id, named: o.named });

/** A bridge over the pack as the game reads it, every host door the reward path reads recorded; the world's half
 *  headless (an action that needs a scene finishes quietly). */
function packBridge({ entity = FIGHTER, over = {} } = {}) {
  const rec = { offers: [], rewards: [], gold: [], hud: [] };
  let now = 1000;
  const bridge = createQuestBridge({
    data: {
      readListTable: (name) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`), 'utf8'); } catch { return null; } },
      getQuestSourceLines: (n) => questSource(n, true),
    },
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', gender: 'female', ...entity },
    getReputation: () => 0, carriesQuestItem: () => false, showPrompt: (_q, _m, respond) => respond(true),
    onQuestlineOffer: (o) => rec.offers.push(o), offerReward: (_q, item) => rec.rewards.push(item),
    addGold: (n) => rec.gold.push(n), addHUDText: (t) => rec.hud.push(t),
    ...over,
  });
  const start = (name) => {
    const warn = console.warn; console.warn = () => {};
    try {
      const q = bridge.machine.startQuestByName(name, 0);
      for (const t of q.tasks.values()) for (const a of t.actions) if (!a.isTriggerCondition) { const up = a.update.bind(a); a.update = (c) => { try { up(c); } catch { a.setComplete(); } }; }
      return q;
    } finally { console.warn = warn; }
  };
  const tick = (n = 1) => { const warn = console.warn; console.warn = () => {}; try { for (let i = 0; i < n; i++) { now += 60; bridge.machine.tick(); bridge.questlines.look(); } } finally { console.warn = warn; } };
  return { bridge, rec, start, tick };
}

/** M0B00Y16 (the giant and the merchant) down its rescue path, the escort home before the questor's click or after:
 *  answers the gold the script minted and what reached the player (the purse offered and what the ending added). */
function giant(order, { entity = FIGHTER, reload = false } = {}) {
  let { bridge, rec, start, tick } = packBridge({ entity });
  const q = start('M0B00Y16');
  let at = null;
  for (const r of q.resources.values()) if (r.isPlace) r.isPlayerHere = () => at === r.symbol.name;
  const fire = (task, type) => { for (const a of q.getTask({ name: task }).actions) if (a.typeName === type) { const c = a.checkTrigger.bind(a); let once = true; a.checkTrigger = (x) => (once ? ((once = false), true) : c(x)); } };
  tick(2);   // the start-up's draws, then the merchant's arm forced as the pick would
  q.getTask({ name: 'victim' }).start(); q.getTask({ name: 'S.09' }).clear();
  tick(1);
  fire('S.10', 'ClickedNpc'); tick(2);   // the merchant: "lead me out" - yes
  fire('S.03', 'KilledFoe'); tick(2);    // the giant dead
  const minted = q.getItem({ name: 'gold' }).daggerfallUnityItem.stackCount;
  const escort = () => { at = 'store'; tick(2); at = null; };
  const claim = () => { fire('clickqgiver', 'ClickedNpc'); tick(2); };
  if (order === 'escort first') { escort(); claim(); } else { claim(); if (!reload) escort(); }
  let quest = q;
  if (reload) {   // a save and a load between the pay and the end (the escort home after it): the record rides the layer's save
    const snap = bridge.snapshot();
    const next = packBridge({ entity });
    next.bridge.restore(snap);
    ({ bridge, tick } = next);
    next.rec.rewards.push(...rec.rewards);
    rec = next.rec;
    quest = bridge.machine.quests.get(q.uid);
    for (const t of quest.tasks.values()) for (const a of t.actions) if (!a.isTriggerCondition) { const up = a.update.bind(a); a.update = (c) => { try { up(c); } catch { a.setComplete(); } }; }
    for (const r of quest.resources.values()) if (r.isPlace) r.isPlayerHere = () => at === r.symbol.name;
    escort();
  }
  tick(6);
  const purse = rec.rewards.filter((i) => i.group === 'Currency').reduce((n, i) => n + i.stackCount, 0);
  return { quest, minted, purse, added: rec.gold, hud: rec.hud, offers: rec.offers };
}

// ---- the pays and the ladder ----

test('QL3 the pays, exact (section 5.2): each pay\'s gold factor, gear and step; the factor bounded; gold scaled once at least a coin, never an item (mutants: lesser gold 1; greater gold 1 no rung)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(PAY_PROFILES)), {
    standard: { gold: 1, gear: true, step: 0 }, lesser: { gold: 0.75, gear: true, step: 0 }, greater: { gold: 1.25, gear: true, step: 1 },
    double: { gold: 1, gear: true, step: 0 }, betrayal: { gold: 1, gear: false, step: 0 }, own: { gold: 1, gear: false, step: 0 },
    none: { gold: 1, gear: false, step: 0 },
  });
  assert.deepEqual(['standard', 'lesser', 'greater', 'nosuch'].map((pay) => goldFactor({ pay })), [1, 0.75, 1.25, 1]);
  assert.deepEqual([OUTCOME_GOLD_MIN, OUTCOME_GOLD_MAX], [0.75, 1.5]);
  assert.deepEqual(['lesser', 'standard', 'greater'].map((pay) => scaleGold({ stackCount: 100 }, { pay }, true).after), [75, 100, 125]);
  for (const pay of Object.keys(PAY_PROFILES)) assert.equal(payProfileOf({ pay }), PAY_PROFILES[pay], pay);
  assert.equal(payProfileOf({ pay: 'nosuch' }), PAY_PROFILES.none, 'an unknown pay pays nothing extra');
  const g = { stackCount: 401 };
  assert.deepEqual(scaleGold(g, { pay: 'lesser' }, true), { before: 401, after: 301 });
  assert.deepEqual(scaleGold({ stackCount: 1 }, { pay: 'lesser' }, true), { before: 1, after: 1 }, 'at least a coin');
  assert.equal(scaleGold({ stackCount: 9 }, { pay: 'greater' }, false), null, 'a script\'s own item is never touched');
  assert.deepEqual([1, 2, 3, 4].map((t) => rewardTier(t, { pay: 'greater' })), [2, 3, 4, 4], 'greater: a rung up, never past 4');
  assert.deepEqual([1, 2, 3, 4].map((t) => rewardTier(t, { pay: 'lesser' })), [1, 2, 3, 4]);
});

test('QL3 the ladder, exact per tier (AUDIT QUESTLINES REWARD-7, the record\'s measure: "ONE piece ... at Magic or Rare"): tier 1 Magic, 2 Magic a quarter Rare, 3 and 4 Rare - and no quest\'s choice is ever Legendary, a greater outcome\'s rung included (mutants: tier 1 paying Rare; tier 4 a rung up)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(TIER_FLOORS)), { 1: { floor: 'magic', up: 0 }, 2: { floor: 'magic', up: 0.25 }, 3: { floor: 'rare', up: 0 }, 4: { floor: 'rare', up: 0 } });
  const tally = (tier) => { const r = seededRng(7 + tier); const n = {}; for (let i = 0; i < 2000; i++) { const x = pieceRarity(tier, r); n[x] = (n[x] ?? 0) + 1; } return n; };
  assert.deepEqual(Object.keys(tally(1)), ['magic']);
  const two = tally(2);
  assert.ok(two.rare > 400 && two.rare < 600 && two.magic > 1400, `tier 2: a quarter a rung up (${JSON.stringify(two)})`);
  assert.deepEqual(Object.keys(tally(3)), ['rare']);
  assert.deepEqual(Object.keys(tally(4)), ['rare']);
  const seen = new Set();
  for (let seed = 0; seed < 120; seed++) for (const tier of [3, 4]) for (const p of rollRewardChoice({ seed, level: 30, tier: rewardTier(tier, { pay: 'greater' }), entity: FIGHTER })) seen.add(p.item.rarity);
  assert.deepEqual([...seen], ['rare'], 'a greater outcome at tier 3 or 4: Rare, never Legendary');
});

test('QL3 the roll is seeded: the same seed, level and player answer the same three; another seed another three (mutants: Math.random roll)', () => {
  const a = rollRewardChoice({ seed: 1234, level: 12, tier: 2, entity: FIGHTER });
  assert.deepEqual(JSON.parse(JSON.stringify(rollRewardChoice({ seed: 1234, level: 12, tier: 2, entity: FIGHTER }))), JSON.parse(JSON.stringify(a)));
  const others = new Set();
  for (let seed = 0; seed < 12; seed++) others.add(JSON.stringify(rollRewardChoice({ seed, level: 12, tier: 2, entity: FIGHTER }).map((p) => [p.item.templateIndex, p.item.name])));
  assert.ok(others.size > 8, `seeds roll their own (${others.size} of 12 distinct)`);
});

test('QL3 the fit: never a piece the class may not equip, a weapon of the player\'s two best skills; a class barred from every armour is offered three - a weapon and two jewels (mutants: class fit removed; REWARD-10 the armour fallback; the worst skills read as the best)', () => {
  const blade = { level: 12, career: FREE, skills: skills({ LongBlade: 90, Axe: 80, Archery: 5 }) };
  assert.deepEqual(bestWeaponSkills(blade), [SKILLS.LongBlade, SKILLS.Axe]);
  for (let seed = 0; seed < 30; seed++) {
    const w = rollRewardChoice({ seed, level: 12, tier: 1, entity: blade }).find((p) => p.kind === 'weapon');
    assert.ok([SKILLS.LongBlade, SKILLS.Axe].includes(weaponSkillUsed(w.item.templateIndex)), `seed ${seed}: ${w.item.name} is a long blade or an axe`);
  }
  for (const [who, e] of [['mage', MAGE], ['archer', ARCHER], ['fighter', FIGHTER]]) {
    for (let seed = 0; seed < 60; seed++) {
      const three = rollRewardChoice({ seed, level: e.level, tier: 2, entity: e });
      assert.equal(three.length, 3, `${who} ${seed}: three`);
      assert.deepEqual(three.map((p) => p.kind), ['weapon', 'armor', 'jewel']);
      for (const p of three) {
        assert.equal(isForbiddenEquip(e.career, p.item), false, `${who} ${seed}: ${p.item.name} forbidden`);
        assert.equal(fitsPlayer(p.item, p.kind, e), true, `${who} ${seed}: ${p.item.name} fits`);
        assert.deepEqual(itemFindings(p.item), [], `${who} ${seed}: lawful`);
      }
    }
  }
  for (let seed = 0; seed < 40; seed++) {
    const three = rollRewardChoice({ seed, level: 12, tier: 2, entity: NO_ARMOUR });
    assert.deepEqual(three.map((p) => p.kind), ['weapon', 'jewel', 'jewel'], `seed ${seed}: the armour's place a jewel's`);
  }
});

// ---- the named pieces (REWARD-5) ----

test('QL3 a named piece is made FROM its base (AUDIT QUESTLINES REWARD-5): every sheet\'s named piece names a base of its kind; the card is that template, the name the sheet\'s, no metal before it; a holder who cannot wear the base gets the card unnamed (mutants: name never set; the base ignored; the fit skipped for the named card; the metal prefix kept)', () => {
  assert.equal(NAMED.length, 28, 'the questlines\' 28 named pieces');   // PIN MOVED (STAR8): the Thirteenth of Frostfall's three; PIN MOVED (AUDIT STAR8 T2): and the Heart-Star Ring; PIN MOVED (KETCH): and the Sky-Ketch's two - Bel-Tavir's Tuning-Charm, the Steersman's Hammer
  for (const { quest, named } of NAMED) {
    const base = namedBaseOf(named);
    assert.ok(base != null, `${quest} ${named.name}: base "${named.base}" is a ${named.kind} the roll makes`);
    assert.equal(templateByIndex(base).name, named.base);
    // a player who can wear it: the fighter for armour and jewels, a player whose best skill is the weapon's own for a weapon
    const wielder = named.kind !== 'weapon' ? FIGHTER : { ...FIGHTER, skills: skills({ [weaponSkillName(base)]: 80, Archery: 60 }) };
    for (let seed = 0; seed < 6; seed++) {
      const three = rollRewardChoice({ seed, level: 14, tier: 3, entity: wielder, named });
      const p = three.find((x) => x.named);
      assert.ok(p, `${quest} seed ${seed}: the named card`);
      assert.equal(p.kind, named.kind);
      assert.equal(p.item.templateIndex, base, `${quest}: ${named.name} is a ${named.base}`);
      assert.equal(p.item.name, named.name);
      assert.equal(itemLongName(p.item), named.name, 'a name of its own takes no metal before it');
      assert.deepEqual(itemFindings(p.item), [], 'lawful');
      assert.equal(three.filter((x) => x.named).length, 1, 'one card named');
    }
  }
  // a mage (no plate, no chain, no shield) and a Kite Shield's name: the armour card is the kind's own roll, unnamed
  const shield = { name: 'A Test Ward', kind: 'armor', base: 'Kite Shield' };
  for (let seed = 0; seed < 20; seed++) {
    const three = rollRewardChoice({ seed, level: 14, tier: 3, entity: MAGE, named: shield });
    assert.equal(three.some((x) => x.named || x.item.name === shield.name || x.item.qlNamed), false, `seed ${seed}: unnamed`);
    assert.equal(three.length, 3);
  }
  assert.equal(namedBaseOf({ name: 'x', kind: 'weapon', base: 'Helm' }), null, 'a base of another kind');
  assert.equal(namedBaseOf({ name: 'x', kind: 'weapon', base: 'Arrow' }), null, 'an arrow is no weapon the roll makes');
  assert.equal(namedBaseOf({ name: 'x', kind: 'jewel' }), null, 'no base');
});
const WEAPON_SKILL_NAMES = Object.freeze({ 113: 'ShortBlade', 114: 'ShortBlade', 115: 'BluntWeapon', 116: 'ShortBlade', 117: 'ShortBlade', 118: 'LongBlade', 119: 'LongBlade', 120: 'LongBlade', 121: 'LongBlade', 122: 'LongBlade', 123: 'LongBlade', 124: 'BluntWeapon', 125: 'BluntWeapon', 126: 'BluntWeapon', 127: 'Axe', 128: 'Axe', 129: 'Archery', 130: 'Archery' });
function weaponSkillName(templateIndex) { return WEAPON_SKILL_NAMES[templateIndex]; }

// ---- the layer over fixture quests: the named piece's life, the cap, the door ----

/** A quest-shaped fixture of `name` whose outcome `id`'s task holds: stamped, paid, a success. */
function endedQuest(name, outcomeId, uid) {
  const o = sheetFor(name).outcomes.find((x) => x.id === outcomeId);
  const task = (o.on.task ?? '').replace(/^_|_$/g, '');
  return {
    questName: name, uid, questStartTime: uid * 100, displayName: name, questComplete: false, questSuccess: true,
    tasks: new Map([[task, { getTriggerValue: () => true }]]), resources: new Map(), activeLogMessages: new Map(),
    hooks: {}, ql: { ...freshState(), tier: 3, paid: true },
  };
}
function fixtureLayer(over = {}) {
  const rec = { offers: [], dropped: [], taken: [], rep: [], legal: [] };
  const layer = createQuestlines({
    machine: { quests: new Map() },
    ctx: {
      playerEntity: FIGHTER, onQuestlineOffer: (o) => rec.offers.push(o), onOfferDropped: (o) => rec.dropped.push(o), offerReward: (_q, item) => rec.taken.push(item),
      changeReputation: (fid, amount, propagate) => rec.rep.push([fid, amount, propagate]), changeLegalRep: (amount) => rec.legal.push(amount), ...over,
    },
  });
  return { layer, rec };
}

test('QL3 an ending settles once and moves what its outcome names: standing (flat, each faction once) and the legal standing; a betrayal pays no piece; a failure is never struck done on a ladder; a reload never reuses an offer\'s id (DOC-7, DOC-12, DOC-13, DOC-14, DOC-11) (mutants: betrayal pays gear; the legal move dropped; the moved guard; history records a failure; nextOffer reset on restore)', () => {
  const { layer, rec } = fixtureLayer();
  const sold = endedQuest('N0B00Y09', 'sold', 1);
  assert.equal(layer.ending(sold), null, 'the Mages Guild\'s quest sold to the Brotherhood: no piece of the betrayed guild\'s');
  assert.equal(sold.ql.outcome, 'sold');
  assert.deepEqual(rec.rep.map(([, n, p]) => [n, p]), [[5, false], [-5, false]], 'each faction the sheet names, once, flat');
  assert.equal(layer.ending(sold), null);
  assert.equal(rec.rep.length, 2, 'a second end moves nothing');
  const released = endedQuest('B0B71Y03', 'released', 2);
  assert.ok(layer.ending(released), 'lesser: a choice');
  assert.deepEqual(rec.legal, [2], 'the legal standing, once');
  assert.equal(layer.ending(released), null);
  assert.deepEqual(rec.legal, [2]);
  assert.equal(rec.offers.length, 1, 'one choice for one quest');
  const lost = { ...endedQuest('M0B00Y06', 'done', 3), questSuccess: false, tasks: new Map(), ql: { ...freshState(), tier: 1 } };
  assert.equal(layer.ending(lost), null);
  assert.equal(lost.ql.outcome, 'failed');
  assert.equal(layer.history().M0B00Y06, undefined, 'a failure is no rung done');
  assert.equal(layer.history().B0B71Y03, 'released');
  // a reload's ids go on from the save's
  const { layer: two } = fixtureLayer();
  two.ending(endedQuest('M0B00Y06', 'done', 10));
  two.ending(endedQuest('M0B00Y06', 'done', 11));
  const { layer: next } = fixtureLayer();
  next.restore(two.snapshot());
  assert.deepEqual(next.offers().map((o) => o.id), [1, 2]);
  assert.equal(next.ending(endedQuest('M0B00Y06', 'done', 12)).id, 3);
});

test('QL3 a failure\'s standing obeys QFAIL-FREE (AUDIT QUESTLINES REWARD-14): online a quest that ends unfinished costs no faction anything, as quest.js\'s own -2 costs none; offline the sheet\'s cost stands (mutants: the failure\'s standing moved online)', () => {
  const failed = (uid, online) => ({ ...endedQuest('N0B20Y02', 'slain', uid), questSuccess: false, ql: { ...freshState(), tier: 2 }, hooks: { sharedClock: () => online } });
  const { layer, rec } = fixtureLayer();
  const q1 = failed(1, true);
  assert.equal(layer.ending(q1), null);
  assert.equal(q1.ql.outcome, 'slain', 'the outcome settles as ever');
  assert.deepEqual(rec.rep, [], 'online: the Mages Guild loses nothing for the talisman lost');
  const { layer: off, rec: offRec } = fixtureLayer();
  const q = failed(2, false);
  assert.equal(off.ending(q), null);
  assert.equal(q.ql.outcome, 'slain');
  assert.deepEqual(offRec.rep.map(([, n, p]) => [n, p]), [[-5, false]], 'offline: DFU\'s cost, the sheet\'s -5');
});

test('QL3 a named piece is spent when TAKEN, never when rolled (AUDIT QUESTLINES LINES-20): a second ending names nothing once it is taken; a card chosen instead leaves the name for a later ending; one waiting offer holds a line\'s name at a time (mutants: named every time; the name spent on take deleted)', () => {
  const { layer } = fixtureLayer();
  const first = layer.ending(endedQuest('QLWR04', 'mercy', 1));
  const named = first.pieces.find((p) => p.named);
  assert.ok(named, 'the first mercy names Corvane\'s blade');
  assert.equal(named.item.name, 'Corvane\'s Spire-Blade');
  assert.equal(layer.history()['named:QLWR04'], undefined, 'not spent by the roll');
  const waiting = layer.ending(endedQuest('QLWR04', 'mercy', 2));
  assert.equal(waiting.pieces.some((p) => p.named), false, 'a name a waiting offer holds is not rolled twice');
  layer.take(waiting.id, 2);   // the jewel of the second: no name spent
  assert.equal(layer.history()['named:QLWR04'], undefined);
  layer.take(first.id, first.pieces.indexOf(named));
  assert.equal(layer.history()['named:QLWR04'], 'Corvane\'s Spire-Blade', 'spent when taken');
  const later = layer.ending(endedQuest('QLWR04', 'mercy', 3));
  assert.equal(later.pieces.some((p) => p.named || p.item.qlNamed), false, 'once a character');
  // a card chosen instead of the named one: the name is the line's still
  const { layer: other } = fixtureLayer();
  const a = other.ending(endedQuest('QLWR04', 'truth', 4));
  const ai = a.pieces.findIndex((p) => !p.named);
  other.take(a.id, ai);
  assert.equal(other.history()['named:QLWR04'], undefined);
  assert.ok(other.ending(endedQuest('QLWR04', 'truth', 5)).pieces.some((p) => p.named), 'offered again');
});

test('QL3 the cap (OFFERS_MAX): the oldest offer naming no piece goes first and its going is said; a named one outlives twelve newer (AUDIT QUESTLINES LINES-20, REWARD-8) (mutants: the cap cuts the oldest whatever it holds; the dropped offer unsaid)', () => {
  const { layer, rec } = fixtureLayer();
  const named = layer.ending(endedQuest('QLWR04', 'mercy', 1));
  assert.ok(named.pieces.some((p) => p.named));
  const plain = [];
  for (let i = 0; i < OFFERS_MAX; i++) plain.push(layer.ending(endedQuest('M0B00Y06', 'done', 10 + i)));
  const ids = layer.offers().map((o) => o.id);
  assert.equal(ids.length, OFFERS_MAX);
  assert.ok(ids.includes(named.id), 'the named piece waits still');
  assert.equal(ids.includes(plain[0].id), false, 'the oldest plain one went');
  assert.deepEqual(rec.dropped.map((o) => o.id), [plain[0].id], 'and its going was said');
  // the cut itself, pure
  const list = Array.from({ length: OFFERS_MAX + 2 }, (_, i) => ({ id: i, pieces: [{ named: i === 0 || i === 2 }] }));
  assert.deepEqual(trimOffers(list).map((o) => o.id), [1, 3]);
  const all = Array.from({ length: OFFERS_MAX + 1 }, (_, i) => ({ id: i, pieces: [{ named: true }] }));
  assert.deepEqual(trimOffers(all).map((o) => o.id), [0], 'every one named: the oldest');
});

test('QL3 no door, no cut (AUDIT QUESTLINES REWARD-13): a host with no door for a taken piece lists nothing to take and takes nothing - the offer kept in the save; the door first, then the cut (mutants: the door\'s check deleted; the list shown doorless)', () => {
  const doorless = createQuestlines({ machine: { quests: new Map() }, ctx: { playerEntity: FIGHTER } });
  const offer = doorless.ending(endedQuest('M0B00Y06', 'done', 1));
  assert.ok(offer, 'the choice is rolled and kept');
  assert.deepEqual(doorless.offers(), [], 'nothing offered to take');
  assert.equal(doorless.take(offer.id, 0), null);
  assert.equal(doorless.snapshot().offers.length, 1, 'kept for a host that has the door');
  const { layer, rec } = fixtureLayer({ offerReward: () => { throw new Error('the pile could not be laid'); } });
  const o = layer.ending(endedQuest('M0B00Y06', 'done', 2));
  assert.throws(() => layer.take(o.id, 0));
  assert.equal(layer.offers().length, 1, 'a door that failed cut nothing');
  assert.equal(rec.taken.length, 0);
});

// ---- the gold settled at the end (REWARD-3) ----

test('QL3 the gold an ending settles (AUDIT QUESTLINES REWARD-3): M0B00Y16 pays at the questor\'s click and settles `rescued` (greater) on the walk home - in either order the player has x1.25, the rest added at the end, and said; a save between keeps the record (mutants: the settle deleted; the record not saved)', () => {
  for (const order of ['escort first', 'claim first']) {
    const r = giant(order);
    assert.equal(r.quest.ql.outcome, 'rescued', order);
    assert.equal(r.purse + r.added.reduce((n, x) => n + x, 0), Math.round(r.minted * 1.25), `${order}: x1.25 in all`);
    if (r.added.length) assert.ok(r.hud.includes(`You receive ${r.added[0]} more gold pieces for how it ended.`), 'said');
    assert.equal(r.offers.length, 1);
    assert.equal(r.offers[0].tier, 2, 'tier 1 a rung up');
  }
  const late = giant('claim first');
  assert.equal(late.purse, late.minted, 'paid at x1 by `done`, the outcome readable at the click');
  assert.equal(late.added.length, 1, 'the difference added once');
  const kept = giant('claim first', { reload: true });
  assert.equal(kept.quest.ql.outcome, 'rescued');
  assert.equal(kept.purse + kept.added.reduce((n, x) => n + x, 0), Math.round(kept.minted * 1.25), 'settled after a load');
});

test('QL3 the gold still owed, pure: the settled outcome\'s factor above the one applied, a party\'s share of it; never below, never a failure\'s, never `none`\'s (REWARD-3) (mutants: gold taken back; the party\'s shares ignored)', () => {
  const paid = { base: 400, factor: 1, shares: 1 };
  assert.equal(goldStillOwed(paid, { pay: 'greater' }), 100);
  assert.equal(goldStillOwed(paid, { pay: 'standard' }), 0);
  assert.equal(goldStillOwed({ base: 400, factor: 1.25, shares: 1 }, { pay: 'lesser' }), 0, 'never taken back');
  assert.equal(goldStillOwed({ base: 400, factor: 0.75, shares: 1 }, { pay: 'none' }), 0, 'an ending that pays nothing adds nothing');
  assert.equal(goldStillOwed(paid, { pay: 'greater', failure: true }), 0);
  assert.equal(goldStillOwed({ base: 400, factor: 1, shares: 2 }, { pay: 'greater' }), 50, 'a share: 250 - 200');
  assert.equal(goldStillOwed(null, { pay: 'greater' }), 0, 'nothing paid, nothing owed');
});

test('QL3 a party\'s share is named after the scale (AUDIT QUESTLINES REWARD-11): QLWR04\'s mercy in a party of two - the HUD names the purse the pile holds (mutants: the split before the scale)', () => {
  const { bridge, rec, start, tick } = packBridge({ entity: { ...FIGHTER, level: 20 }, over: { partySize: () => 2 } });
  const q = start('QLWR04');
  for (const t of q.tasks.values()) for (const a of t.actions) if (a.typeName === 'PlaceNpc') a.isComplete = true;
  bridge.machine.markQuestShared('QLWR04');
  // PIN MOVED (QUEST-AUDIT III GOLD-HOLDERS, machine.js rewardShares): the shares are the copies held, not the party's
  // size - the partner's answer (its envelope of the copy) names it a holder before the split is two
  bridge.machine.noteShareHolder('QLWR04', 'acct-b');
  const minted = q.getItem({ name: 'gold' }).daggerfallUnityItem.stackCount;
  q.getTask({ name: 'tomercy' }).start(); tick(6);
  const pile = rec.rewards.find((i) => i.group === 'Currency');
  assert.equal(pile.stackCount, Math.floor(Math.round(minted * 1.25) / 2), 'scaled, then halved');
  assert.deepEqual(rec.hud.filter((h) => /share/.test(h)), [`Your share of the party's reward: ${pile.stackCount} gold.`]);
});

// ---- standing (REWARD-12) ----

test('QL3 a faction by its Quests-Factions name is an INDIVIDUAL row only (AUDIT QUESTLINES REWARD-12): never an occupation, a kind or a local group; every shipped sheet\'s name resolves (mutants: p2 read as an id)', () => {
  assert.equal(factionIdOf('Mehrunes_Dagon'), 2);
  for (const n of ['Noble', 'Questor', 'Smith', 'God', 'Local_3.1', 'Group_7.2', 'Default', 'The_Nosuch_Guild']) assert.equal(factionIdOf(n), null, n);
  for (const sheet of SHEETS.values()) for (const o of sheet.outcomes ?? []) for (const name of Object.keys(o.standing ?? {})) assert.ok(factionIdOf(name) != null, `${sheet.quest}.${o.id}: ${name}`);
});

// ---- the row (REWARD-6, LAW-10, LAW-11) ----

test('QL3 the row says whether the quest can pay gear (AUDIT QUESTLINES REWARD-6/LAW-3): a guild quest that gives gold yes; a Prince\'s summoning, a cure, and the main quest\'s steps whose scripts never pay, no (mutants: the script\'s pay not read; the sheet\'s gear not read)', () => {
  const { bridge, start } = packBridge();
  const gear = (name) => bridge.questlines.rowOf(start(name)).gear;
  assert.equal(gear('M0B00Y06'), true);
  assert.equal(gear('M0B00Y16'), true);
  for (const name of ['40C00Y00', '$CUREWER', 'S0000008', 'S0000016', '_BRISIEN', 'S0000977']) assert.equal(gear(name), false, name);
});

test('QL3 the row\'s gear reads the script: a running quest whose sheet pays gear promises it only over a script that can pay - a `give pc` of no letter, `give pc nothing`, `ql paid`, `train pc` (REWARD-6) (mutants: the script\'s pay not read)', () => {
  const { layer } = fixtureLayer();
  const running = (uid, actions, item = null) => ({
    ...endedQuest('M0B00Y06', 'done', uid), questSuccess: false, ql: { ...freshState(), tier: 1 },
    tasks: new Map([['S.02', { getTriggerValue: () => false, actions }]]), getItem: () => item,
  });
  assert.equal(layer.rowOf(running(1, [])).gear, false, 'no payer: no promise');
  assert.equal(layer.rowOf(running(2, [{ typeName: 'GivePc', itemSymbol: { name: 'letter' } }], { itemName: 'letter' })).gear, false, 'a letter is no pay');
  assert.equal(layer.rowOf(running(3, [{ typeName: 'GivePc', itemSymbol: { name: 'gold' } }], { itemName: 'gold' })).gear, true);
  assert.equal(layer.rowOf(running(4, [{ typeName: 'GivePc', isNothing: true }])).gear, true);
  assert.equal(layer.rowOf(running(5, [{ typeName: 'QlPaid' }])).gear, true);
  assert.equal(layer.rowOf(running(6, [{ typeName: 'TrainPc' }])).gear, true);
  assert.equal(layer.rowOf({ ...running(7, []), ql: { ...freshState(), tier: 1, paid: true } }).gear, true, 'paid already');
});

test('QL3 a sheet\'s lines are keyed by kind (AUDIT QUESTLINES LAW-10): no two lines of one sheet share a translation key, and the row reads each by its own (mutants: the kind dropped from the key)', () => {
  for (const sheet of SHEETS.values()) {
    const keys = [
      ...(sheet.objectives ?? []).map((o) => sheetTextKey(sheet, 'o', o.id)),
      ...(sheet.outcomes ?? []).map((o) => sheetTextKey(sheet, 'r', o.id)),
      ...(sheet.branches ?? []).flatMap((b) => [sheetTextKey(sheet, 'b', b.id), ...(b.choices ?? []).map((c) => sheetTextKey(sheet, 'b', b.id, c.id))]),
    ];
    assert.equal(new Set(keys).size, keys.length, `${sheet.quest}: ${keys.filter((k, i) => keys.indexOf(k) !== i).join(', ')}`);
  }
  assert.equal(sheetTextKey({ quest: 'A0C10Y05' }, 'o', 'wed'), 'A0C10Y05.o.wed');
  const { bridge, start, tick } = packBridge();
  const q = start('M0B00Y06');
  q.getTask({ name: 'mondead' }).start(); tick(1);
  const asked = [];
  bridge.questlines.rowOf(q, (_q, text, key) => { asked.push(key); return text; });
  assert.deepEqual(asked, ['M0B00Y06.o.slay', 'M0B00Y06.o.report']);
});

test('QL3 the journal\'s row is kept while what it reads stands (AUDIT QUESTLINES LAW-11): the same row again; a new one when an objective moves, a pack lays a line\'s words, the read changes (mutants: the row never kept; the states left out of its key; the text core\'s revision left out)', () => {
  const { bridge, start, tick } = packBridge();
  const q = start('M0B00Y06');
  const read = (_q, text) => text;
  const a = bridge.questlines.rowOf(q, read);
  assert.equal(bridge.questlines.rowOf(q, read), a, 'kept');
  q.getTask({ name: 'mondead' }).start(); tick(1);
  const b = bridge.questlines.rowOf(q, read);
  assert.notEqual(b, a, 'an objective done: read again');
  assert.deepEqual(b.objectives.map((o) => [o.id, o.state]), [['slay', 'done'], ['report', 'open']]);
  const quiet = (_q, text, key) => (key === 'M0B00Y06.o.report' ? 'Report back' : text);
  assert.equal(bridge.questlines.rowOf(q, quiet).objectives[1].text, 'Report back', 'another read: read again');
  const words = bridge.questlines.rowOf(q, quietText);
  assert.equal(bridge.questlines.rowOf(q, quietText), words, 'the quiet read, kept');
  patchLocaleTable(currentLocale(), runtimeCollectionName(TextCollections.TextQuests), [['QL.M0B00Y06.o.report', 'Report to the Guild (laid by a pack)']]);
  const laid = bridge.questlines.rowOf(q, quietText);
  assert.notEqual(laid, words, 'a pack laid: read again');
  assert.equal(laid.objectives[1].text, 'Report to the Guild (laid by a pack)');
});
