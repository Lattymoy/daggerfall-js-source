// QUEST-AUDIT III (2026-10-23, the owner: "Can you do a detailed quest audit, fix any and all outstanding issues. Do not
// worry about DFU parity."; bible/01-Overview/audits/Quest-Audit-III.md). The audit's fixes to the quest ACTIONS and the
// MACROS, each pinned here (questaudit3.test.js holds the machine's):
//
// - SEND-HELD: a `send` wave due outside a town waits for one (CreateFoe._tryPlacement) and raises no encounter while it
//   waits (actions.js CreateFoe.update) - S0000021's zombies broke every rest and every journey out of town.
// - GOLD-ONCE: a quest's gold Item pays its holder once (actions.js GetItem / GivePc, item.js `goldPaid`, saved) -
//   S0000009's `get item` set again every dusk, N0B21Y14's `get item _gold_` then `give pc _gold_`.
// - MUTE-HELD: an `until _x_ performed:` body's re-arm keeps its mute (actions.js MuteNpc.rearmAction({persist}),
//   task.js) - S0000018's Gortwog took the click its mute held him behind.
// - ILL-SAYING: `make pc ill with X saying N` shows N (actions.js MakePcDiseased) - S0000007's 1027.
// - DOTTED-SYMBOLS: a symbol with a dot or a dash reads whole in DialogLink, AddDialog, PlaceNpc, PcAt, RevealLocation
//   and CreateNpcAt (M0B11Y18's `pc at _L.00_` is the coverage pins' - questmachine.test.js, auditquests_linkage.test.js).
// - CLIMATE-NAMES: each climate name binds its own climate (desert2's and mountainwoods's order is questactions5.test.js's
//   and foragefix.test.js's).
// - CAST-SHARE: a `cast X spell do` copy received headless reads its effects from its own world (actions.js CastSpellDo),
//   and the share takes a partner's effects as the holder's own stand (shareActions.js holders).
// - JOKE-MACROS: %jok's joke reads its own %ra, %nt, %cn, %cn2 (questMacros.js).
// - DI-UNREF: %di with nothing referenced reads where the quest's last placed Person stands (questMacros.js direction;
//   nothing at all is questmacros.test.js's "...never mind...").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { DialogLink, AddDialog, PlaceNpc, PcAt, RevealLocation, CreateNpcAt, ClimateCondition } from '../../../src/systems/quest/actions.js';
import { sharedActionMatches } from '../../../src/systems/quest/shareActions.js';
import { prepareQuestShare, receiveSharedQuest } from '../../../src/systems/quest/questShare.js';
import { getMacroValue, getContextValue } from '../../../src/systems/quest/questMacros.js';
import { TextRsc } from '../../../src/formats/textRsc.js';
import { packMachine, questSource } from '../../qlSources.mjs';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const quiet = (fn) => {
  const w = console.warn, l = console.log;
  console.warn = () => {}; console.log = () => {};
  try { return fn(); } finally { console.warn = w; console.log = l; }
};
const HEADER = (name) => [`Quest: ${name}`, 'QRC:', 'QuestComplete:  [1004]', ' done', '', 'Message:  1011', ' x', '',
  'Message:  1027', ' You feel a sickening jolt.', '', 'QBN:'];
const popupText = (tokens) => tokens.map((t) => t.text ?? '').join('').trim();

// ---- SEND-HELD ----

/** A quest whose one task holds `line`, over a world that places every foe at once and counts the encounters raised. */
function waveRig(line) {
  const clock = { t: 1e6 };
  const seen = { inTown: false, encounters: 0, placed: 0 };
  const world = {
    createFoeGameObjects: (foe, n) => Array.from({ length: n }, () => ({ foe })),
    tryPlaceFoe: () => { seen.placed++; return true; },
    isPlayerInLocationRect: () => seen.inTown,
    raiseOnEncounterEvent: () => { seen.encounters++; },
  };
  const m = new QuestMachine({ nowSeconds: () => clock.t, world });
  const q = m.scheduleQuest([...HEADER('__QA3S'), 'Foe _zombie_ is Zombie', '', '_wave_ task:', ` ${line}`, '', 'variable _pad_'], 0, { rolls: () => 0.5 });
  m.tick();
  q.getTask({ name: 'wave' }).start();
  /** n ticks, two of the character's minutes apart (a wave every minute is due at each) */
  const steps = (n) => { for (let i = 0; i < n; i++) { clock.t += 120; m.tick(); } };
  return { seen, steps, wave: q.getTask({ name: 'wave' }).actions[0] };
}

