// G2: the variant-keyed guilds (Temple's eight divines, KnightlyOrder's
// ten orders) and the join decision. The variant tables ARE faction
// ids, so most of these pin against the real FACTION.TXT - a wrong id
// reads reputation 0 forever and every member sits at rank 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIVINES, ORDERS, TEMPLE_DATA, TEMPLE_TEXT, KNIGHTLY_TEXT,
  templeOf, orderOf, getDivine, getOrder,
} from '../src/systems/guildVariants.js';
import {
  GUILDS, INVITATION_ONLY, isJoinableByApplication, joinDecision,
  calculateNewRank, isEligibleToJoin,
} from '../src/systems/guilds.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { FactionFile, FACTION_TYPES, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { SKILLS } from '../src/systems/skills.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const realFactions = () => {
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  return ff.factionDict;
};
const storeFor = (guild, rep) => {
  const dict = new Map([[guild.factionId, { id: guild.factionId, parent: 0, rep: 0, flags: 0,
    power: 50, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
    children: null, type: 0, ggroup: 0 }]]);
  const store = createFactionRep(dict);
  setReputation(store, guild.factionId, rep);
  return store;
};
const withSkills = (guild, v, over = {}) => {
  const skills = {};
  for (const s of guild.skills) skills[s] = v;
  return { name: 'Tester', skills: Object.assign(skills, over) };
};

test('variants: eight divines and ten orders, and their enum value IS the faction id', () => {
  assert.equal(Object.keys(DIVINES).length, 8);
  assert.equal(Object.keys(ORDERS).length, 10);
  assert.deepEqual(DIVINES, { Akatosh: 26, Arkay: 21, Dibella: 29, Julianos: 27,
    Kynareth: 35, Mara: 24, Stendarr: 33, Zenithar: 22 });
  assert.deepEqual(ORDERS, { Horn: 411, Dragon: 368, Flame: 410, Hawk: 417, Owl: 413,
    Rose: 409, Wheel: 415, Candle: 408, Raven: 414, Scarab: 416 });
  assert.equal(new Set(Object.values(DIVINES)).size, 8, 'no divine shares a faction');
  assert.equal(new Set(Object.values(ORDERS)).size, 10, 'no order shares a faction');
});

test('variants: every divine is a GOD in the real data, with its templar order as its child', { skip: skipReal }, () => {
  // This is also why S25's propagation has a God branch at all: a
  // temple's reputation walks to its divine root and then to Generic
  // Temple.
  const dict = realFactions();
  for (const [name, id] of Object.entries(DIVINES)) {
    const f = dict.get(id);
    assert.ok(f, `${name}: faction ${id} is not in FACTION.TXT`);
    assert.equal(f.type, FACTION_TYPES.God, `${name} (${id}) must be type God`);
    assert.equal((f.children ?? []).length, 1, `${name} has exactly one child - its templar order`);
  }
  // Zenithar's faction NAME is "Zen" in the shipped file - a data
  // quirk, not a lookup failure.
  assert.equal(dict.get(DIVINES.Zenithar).name, 'Zen');
});

test('variants: every knightly order is ggroup KnightlyOrder in the real data', { skip: skipReal }, () => {
  const dict = realFactions();
  for (const [name, id] of Object.entries(ORDERS)) {
    const f = dict.get(id);
    assert.ok(f, `${name}: faction ${id} is not in FACTION.TXT`);
    assert.equal(f.ggroup, GUILD_GROUPS.KnightlyOrder, `${name} (${id}) must be ggroup 9`);
  }
});

test('variants: GetDivine takes the temple hall OR the templar order', { skip: skipReal }, () => {
  const dict = realFactions();
  for (const [name, id] of Object.entries(DIVINES)) {
    assert.equal(getDivine(dict, id), name, `${name}'s own faction resolves`);
    const child = dict.get(id).children[0];
    assert.equal(getDivine(dict, child), name,
      `${name}'s templar order (${child}, ${dict.get(child).name}) resolves through its parent`);
  }
  assert.equal(getDivine(dict, 999999), null, 'DFU throws here; the port returns null');
  assert.equal(getDivine(dict, GUILDS.FightersGuild.factionId), null, 'a non-temple guild is not a divine');
});

test('variants: GetOrder does NOT walk a parent - only the ten orders resolve', { skip: skipReal }, () => {
  const dict = realFactions();
  for (const [name, id] of Object.entries(ORDERS)) assert.equal(getOrder(id), name);
  // an order's PARENT is a region/court, and must not resolve
  const parent = dict.get(ORDERS.Rose).parent;
  assert.ok(parent, 'the Rose has a parent');
  assert.equal(getOrder(parent), null, 'the parent walk is Temple-only');
  assert.equal(getOrder(999999), null);
});

test('variants: a temple carries its OWN skills and its own welcome, the orders share one list', () => {
  const arkay = templeOf('Arkay');
  const mara = templeOf('Mara');
  assert.notDeepEqual(arkay.skills, mara.skills, 'each divine asks for different skills');
  assert.equal(arkay.text.welcome, TEMPLE_DATA.Arkay.welcome);
  assert.equal(mara.text.welcome, TEMPLE_DATA.Mara.welcome);
  assert.notEqual(arkay.text.welcome, mara.text.welcome);
  assert.equal(arkay.text.ineligibleBadRep, TEMPLE_TEXT.ineligibleBadRep, 'but the refusals are shared');

  const rose = orderOf('Rose');
  const owl = orderOf('Owl');
  assert.deepEqual(rose.skills, owl.skills, 'the ten orders share ONE skill list');
  assert.equal(rose.text.welcome, owl.text.welcome, 'and one message set');
  assert.notEqual(rose.factionId, owl.factionId, 'they differ by faction');

  assert.equal(templeOf('Talos'), null, 'not a divine');
  assert.equal(orderOf('Pigeon'), null, 'not an order');
});