test('SEND-HELD: a `send` wave due outside a town is held - no encounter raised, so no rest broken and no journey stopped - and lands, encounter and all, once the player is in one; a `create foe` wave is not held (mutants: the hold, its send test)', () => {
  const send = waveRig('send _zombie_ every 1 minutes with 100% success');
  send.steps(20);
  assert.equal(send.wave.isSendAction, true);
  assert.equal(send.wave.spawnInProgress, true, 'the wave is due, and waits for a town');
  assert.deepEqual([send.seen.encounters, send.seen.placed], [0, 0], 'forty minutes out of town: nothing raised, nothing placed');
  send.seen.inTown = true;
  send.steps(1);
  assert.deepEqual([send.seen.encounters, send.seen.placed], [1, 1], 'in town: the foe placed and its encounter raised');
  const foe = waveRig('create foe _zombie_ every 1 minutes indefinitely with 100% success');
  foe.steps(20);
  assert.equal(foe.wave.isSendAction, false);
  assert.ok(foe.seen.encounters >= 5 && foe.seen.placed === foe.seen.encounters, `a created foe comes out of town too - ${JSON.stringify(foe.seen)}`);
});

// ---- GOLD-ONCE ----

const GOLD_LINES = [...HEADER('__QA3G'), 'Item _gold_ gold', 'Item _ruby_ ruby', '',
  '_get_ task:', ' get item _gold_', '', '_give_ task:', ' give pc _gold_', '', '_gem_ task:', ' give pc _ruby_', '', 'variable _pad_'];
function goldRig() {
  const calls = [];
  const deps = {
    nowSeconds: () => 1e6,
    addGold: (n) => calls.push(['addGold', n]),
    offerReward: (q, it) => calls.push(['offerReward', it?.stackCount ?? null]),
    questReward: (q, it) => calls.push(['questReward', it?.stackCount ?? null]),
    showPopup: (q, tokens) => calls.push(['popup', popupText(tokens)]),
    getQuestSourceLines: () => null,
  };
  const of = (name) => calls.filter((c) => c[0] === name);
  return { calls, of, mk: () => new QuestMachine(deps) };
}
/** Set a task again, as a clear and a set do (a `when` gone false and true again: its actions re-armed). */
const fireAgain = (m, q, name) => { q.getTask({ name }).clear(); q.getTask({ name }).start(); m.tick(); };
const goldSaved = (m, sym) => JSON.parse(JSON.stringify(m.getSaveData())).quests[0].resources.find((r) => r.symbol?.original === sym).resourceSpecific;

test('GOLD-ONCE: a quest\'s gold Item pays its holder once - a `get item` set again (S0000009\'s, every dusk) pays nothing more, nor after a save and a load; the `give pc` of it after (N0B21Y14\'s) stands the QuestComplete box with no second purse (mutants: the get\'s guard, its mark, the give\'s guard, its box, the save, the load)', () => {
  const rig = goldRig();
  const m = rig.mk();
  const q = m.scheduleQuest(GOLD_LINES, 0, { rolls: () => 0.5 });
  m.tick();
  const amount = q.getItem({ name: 'gold' }).daggerfallUnityItem.stackCount;
  assert.ok(amount > 0);
  q.getTask({ name: 'get' }).start(); m.tick();
  assert.deepEqual(rig.of('addGold'), [['addGold', amount]]);
  fireAgain(m, q, 'get');
  fireAgain(m, q, 'get');
  assert.deepEqual(rig.of('addGold'), [['addGold', amount]], 'set again and again: paid once');
  assert.equal(goldSaved(m, '_gold_').goldPaid, true, 'the save says it was paid');
  const back = rig.mk();
  back.restoreSaveData(JSON.parse(JSON.stringify(m.getSaveData())));
  const q2 = back.getQuest(q.uid);
  assert.equal(q2.getItem({ name: 'gold' }).goldPaid, true, 'the load reads it');
  fireAgain(back, q2, 'get');
  assert.deepEqual(rig.of('addGold'), [['addGold', amount]], 'after a load: still once');
  rig.calls.length = 0;
  q2.getTask({ name: 'give' }).start(); back.tick();
  assert.deepEqual(rig.calls, [['questReward', null], ['popup', 'done']], 'the QuestComplete box, and no pile to take');
  assert.equal(q2.questSuccess, true);
});

test('GOLD-ONCE, the other way: gold `give pc` offered is paid - a `get item` of the same pile after pays nothing; a pile never paid, and an item that is not gold, save no mark (mutants: the give\'s mark, the mark\'s gold test, the mark written only once paid)', () => {
  const rig = goldRig();
  const m = rig.mk();
  const q = m.scheduleQuest(GOLD_LINES, 0, { rolls: () => 0.5 });
  m.tick();
  const amount = q.getItem({ name: 'gold' }).daggerfallUnityItem.stackCount;
  assert.equal(Object.hasOwn(goldSaved(m, '_gold_'), 'goldPaid'), false, 'unpaid: the save is as it was');
  q.getTask({ name: 'give' }).start(); m.tick();
  assert.deepEqual(rig.of('offerReward'), [['offerReward', amount]], 'the pile offered');
  q.getTask({ name: 'get' }).start(); m.tick();
  assert.deepEqual(rig.of('addGold'), [], 'offered once: not paid again');
  q.getTask({ name: 'gem' }).start(); m.tick();
  assert.equal(rig.of('offerReward').length, 2, 'the ruby offered');
  assert.equal(q.getItem({ name: 'ruby' }).goldPaid, undefined);
  assert.equal(Object.hasOwn(goldSaved(m, '_ruby_'), 'goldPaid'), false, 'a ruby is no purse');
});

// ---- MUTE-HELD ----

test('MUTE-HELD: an `until _x_ performed:` body\'s mute holds between ticks, where a click lands - refused - and lifts when its target is performed (mutants: the persisting re-arm, the task\'s word, its pass-through, the default)', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = m.scheduleQuest([...HEADER('__QA3M'), 'Person _pp_ group Questor', '', '_gate_ task:', ' clicked npc _pp_', '',
    'until _open_ performed:', ' mute npc _pp_', '', 'variable _open_'], 0, { rolls: () => 0.4 });
  m.tick(); m.tick();
  const person = q.getResource({ name: 'pp' });
  assert.equal(person.isMuted, true, 'between ticks: muted');
  quiet(() => person.setPlayerClicked());
  assert.equal(person.hasPlayerClicked, false, 'the click refused');
  m.tick();
  assert.equal(q.getTask({ name: 'gate' }).getTriggerValue(), false, 'S0000018\'s gate stays shut');
  assert.equal(person.isMuted, true);
  q.getTask({ name: 'open' }).start();
  m.tick();
  assert.equal(person.isMuted, false, 'its target performed: the task clears, and the clear unmutes');
  person.setPlayerClicked();
  m.tick();
  assert.equal(q.getTask({ name: 'gate' }).getTriggerValue(), true, 'and the click is heard');
});

// ---- ILL-SAYING ----

test('ILL-SAYING: `make pc ill with X saying N` makes the player ill and shows N (S0000007\'s 1027), saves N, and the bare form still parses and says nothing (mutants: the saying read, made required, taken, shown, saved)', () => {
  const calls = [];
  const deps = { nowSeconds: () => 0, makePcDiseased: (d) => calls.push(['ill', d]), showPopup: (q, tokens) => calls.push(['popup', popupText(tokens)]), getQuestSourceLines: () => null };
  const m = new QuestMachine(deps);
  const q = m.scheduleQuest([...HEADER('__QA3I'), '_curse_ task:', " make pc ill with Caliron's_Curse saying 1027", '',
    '_plague_ task:', ' make pc ill with Plague', '', 'variable _pad_'], 0, { rolls: () => 0.4 });
  m.tick();
  const [curse] = q.getTask({ name: 'curse' }).actions, [plague] = q.getTask({ name: 'plague' }).actions;
  assert.deepEqual([curse?.typeName, curse?.diseaseType, curse?.textId], ['MakePcDiseased', 7, 1027]);
  assert.deepEqual([plague?.typeName, plague?.diseaseType, plague?.textId], ['MakePcDiseased', 1, 0]);
  q.getTask({ name: 'curse' }).start(); m.tick();
  assert.deepEqual(calls, [['ill', 7], ['popup', 'You feel a sickening jolt.']]);
  q.getTask({ name: 'plague' }).start(); m.tick();
  assert.deepEqual(calls.slice(2), [['ill', 1]], 'no saying, no word');
  const back = new QuestMachine(deps);
  back.restoreSaveData(JSON.parse(JSON.stringify(m.getSaveData())));
  assert.equal(back.getQuest(q.uid).getTask({ name: 'curse' }).actions[0].textId, 1027, 'the saying rides the save');
});