test('variants: TEMPLE_DATA is the whole RankData row, service columns included', () => {
  // Ported whole so the table cannot drift across two slices. The
  // service ranks have no reader yet; -1 means the service never opens.
  for (const [name, d] of Object.entries(TEMPLE_DATA)) {
    for (const k of ['library', 'healing', 'buyPotions', 'makePotions', 'buyMagic',
      'makeMagic', 'buySpells', 'makeSpells', 'soulGems', 'summoning',
      'welcome', 'promotion', 'templeName', 'blessing']) {
      assert.equal(typeof d[k], 'number', `${name}.${k}`);
    }
    assert.ok(d.summoning >= 6 && d.summoning <= 8, `${name}: summoning is the highest-rank service`);
  }
  assert.equal(TEMPLE_DATA.Arkay.blessing, 0, "Arkay's blessing id really is 0 - verbatim");
  assert.equal(TEMPLE_DATA.Julianos.welcome, 6610, 'Julianos alone welcomes on 6610');
  assert.equal(TEMPLE_DATA.Julianos.buyMagic, 3, 'and alone sells magic items');
  assert.equal(TEMPLE_DATA.Kynareth.buySpells, 3, 'Kynareth alone sells spells');
});

test('variants: a temple and an order run the SAME rank law as any guild', () => {
  const t = templeOf('Stendarr');
  assert.equal(calculateNewRank(withSkills(t, 100), t, storeFor(t, 90)), 9);
  assert.equal(calculateNewRank(withSkills(t, 3), t, storeFor(t, 90)), -1);
  const o = orderOf('Candle');
  assert.equal(calculateNewRank(withSkills(o, 100), o, storeFor(o, 40)), 4,
    'reputation 40 clears rows 0-4 and fails row 5');
});

test('guilds: the join decision routes bad-rep and low-skill to DIFFERENT records', () => {
  // A player refused for the wrong reason has been told to fix the
  // wrong thing, and the two are different TEXT.RSC records.
  const g = GUILDS.FightersGuild;
  const bad = joinDecision(withSkills(g, 100), g, storeFor(g, -1));
  assert.deepEqual(bad, { eligible: false, reason: 'reputation', textId: g.text.ineligibleBadRep });

  const unskilled = joinDecision(withSkills(g, 3), g, storeFor(g, 0));
  assert.deepEqual(unskilled, { eligible: false, reason: 'skill', textId: g.text.ineligibleLowSkill });
  assert.notEqual(g.text.ineligibleBadRep, g.text.ineligibleLowSkill, 'and they ARE different records');

  const ok = joinDecision(withSkills(g, 100), g, storeFor(g, 0));
  assert.deepEqual(ok, { eligible: true, textId: g.text.eligible });

  // and it agrees with isEligibleToJoin everywhere
  for (const rep of [-5, 0, 50]) {
    for (const v of [0, 4, 22, 100]) {
      const e = withSkills(g, v);
      assert.equal(joinDecision(e, g, storeFor(g, rep)).eligible,
        isEligibleToJoin(e, g, storeFor(g, rep)), `rep ${rep}, skills ${v}`);
    }
  }
});

test('guilds: the Thieves Guild and the Dark Brotherhood cannot be ASKED to join', () => {
  // ThievesGuild.cs :180-187 and DarkBrotherhood.cs :189-196 both throw
  // NotImplementedException from the eligibility messages - both are
  // joined by INVITATION, through a quest. A law, not an omission.
  assert.deepEqual([...INVITATION_ONLY], ['ThievesGuild', 'DarkBrotherhood']);
  for (const name of INVITATION_ONLY) {
    const g = GUILDS[name];
    assert.equal(isJoinableByApplication(g), false, `${name} has no walk-in application`);
    assert.equal(joinDecision(withSkills(g, 100), g, storeFor(g, 90)), null,
      `${name} refuses the question even from a perfect candidate`);
    assert.equal(g.text.eligible, undefined, 'and carries no eligibility record to show');
  }
  for (const name of ['FightersGuild', 'MagesGuild']) {
    assert.equal(isJoinableByApplication(GUILDS[name]), true);
    assert.ok(GUILDS[name].text.eligible, `${name} has an eligibility record`);
  }
  assert.equal(isJoinableByApplication(templeOf('Mara')), true, 'a temple can be asked');
  assert.equal(isJoinableByApplication(orderOf('Hawk')), true, 'so can an order');
});

test('variants: every variant guild skill is a real skill id', () => {
  const ids = new Set(Object.values(SKILLS));
  for (const d of Object.keys(DIVINES)) {
    const t = templeOf(d);
    assert.ok(t.skills.length >= 7, `${d} has its skill list`);
    for (const s of t.skills) assert.ok(s !== undefined && ids.has(s), `${d}: a skill is not a SKILLS member`);
    assert.equal(new Set(t.skills).size, t.skills.length, `${d}: no skill listed twice`);
  }
  const o = orderOf('Horn');
  for (const s of o.skills) assert.ok(s !== undefined && ids.has(s), 'order skill');
  assert.equal(o.skills.length, 7);
});