// ---- DOTTED-SYMBOLS ----

/** An action's fields, each symbol by its original. */
const fields = (a, keys) => (a ? keys.map((k) => (a[k] && typeof a[k] === 'object' ? a[k].original : a[k] ?? null)) : null);
const L = '_L.01_', P = '_P-02_', I = '_I.03_', S = '_S.04_';
const LINKS = ['placeSymbol', 'npcSymbol', 'itemSymbol'];

test('DOTTED-SYMBOLS: every arm of DialogLink, AddDialog, PlaceNpc, PcAt, RevealLocation and CreateNpcAt reads a symbol with a dot or a dash whole - `\\w+` read `_L.01_` as `_L`, or fell through to a shorter arm (mutants: each arm)', () => {
  const cases = [
    [DialogLink, `dialog link for location ${L} person ${P} item ${I}`, LINKS, [L, P, I]],
    [DialogLink, `dialog link for location ${L} person ${P}`, LINKS, [L, P, null]],
    [DialogLink, `dialog link for location ${L} item ${I}`, LINKS, [L, null, I]],
    [DialogLink, `dialog link for location ${L}`, LINKS, [L, null, null]],
    [DialogLink, `dialog link for person ${P} item ${I}`, LINKS, [null, P, I]],
    [DialogLink, `dialog link for person ${P}`, LINKS, [null, P, null]],
    [DialogLink, `dialog link for item ${I}`, LINKS, [null, null, I]],
    [AddDialog, `add dialog for location ${L} person ${P} item ${I}`, LINKS, [L, P, I]],
    [AddDialog, `add dialog for person ${P} item ${I}`, LINKS, [null, P, I]],
    [AddDialog, `add dialog for location ${L} person ${P}`, LINKS, [L, P, null]],
    [AddDialog, `add dialog for location ${L} item ${I}`, LINKS, [L, null, I]],
    [AddDialog, `add dialog for location ${L}`, LINKS, [L, null, null]],
    [AddDialog, `add dialog for person ${P}`, LINKS, [null, P, null]],
    [AddDialog, `add dialog for item ${I}`, LINKS, [null, null, I]],
    [PlaceNpc, `place npc ${P} at ${L} marker 3`, ['npcSymbol', 'placeSymbol', 'marker'], [P, L, 3]],
    [PlaceNpc, `place npc ${P} at ${L}`, ['npcSymbol', 'placeSymbol', 'marker'], [P, L, -1]],
    [PcAt, `pc at ${L} set ${S} saying 1011`, ['placeSymbol', 'taskSymbol', 'textId'], [L, S, 1011]],
    [PcAt, `pc at ${L} set ${S}`, ['placeSymbol', 'taskSymbol', 'textId'], [L, S, 0]],
    [PcAt, `pc at ${L} do ${S} saying 1012`, ['placeSymbol', 'taskSymbol', 'textId'], [L, S, 1012]],
    [PcAt, `pc at ${L} do ${S}`, ['placeSymbol', 'taskSymbol', 'textId'], [L, S, 0]],
    [RevealLocation, `reveal ${L} readmap`, ['placeSymbol', 'readMap'], [L, true]],
    [RevealLocation, `reveal ${L}`, ['placeSymbol', 'readMap'], [L, false]],
    [CreateNpcAt, `create npc at ${L}`, ['placeSymbol'], [L]],
  ];
  for (const [Act, line, keys, want] of cases) assert.deepEqual(fields(new Act(null).createNew(line, null), keys), want, line);
});

test('DOTTED-SYMBOLS in the pack: S0000007\'s `dialog link for person _P.05_`, S0000016\'s `dialog link for location _L.00_`, S0000503\'s `reveal _L.05_` and M0B11Y18\'s `reveal _L.00_` name their resources whole - they linked and revealed `_P` and `_L`, which no quest declares (mutants: the arms they ride)', () => {
  const m = packMachine();
  for (const [name, type, key, want] of [['S0000007', 'DialogLink', 'npcSymbol', '_P.05_'], ['S0000016', 'DialogLink', 'placeSymbol', '_L.00_'],
    ['S0000503', 'RevealLocation', 'placeSymbol', '_L.05_'], ['M0B11Y18', 'RevealLocation', 'placeSymbol', '_L.00_']]) {
    const q = quiet(() => m.parseQuestForLists(questSource(name), 0, { rolls: () => 0, headless: true }));
    const named = [...q.tasks.values()].flatMap((t) => t.actions).filter((a) => a.typeName === type).map((a) => a[key]?.original);
    assert.ok(named.includes(want), `${name}: ${type} names ${want} - ${named}`);
    assert.ok(!named.some((s) => s === '_L' || s === '_P'), `${name}: nothing cut short - ${named}`);
    assert.ok(q.resources.has(want.slice(1, -1)), `${name} declares ${want}`);
  }
});

// ---- CLIMATE-NAMES ----

test('CLIMATE-NAMES: each of the ten climate names binds its own climate - desert2 and mountainwoods ahead of the names they begin with, hauntedwoodlands beside woodlands (which it does not begin with, so their order never decided anything) - and the base form its base (mutants: the two orders, the haunted name)', () => {
  const want = { ocean: 223, desert: 224, desert2: 225, mountain: 226, rainforest: 227, swamp: 228, subtropical: 229, mountainwoods: 230, woodlands: 231, hauntedwoodlands: 232 };
  for (const [name, climate] of Object.entries(want)) {
    assert.equal(new ClimateCondition(null).createNew(`climate ${name}`, null)?.climate, climate, name);
  }
  const base = new ClimateCondition(null).createNew('climate base desert', null);
  assert.deepEqual([base.climate, base.climateBase], [-1, 'desert']);
});

// ---- CAST-SHARE ----

const CAST_LINES = [...HEADER('__QA3C'), '_cast_ task:', ' cast Nonesuch spell do _lifted_', ' cast Levitate spell do _lifted_', '', 'variable _lifted_'];
const LISTS = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
/** A machine over a world whose spell records answer `effects` for any classic spell, and note each read. */
function castMachine(effects) {
  const reads = [];
  const world = {
    getClassicSpellEffects: (id) => { reads.push(id); return effects; },
    spellHasMatchForClassicEffect: (spell, e) => spell.effects.some((x) => x.type === e.type && x.subType === e.subType),
  };
  const m = new QuestMachine({ nowSeconds: () => 1e6, world, getQuestSourceLines: (n) => (n === '__QA3C' ? CAST_LINES : null) });
  return { m, reads };
}
const castOf = (q) => q.getTask({ name: 'cast' }).actions.find((a) => a.spellID === 4);

test('CAST-SHARE: a `cast X spell do` quest shares (N0B00Y08, N0B00Y16, N0B40Y07 were refused as forgeries) - the copy reads its effects from its own world when it first runs (an unresolved spell reads none), keeps them through a resync, and its spell starts its task; a partner\'s effects that are not effects are refused (mutants: the lazy read, its spell test, the holders entry, the effects test)', () => {
  const MINE = [{ type: 9, subType: -1 }], THEIRS = [{ type: 9, subType: -1 }, { type: -1, subType: -1 }];
  const sender = castMachine(MINE), holder = castMachine(THEIRS);
  const q = quiet(() => sender.m.scheduleQuest(CAST_LINES, 0, { rolls: () => 0.4 }));
  sender.m.tick();
  q.getTask({ name: 'cast' }).start(); sender.m.tick();
  const envelope = () => JSON.parse(JSON.stringify(prepareQuestShare(sender.m, q.uid).data));
  assert.deepEqual(envelope().tasks.flatMap((t) => t.actions).find((a) => a.type === 'CastSpellDo' && a.actionSpecific.spellID === 4).actionSpecific.classicEffects, MINE);
  const got = quiet(() => receiveSharedQuest(holder.m, LISTS, '__QA3C', envelope()));
  assert.equal(got.ok, true, `received - ${got.reason}`);
  assert.equal(castOf(got.quest).classicEffects, null, 'the reference parse is headless: none yet');
  holder.m.tick();
  assert.deepEqual(castOf(got.quest).classicEffects, THEIRS, 'its first run reads its own');
  assert.deepEqual(holder.reads, [4], 'Levitate\'s record, and nothing for the spell no table knows');
  const again = quiet(() => receiveSharedQuest(holder.m, LISTS, '__QA3C', envelope()));
  assert.deepEqual([again.ok, again.resync], [true, true], `the resync - ${again.reason}`);
  const cast = castOf(again.quest);
  assert.deepEqual(cast.classicEffects, THEIRS, 'the holder\'s own stand, not the partner\'s');
  cast.onNewReadySpell({ effects: [{ type: 9, subType: -1 }] });
  holder.m.tick();
  assert.equal(again.quest.getTask({ name: 'lifted' }).getTriggerValue(), true, 'the readied spell starts the task');
  const forged = envelope();
  forged.tasks.flatMap((t) => t.actions).find((a) => a.type === 'CastSpellDo' && a.actionSpecific.spellID === 4).actionSpecific.classicEffects = { type: 9 };
  assert.deepEqual(quiet(() => receiveSharedQuest(castMachine(THEIRS).m, LISTS, '__QA3C', forged)), { ok: false, reason: 'mismatch' });
});

test('CAST-SHARE\'s law: against a reference that holds no effects a partner\'s may be none or a list; one that holds them holds the partner to them; the spell and its task stay the script\'s (mutants: the effects test, the held compare)', () => {
  const own = { type: 'CastSpellDo', isComplete: false, isTriggerCondition: false, isAlwaysOnTriggerCondition: false,
    actionSpecific: { spellID: 4, classicEffects: null, taskSymbol: { original: '_lifted_' } } };
  const sent = (classicEffects, over = {}) => ({ ...own, actionSpecific: { ...own.actionSpecific, classicEffects, ...over } });
  const A = [{ type: 9, subType: -1 }], B = [{ type: 21, subType: 0 }];
  assert.deepEqual([sent(A), sent(null), sent([])].map((x) => sharedActionMatches(own, x)), [true, true, true]);
  assert.deepEqual([sent({ type: 9 }), sent('effects'), sent(7)].map((x) => sharedActionMatches(own, x)), [false, false, false]);
  const held = sent(A);
  assert.deepEqual([sent(A), sent(B), sent(null)].map((x) => sharedActionMatches(held, x)), [true, false, false]);
  assert.equal(sharedActionMatches(own, sent(A, { spellID: 5 })), false, 'another spell');
  assert.equal(sharedActionMatches(own, sent(A, { taskSymbol: { original: '_other_' } })), false, 'another task');
});

// ---- JOKE-MACROS ----

const jokeHooks = (joke) => ({ playerRaceName: () => 'Breton', world: { getRandomText: (id) => (id === 200 ? joke : null), playerVampireClanName: () => null } });
const NAMED = { source: { name: () => 'Chrystorya Woodfield' } };

test('JOKE-MACROS: %jok\'s joke reads its own macros through the table, in the context %jok was asked in; a token with no handler, one that answers an error, and %jok itself stay as they were; no joke is the miss it was (mutants: the walk, the error test, the self test, the context, the miss)', () => {
  assert.equal(getMacroValue('%jok', NAMED, jokeHooks('How can you tell if a %ra is lying? %n says so: his lips are moving!')),
    'How can you tell if a Breton is lying? Chrystorya Woodfield says so: his lips are moving!');
  assert.equal(getMacroValue('%jok', NAMED, jokeHooks('At the %nt a %vam told a %zzq: %jok - 100% true.')),
    'At the %nt a %vam told a %zzq: %jok - 100% true.', 'no tavern to name, no clan, no such macro, and no joke inside a joke');
  assert.equal(getMacroValue('%jok', NAMED, { world: {} }), '%jok[nullMCP]', 'no text: the miss, as before');
});

const RSC = process.env.ARENA2_PATH ? join(process.env.ARENA2_PATH, 'TEXT.RSC') : null;
// PIN MOVED (AUDIT QA3 C4, F7): thirteen quests' rumors tell a joke, not eight; and the tavern's name drops its own "The"
// after the joke's "the " - "Over at the Mole and Jug", never "the The Mole and Jug".
test('JOKE-MACROS over the real data: none of TEXT.RSC 200\'s 23 jokes (K0C00Y05\'s child and thirteen quests\' rumors tell them) leaves a macro raw, nor says "the The" (needs ARENA2)', { skip: RSC && existsSync(RSC) ? false : 'no ARENA2 - sh tools/fetch-data.sh, then ARENA2_PATH' }, () => {
  const rsc = new TextRsc().load(new Uint8Array(readFileSync(RSC)));
  const jokes = new Set();
  for (let i = 0; i < 400; i++) jokes.add(rsc.randomTextById(200, () => i / 400));
  assert.equal(jokes.size, 23);
  assert.equal([...jokes].filter((j) => j.includes('%ra')).length, 22, 'all but the tavern\'s name the race');
  const world = {
    randomTavernName: () => 'The Mole and Jug',
    currentLocation: () => ({ loaded: true, name: 'Daggerfall', mapTableData: {} }),
    currentRegionIndex: () => 0, currentLocationIndex: () => 0,
    maps: { getRegion: () => ({ mapTable: [{ locationType: 0 }, { locationType: 0 }], mapNames: ['Daggerfall', 'Gothway Garden'] }) },
  };
  for (const joke of jokes) {
    const told = getMacroValue('%jok', null, { playerRaceName: () => 'Breton', world: { ...world, getRandomText: () => joke } });
    assert.doesNotMatch(told, /%[a-z]/i, joke);
    assert.match(told, /Breton|Mole and Jug/, joke);
    assert.doesNotMatch(told, /\bthe the\b/i, joke);
  }
});

// ---- DI-UNREF ----

const sited = (scope, locationName, buildingKey = 0) => ({ scope, siteDetails: { locationName, buildingKey } });
const PLACES = { home: sited('remote', 'Wickfield'), tavern: sited('remote', 'Mole and Jug'), limbo: { scope: 'remote', siteDetails: null }, shop: sited('local', 'Bigtown', 7) };
// PIN MOVED (AUDIT QA3 C2): %di reads a Person's dialog place (person.js getDialogPlace: where it stands, else its home) -
// each Person here answers the Place it stands at
const standsAt = (place) => ({ isPerson: true, assignedPlaceSymbol: place ? { name: place } : null, getDialogPlace: () => (place ? PLACES[place] ?? null : null) });
/** A quest as %di reads it: its resources in declaration order, its places, and the Place last referenced (none after a load). */
const diQuest = (persons, referenced = null) => ({
  uid: 1, lastPlaceReferenced: referenced,
  resources: new Map(persons.map((r, i) => [`r${i}`, r])),
  getPlace: (sym) => PLACES[sym?.name] ?? null,
  hooks: { world: {
    locationCompassDirection: (p) => (p?.siteDetails ? `toward ${p.siteDetails.locationName}` : null),
    currentLocation: () => ({ name: 'Bigtown' }),
    buildingCompassDirection: (key) => `inside, key ${key}`,
  } },
});
const di = (q) => getContextValue('%di', q, q.hooks);

test('DI-UNREF: %di with nothing referenced (a load forgets it) reads where the quest\'s last declared Person that stands somewhere stands - V0C00Y00\'s "If you go %di of here in __contact_" is the contact\'s - a Place not yet sited answering nothing; a Place referenced is still the Place (mutants: the fallback, its site test, the last declared, the referenced first)', () => {
  assert.equal(di(diQuest([standsAt('home'), standsAt('tavern'), standsAt(null)])), 'toward Mole and Jug', 'the last that stands somewhere');
  assert.equal(di(diQuest([standsAt('home'), standsAt('limbo')])), 'toward Wickfield', 'a Place with no site yet is passed over');
  assert.equal(di(diQuest([standsAt('shop')])), 'inside, key 7', 'in this town: the building compass, as a referenced local Place');
  assert.equal(di(diQuest([standsAt('home')], PLACES.tavern)), 'toward Mole and Jug', 'a Place referenced wins');
});
