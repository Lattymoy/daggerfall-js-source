// AUDIT REST II - THE PARTY'S NIGHT AND THE ACT (2026-10-03; bible/06-Systems/Rest-Arc.md sections 2 and 5, and its
// AUDIT REST / AUDIT REST-PARTY as-built bullets). A second pass over the party's night and the rest act, each finding
// reproduced on the real modules before it was fixed:
//  P1 nothing limited how often one mate's stamp carried the party (a forged pose: 60 nights in 60 s; two replayed
//     stamps taking turns: 11) - partyRestLaw.js's night watch: a per-member high-water mark, one move a minute;
//  P2 one honest night carried twice across the rester's connection blip, and a mate who left, rested alone and
//     rejoined carried you - the mark is not lowered by a missing pose, and a member who leaves is forgotten;
//  P3 a carried night cut by a prevent-rest condition said "through the night" (AUDIT REST III C2/C3: no room's end
//     reaches a carried night, and every rest's close raises, as the rester's window gives it) -
//     restAct.js carriedNightEnd; and a quest's CreateFoe reached only an open rest WINDOW, so a carried night (no
//     window) and a night under a quest box slept through it - every host's encounter route tells the night first;
//  P4 the carry never asked the act's town law - carriedNightAction's 'town', with its own line;
//  P5 every member's stamp was read for its mark every frame (an allocation each) - asked only once it moved;
//  P6 a room rented for N days gave fewer than N nights - rooms count nights;
//  P7 a foe stood on the night's last sub-tick still gave a whole night - the latch is read after the loop;
//  P8 the hold asked for foes and blows only at its end - it ends the moment it is broken, both skins;
//  P9 a pin over world.js matched a second copy of its line - anchored in carryPartyNight's own body.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNightWatch, nightMoved, carriedNightAction, stampOf, memberPresent, PARTY_NIGHT_GAP_MS, PARTY_NIGHT_FRESH_MS } from '../../src/systems/party/partyRestLaw.js';
import {
  nightStamp, nightKindOf, isNightStamp, runRestNight, ambushNight, spendRoomNight, roomNightsLeft, nightWhole, carriedNightEnd,
  channelBroken, setNightListener, REST_ACT_TEXT, NIGHT_INTERVAL_MINUTES, OWN_MINUTES_PER_REAL_MINUTE, REST_CHANNEL_SECONDS,
} from '../../src/systems/rest/restAct.js';
import { RestSession, REST_TEXT, canRest, registerPreventRestCondition, unregisterPreventRestCondition } from '../../src/systems/rest/restSession.js';
import { rentRoom, roomRemainingHours } from '../../src/systems/tavern.js';
import { quietNights } from '../../src/systems/encounters.js';
import { createRestDeps } from '../../src/scenes/shared.js';
import { validPartyPose } from '../../src/net/wire.js';
import { setSharedClock, setOwnMinutes, advanceOwnMinutes, ownMinutes } from '../../src/systems/worldTick.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { SURVIVAL_STORED } from '../../src/systems/survival/difficulty.js';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
afterEach(() => { setSharedClock(null); _resetForTests(); });

const sleeper = () => ({ health: 5, maxHealth: 60, fatigue: 0, magicka: 0, maxMagicka: 30, stats: { endurance: 50, strength: 50, willpower: 50, agility: 50 }, skills: [], career: {}, activeEffects: [] });
const pose = (restStartedAt) => validPartyPose({ px: 100, py: 100, in: 0, h: 50, hm: 50, f: 50, fm: 50, m: 0, mm: 0, restStartedAt });

/** world.js carryPartyNight's loop over the REAL law and the wire's own projection of the pose: the watch, then the
 *  decision (every member near, here, with the party; `busy`/`town` as given). The loop's wiring in world.js is pinned
 *  below (P9's anchored slice); this is its arithmetic, run. */
function follower({ near = true, busy = false, town = false } = {}) {
  const watch = createNightWatch();
  const log = [];
  const frame = (others, now) => {
    watch.keep(others);
    for (const m of others) {
      const at = stampOf(m.p?.restStartedAt, now);
      if (!watch.moved(m.acct, !!m.p, at, now, isNightStamp)) continue;
      const present = memberPresent(m);
      const act = carriedNightAction({ withParty: true, resterAlone: false, exempt: false, dead: false, near: present && near, here: present, busy, town });
      if (!act) continue;
      log.push({ now, at, act, kind: nightKindOf(at) });
      return;
    }
  };
  return { watch, frame, log };
}

test('AUDIT REST II P1: a forged pose no longer sleeps the party once a second - one move a minute a member answered, over the high-water mark; a stamp seen inside the gap is spent there; two replayed stamps taking turns carry once; the far and busy words once a move answered', () => {
  // a new marked stamp every second for a minute (the relay bounds the field below only; the reader's slack is 5 s ahead)
  for (const opts of [{}, { near: false }, { busy: true }]) {
    const f = follower(opts);
    let now = 2_000_000_000_000;
    const X = { acct: 'X', online: true, p: pose(null) };
    f.frame([X], now);
    for (let i = 0; i < 60; i++) { now += 1000; X.p = pose(nightStamp(now, 'bed')); f.frame([X], now); }
    assert.equal(f.log.length, 1, `${JSON.stringify(opts)}: one answer in the minute - before, 60`);
    assert.equal(f.log[0].act, opts.near === false ? 'far' : opts.busy ? 'busy' : 'carry');
    now += 1000; X.p = pose(nightStamp(now, 'bed')); f.frame([X], now);
    assert.equal(f.log.length, 2, 'the gap run out: the next move is answered');
  }
  // two stamps replayed in turn - an older one is never a night again
  const g = follower();
  let now = 3_000_000_000_000;
  const base = [nightStamp(now - 20_000, 'bed'), nightStamp(now - 10_000, 'bed')];
  const Y = { acct: 'Y', online: true, p: pose(null) };
  g.frame([Y], now);
  for (let i = 0; i < 12; i++) { now += 1000; Y.p = pose(base[i % 2]); g.frame([Y], now); }
  assert.equal(g.log.length, 1, 'once - before, 11');
  // a new stamp seen inside the gap is spent there, not answered when the gap runs out
  const h = follower();
  now = 4_000_000_000_000;
  const Z = { acct: 'Z', online: true, p: pose(null) };
  h.frame([Z], now);
  Z.p = pose(nightStamp(now, 'camp')); now += 1000; h.frame([Z], now);
  now += 40_000; Z.p = pose(nightStamp(now, 'camp')); h.frame([Z], now);
  now += 21_000; h.frame([Z], now);
  assert.equal(h.log.length, 1, 'the stamp first seen in the gap is no night at its end');
  // an honest pair of nights - the channel and the night interval apart - is never held back
  const honestGapMs = (NIGHT_INTERVAL_MINUTES / OWN_MINUTES_PER_REAL_MINUTE) * 60_000 + REST_CHANNEL_SECONDS * 1000;
  assert.ok(PARTY_NIGHT_GAP_MS === 60_000 && honestGapMs > PARTY_NIGHT_GAP_MS * 10, 'a minute, far below any honest pair');
  const k = follower();
  now = 5_000_000_000_000;
  const A = { acct: 'A', online: true, p: pose(null) };
  k.frame([A], now);
  for (let n = 0; n < 2; n++) { now += n ? honestGapMs : 1000; A.p = pose(nightStamp(now - 500, 'camp')); k.frame([A], now); }
  assert.deepEqual(k.log.map((l) => l.act), ['carry', 'carry'], 'two honest nights, two carries');
});

test('AUDIT REST II P1: nightMoved reads over the high-water mark - an older stamp, a replay, is no move; the first sight a baseline, a stale one no night', () => {
  const now = 9_000_000;
  const at = now - 1_000;
  assert.equal(nightMoved(at + 1, at, now, true), false, 'below the mark: a replay');
  assert.equal(nightMoved(at - 1, at, now, true), true, 'over it');
  assert.equal(nightMoved(undefined, at, now, true), false, 'first sight');
  assert.equal(nightMoved(at - 1, now - PARTY_NIGHT_FRESH_MS - 1, now, true), false, 'long over');
});

test('AUDIT REST II P2: one honest night is carried once across the rester\'s connection blip - a missing pose neither sets nor lowers the mark; a mate who leaves is forgotten, so their return (pose or none at first) is a baseline, not a night', () => {
  // the blip: an offline seat with no pose, a reconnect with none yet, the same pose re-sent whole
  const f = follower();
  let now = 1_000_000_000_000;
  const A = { acct: 'A', online: true, p: pose(null) };
  f.frame([A], now);
  const S = nightStamp(now + 100, 'camp');
  A.p = pose(S); now += 1000; f.frame([A], now);
  A.online = false; A.p = null; now += 3000; f.frame([A], now);
  assert.equal(f.watch.highOf('A'), S, 'a missing pose does not lower the mark');
  A.online = true; now += 2000; f.frame([A], now);
  A.p = pose(S); now += 1000; f.frame([A], now);
  assert.equal(f.log.length, 1, 'one night, one carry - before, two');
  // a mate who leaves, rests alone and rejoins within the freshness window
  const g = follower();
  now = 2_000_000_000_000;
  const B = { acct: 'B', online: true, p: pose(null) };
  const C = { acct: 'C', online: true, p: pose(null) };
  g.frame([B, C], now);
  now += 1000; g.frame([C], now);   // B leaves the party
  assert.equal(g.watch.highOf('B'), undefined, 'forgotten');
  const alone = nightStamp(now + 2000, 'camp');
  now += 5000;
  g.frame([{ acct: 'B', online: true, p: null }, C], now);   // back, the pose not yet in
  now += 500; g.frame([{ acct: 'B', online: true, p: pose(alone) }, C], now);
  assert.equal(g.log.length, 0, 'their night alone is theirs - a first sight on their return');
  now += 10 * 60_000; g.frame([{ acct: 'B', online: true, p: pose(nightStamp(now - 200, 'camp')) }, C], now);
  assert.equal(g.log.length, 1, 'and their next night carries');
  g.watch.clear();
  assert.equal(g.watch.highOf('C'), undefined);
});

test('AUDIT REST II P3: what a carried night says and gives - a night slept whole says so; one a foe broke or a condition cut says its own line; in death, nothing; a short rest its own line - and (AUDIT REST III C3, RE-AIMED) every rest that ran raises, as the window\'s close gives the rester on each of EndRest\'s arms; a rest that never ran, nothing', () => {
  const lines = (id) => [`line ${id}`, 'more'];
  assert.deepEqual(carriedNightEnd('Ada', true, { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }, lines), { raise: true, text: REST_ACT_TEXT.carried('Ada') });
  assert.deepEqual(carriedNightEnd('Ada', true, { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false }, lines), { raise: true, text: `line ${REST_TEXT.enemiesNearby} more` });
  assert.deepEqual(carriedNightEnd('Ada', true, { textId: null, text: 'You cannot rest now.', prevented: true, enemyBroke: false, died: false }, lines), { raise: true, text: 'You cannot rest now.' });
  assert.deepEqual(carriedNightEnd('Ada', true, { textId: null, enemyBroke: false, died: true }, lines), { raise: true, text: null }, 'death\'s arm raises too (restWindow.js: "Dropping the raise here lost a whole night\'s advancement")');
  assert.deepEqual(carriedNightEnd('Ada', true, null, lines), { raise: false, text: null }, 'a night that never ran');
  assert.deepEqual(carriedNightEnd('Ada', false, null, lines), { raise: false, text: REST_ACT_TEXT.carriedShort('Ada') }, 'nor a short rest');
  assert.deepEqual(carriedNightEnd('Ada', true, { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false }, () => null), { raise: true, text: null }, 'no line to say, nothing said');
  assert.deepEqual(carriedNightEnd('Ada', false, { text: REST_ACT_TEXT.shortRest }, lines), { raise: true, text: REST_ACT_TEXT.carriedShort('Ada') });
  assert.equal(nightWhole({ textId: REST_TEXT.wakeUp }), true);
  for (const k of ['died', 'enemyBroke', 'prevented']) assert.equal(nightWhole({ [k]: true }), false, k);   // AUDIT REST III C2: a carried night meets no room's end
  assert.equal(nightWhole(null), false);
});

/** world.js sleepCarriedNight's sequence over a real bag (as test/systems/rest/auditrestparty.test.js's `carry`), with the end it says. */
function carried(e, over = {}) {
  setSharedClock(() => 5_000_000);
  const bag = createRestDeps(e, { restKind: () => 'rough', restPoint: () => null, endLines: (id) => [`line ${id}`], ...over });
  let raised = 0;
  bag.onRestFinished = () => { raised++; };
  let r = null;
  quietNights(() => { bag.overrideRestKind(() => 'camp'); bag.setResting(true); try { r = bag.restNight({ carried: true }); } finally { bag.setResting(false); } });
  const end = carriedNightEnd('Ada', true, r, bag.endLines);
  if (end.raise) bag.onRestFinished();
  return { r, end, raised };
}

test('AUDIT REST II P3: a carried night a quest\'s prevent-rest condition cut at its second hour no longer says it was slept through, and keeps the condition\'s words (AUDIT REST III C3, RE-AIMED: and raises, as the rester\'s window does on that arm); a quest\'s CreateFoe inside a carried night (no window) breaks it', () => {
  setPref('survival', SURVIVAL_STORED.casual);
  setOwnMinutes(400_000);
  let minutes = 0, cut = false;
  const cond = () => cut;
  registerPreventRestCondition(cond, 'You cannot rest now.');
  try {
    const { r, end, raised } = carried(sleeper(), { advanceMinutes: (n) => { advanceOwnMinutes(n); minutes += n; if (minutes >= 120) cut = true; } });
    assert.equal(r.prevented, true);
    assert.deepEqual(end, { raise: true, text: 'You cannot rest now.' }, 'before: "Ada rests here, and you rest with them through the night."');
    assert.equal(raised, 1, 'the close\'s raise, as the rester\'s window gives it on the condition\'s arm');
  } finally { unregisterPreventRestCondition(cond); }
  // the hosts' encounter routes tell the act's night first - here, a quest's tick inside the carried night raising it
  setOwnMinutes(500_000);
  let sub = 0;
  const e = sleeper();
  const { r, end, raised } = carried(e, { advanceMinutes: (n) => advanceOwnMinutes(n), tickQuests: () => { if (++sub === 20) ambushNight(); } });
  assert.equal(r.enemyBroke, true, 'the carried night hears the foe');
  assert.deepEqual(end, { raise: true, text: `line ${REST_TEXT.enemiesNearby}` });   // AUDIT REST III C3 (RE-AIMED): the foe's arm raises, as the rester's
  assert.equal(raised, 1);
  assert.ok(e.health < 60, 'no whole night\'s yield');
});

test('AUDIT REST II P3 by source: every host\'s encounter-raise route tells the act\'s night first (restAct.js ambushNight - nothing when none runs) and keeps the window path; the carried night says and raises what carriedNightEnd answers', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /\n    abortRestForEnemySpawn: \(\) => \{\n      ambushNight\(\);[^\n]*\n      if \(townTalk\.overlay\?\.isRestWindow\) townTalk\.overlay\.abortForEnemySpawn\?\.\(\);\n    \},\n/, 'world.js');
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /\n    raiseOnEncounterEvent\(\) \{\n      ambushNight\(\);[^\n]*\n      if \(mode === 'dungeon'\) \{ dungeonCtx\?\.abortRestForEnemySpawn\?\.\(\); return; \}\n      if \(interiorOverlay\?\.isRestWindow\) \{ interiorOverlay\.abortForEnemySpawn\?\.\(\); return; \}/, 'worldModes.js');
  assert.match(wm, /^import \{ ambushNight \} from '\.\.\/systems\/rest\/restAct\.js';/m);
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /\n    abortRestForEnemySpawn\(\) \{\n      ambushNight\(\);[^\n]*\n      if \(activeOverlay\?\.isRestWindow\) activeOverlay\.abortForEnemySpawn\?\.\(\);\n    \},\n/, 'dungeonContext.js');
  const sleep = w.slice(w.indexOf('const sleepCarriedNight = (name, theirs) => {'), w.indexOf('setNightListener((kind) =>'));
  assert.ok(sleep.length > 200, 'sleepCarriedNight, before the night listener');
  assert.match(sleep, /\n    const end = carriedNightEnd\(name, night, r, bag\.endLines\);\n    if \(end\.raise\) bag\.onRestFinished\?\.\(\);\n    if \(end\.text\) setMidScreenText\(end\.text, 5\);\n  \};/);
  assert.doesNotMatch(sleep, /REST_ACT_TEXT\.carried(Short)?\(name\)/, 'the words are the law\'s, not a second copy');
});

test('AUDIT REST II P4: a member standing inside town limits outdoors is not carried into a night there - the act\'s own town law (its first refusal), asked after the rest gate and only of a member who would be carried, with its own line', () => {
  const base = { withParty: true, resterAlone: false, exempt: false, dead: false, near: true, here: true, busy: false };
  assert.equal(carriedNightAction({ ...base, town: true }), 'town', 'before: carried');
  assert.equal(carriedNightAction({ ...base, town: false }), 'carry');
  assert.equal(carriedNightAction({ ...base, busy: true, town: true }), 'busy', 'restDecision\'s gate first, then CanRest\'s town - the act\'s order');
  let asked = 0;
  const town = () => { asked++; return true; };
  assert.equal(carriedNightAction({ ...base, near: false, town }), 'far');
  assert.equal(carriedNightAction({ ...base, busy: true, town }), 'busy');
  assert.equal(carriedNightAction({ ...base, exempt: true, town }), null);
  assert.equal(asked, 0, 'the town is asked only of a member who would be carried');
  assert.equal(carriedNightAction({ ...base, town }), 'town');
  assert.equal(asked, 1);
  assert.equal(REST_ACT_TEXT.carriedTown('Ada'), 'Ada rests here, but it is illegal to camp in town.');
  // the host's bag answers the act's own question - the place the window's open refuses on
  setSharedClock(() => 5_000_000);
  const bag = createRestDeps(sleeper(), { place: () => ({ inTownOutside: true, inTownLocation: true, insideBuilding: false }) });
  assert.equal(bag.restPlace().inTownOutside, true);
  const w = rd('src/scenes/world.js');
  const carry = w.slice(w.indexOf('const carryPartyNight = () => {'), w.indexOf('const sleepCarriedNight = (name, theirs) => {'));
  assert.match(carry, /\n        town: \(\) => !!hostRestDeps\(\)\?\.restPlace\?\.\(\)\?\.inTownOutside,[^\n]*\n      \}\);\n/, 'the host\'s own place, as the act reads it (restWindow.js _openAct)');
  assert.match(carry, /\n      else if \(act === 'town'\) setMidScreenText\(REST_ACT_TEXT\.carriedTown\(name\), 4\);\n      else sleepCarriedNight\(name, nightKindOf\(at\)\);\n/);
  assert.match(rd('src/ui/restWindow.js'), /const place = this\.deps\.restPlace\?\.\(\);\n    if \(place\?\.inTownOutside\) \{ this\.refusalLines = \[REST_ACT_TEXT\.inTown\];/, 'the act\'s own refusal reads that place');
});

test('AUDIT REST II P5: a member\'s stamp is asked for its mark only once it has moved - never every member every frame - and the mark is read off a frozen key array, no allocation a call', () => {
  const watch = createNightWatch();
  let asked = 0;
  const isNight = (t) => { asked++; return isNightStamp(t); };
  const now = 7_000_000_000;
  const at = nightStamp(now - 5_000, 'camp');
  watch.moved('A', true, at, now, isNight);
  for (let i = 0; i < 600; i++) watch.moved('A', true, at, now + i * 16, isNight);
  assert.equal(asked, 0, 'ten seconds of frames, an unmoved stamp: the mark never asked');
  watch.moved('A', true, at + 1000, now + 10_000, isNight);
  assert.equal(asked, 1, 'a moved stamp: asked once');
  const keys = Object.keys;
  let calls = 0;
  Object.keys = (o) => { calls++; return keys(o); };
  try { for (const k of ['rough', 'camp', 'bed']) assert.equal(nightKindOf(nightStamp(1_000, k)), k); assert.equal(nightKindOf(1_234), null); } finally { Object.keys = keys; }
  assert.equal(calls, 0, 'no key array made a call');
  const w = rd('src/scenes/world.js');
  const carry = w.slice(w.indexOf('const carryPartyNight = () => {'), w.indexOf('const sleepCarriedNight = (name, theirs) => {'));
  assert.match(carry, /\n      if \(!_nightWatch\.moved\(m\.acct, !!m\.p, at, now, isNightStamp, \(\) => nightDue\(playerEntity, ownMinutes\(\)\)\)\) continue;/, 'the predicate itself, asked by the law (AUDIT REST III C1 re-aim: and my clock\'s debt, asked by it too)');
  assert.equal((carry.match(/nightKindOf\(/g) ?? []).length, 1, 'the kind read once, for the night slept');
});

test('AUDIT REST II P1/P2/P9 by source: carryPartyNight reads every member through the night watch - the departed forgotten, the pose\'s presence its own question - and hands the law its readings', () => {
  const w = rd('src/scenes/world.js');
  const carry = w.slice(w.indexOf('const carryPartyNight = () => {'), w.indexOf('const sleepCarriedNight = (name, theirs) => {'));
  assert.match(w, /\n  const _nightWatch = createNightWatch\(\);[^\n]*\n  const carryPartyNight = \(\) => \{\n/);
  assert.match(carry, /\n    if \(!social\?\.party\) \{ _nightWatch\.clear\(\); return; \}\n    const now = social\.now\(\);\n    const others = social\.others\(\);\n    _nightWatch\.keep\(others\);[^\n]*\n    for \(const m of others\) \{\n      const at = stampOf\(m\.p\?\.restStartedAt, now\);\n/);
  assert.equal((carry.match(/const dead = /g) ?? []).length, 1);
  assert.match(carry, /\n      const dead = playerEntity\.health <= 0 \|\| !!modes\?\.deathUp\?\.\(\);\n/, 'P9: dead, or the death screen up - this site\'s own line');
});

test('AUDIT REST II P6: a room rented for three days gives three nights with play between them - an hour of it, before: two - and lapses after the days lived, whichever comes first; the last night spent, CanRest finds no room', () => {
  const tavern = (room, now) => canRest({ inTownLocation: true, insideBuilding: true, permanentScene: true, room, nowMinutes: now, restMarkers: 1 });
  const nightsOf = (between) => {
    setSharedClock(() => 5_000_000);
    setOwnMinutes(400_000);
    const rooms = [];
    const room = rentRoom(rooms, { room: null, days: 3, nowMinutes: ownMinutes(), mapId: 1, buildingKey: 2, name: 'The Inn', rolls: () => 0 });
    assert.equal(room.nights, 3, 'the days rented are its nights');
    const e = sleeper();
    const bag = createRestDeps(e, { restKind: () => 'bed', restPoint: () => ({ kind: 'bed', where: null }), place: () => ({ room }), advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null });
    let slept = 0;
    for (let n = 0; n < 6; n++) {
      if (n) advanceOwnMinutes(between * OWN_MINUTES_PER_REAL_MINUTE);
      const d = tavern(room, ownMinutes());
      if (!d.allowed) break;
      e.health = 5;
      bag.setResting(true);
      const r = bag.restNight({ rentedHours: d.hoursRented });
      bag.setResting(false);
      assert.equal(e.health, 60, `night ${n + 1} (${between} real min between) is whole`);
      assert.ok(!r.enemyBroke && !r.prevented && !r.died);
      slept++;
    }
    return slept;
  };
  for (const between of [10, 30, 60, 120]) assert.equal(nightsOf(between), 3, `${between} real minutes of play between nights`);
  assert.equal(nightsOf(180), 2, 'three hours of play between nights: the room lapses after its three days lived, before its third night');
});

test('AUDIT REST II P6: an extension adds its days as nights; an old save\'s room (no count) reads its nights once, off the hours it has as the night begins; offline the count is nobody\'s - DFU\'s window counts the hours', () => {
  const rooms = [];
  const room = rentRoom(rooms, { room: null, days: 2, nowMinutes: 1_000, mapId: 1, buildingKey: 2, name: 'Inn', rolls: () => 0 });
  rentRoom(rooms, { room, days: 3, nowMinutes: 1_100 });
  assert.deepEqual([room.nights, room.expiryMinutes], [5, 1_000 + 5 * 1440], 'the expiry is DFU\'s, the nights five');
  const old = { mapId: 1, buildingKey: 2, allocatedBedIndex: 0, expiryMinutes: 2_000 + 50 * 60 };
  rentRoom([old], { room: old, days: 1, nowMinutes: 2_000 });
  assert.equal(old.nights, undefined, 'an old room extended stays uncounted - its hours carry the extension');
  assert.equal(roomNightsLeft({ expiryMinutes: 2_000 + 50 * 60 }, 2_000), 3, 'fifty hours: three nights (ceil(hours / 24))');
  assert.equal(roomNightsLeft(null, 0), 0);
  // through a real bag: fifty hours left as the night begins is three nights, two left after it
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const legacy = { mapId: 1, buildingKey: 2, allocatedBedIndex: 0, expiryMinutes: 400_000 + 50 * 60 };
  const bag = createRestDeps(sleeper(), { restKind: () => 'bed', restPoint: () => ({ kind: 'bed', where: null }), place: () => ({ room: legacy }), advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null });
  bag.setResting(true);
  bag.restNight({ rentedHours: roomRemainingHours(legacy, ownMinutes()) });
  bag.setResting(false);
  assert.deepEqual([legacy.nights, legacy.expiryMinutes], [2, 400_000 + 50 * 60], 'read as the night began (42 hours after it would read two), the expiry untouched');
  // offline: DFU's own session over the room - no act, nothing of the count read or spent
  setSharedClock(null);
  const e = sleeper();
  const off = { mapId: 1, buildingKey: 2, allocatedBedIndex: 0, expiryMinutes: ownMinutes() + 3 * 1440, nights: 3 };
  const deps = createRestDeps(e, { restKind: () => 'bed', place: () => ({ room: off }), advanceMinutes: (n) => advanceOwnMinutes(n), endLines: () => null });
  assert.equal(deps.restAct(), null, 'offline: DFU\'s window');
  const s = new RestSession('timed', 8, deps, roomRemainingHours(off, ownMinutes()));
  let r = null;
  for (let i = 0; i < 100_000 && !r; i++) r = s.tick(1);
  assert.equal(r.textId, REST_TEXT.wakeUp);
  assert.deepEqual([off.nights, off.expiryMinutes > ownMinutes()], [3, true], 'the room as DFU keeps it');
});

test('AUDIT REST II P7: a foe stood on the night\'s LAST sub-tick breaks it - before, "You wake up.", healed whole, fuel spent, the party carried; a death or a break already answered stands', () => {
  for (const at of [47, 48]) {
    let n = 0, breaks = 0;
    const deps = { advanceMinutes: () => { if (++n === at) ambushNight(); }, tickQuests() {}, tickVitals: () => false, enemiesNearby: () => false, dead: () => false, fullyHealed: () => false, onEnemyBreak: () => { breaks++; } };
    const r = runRestNight(deps);
    assert.equal(r.result.enemyBroke, true, `sub-tick ${at}`);
    assert.equal(r.result.textId, REST_TEXT.enemiesNearby);
    assert.equal(breaks, 1, 'the break heard once');
  }
  // through a real bag: no top-up, no fuel, nobody carried
  setSharedClock(() => 5_000_000);
  setOwnMinutes(400_000);
  const heard = [];
  const prev = setNightListener((k) => heard.push(k));
  try {
    const e = sleeper();
    let sub = 0, fuel = 0;
    const bag = createRestDeps(e, { restPoint: () => ({ kind: 'camp', where: 'fire' }), restKind: () => 'camp', advanceMinutes: (m) => { advanceOwnMinutes(m); if (++sub === 48) ambushNight(); }, onNightSlept: () => { fuel++; }, endLines: () => null });
    bag.setResting(true);
    const r = bag.restNight();
    bag.setResting(false);
    assert.equal(r.enemyBroke, true);
    assert.ok(e.health < 60, 'eight hours\' healing, no whole night');
    assert.deepEqual([fuel, heard.length], [0, 0], 'no fuel, nobody carried');
  } finally { setNightListener(prev); }
  // a death in the same sub-tick is a death; a foe found in reach at the last hour with the latch up is one break
  let dead = false, n2 = 0, b2 = 0;
  const died = runRestNight({ advanceMinutes: () => { if (++n2 === 20) { ambushNight(); dead = true; } }, tickQuests() {}, tickVitals: () => false, enemiesNearby: () => false, dead: () => dead, onEnemyBreak: () => { b2++; } });
  assert.deepEqual([died.result.died, died.result.enemyBroke, b2], [true, false, 0]);
  let n3 = 0, b3 = 0, foe = false;
  const both = runRestNight({ advanceMinutes: () => { if (++n3 === 48) { ambushNight(); foe = true; } }, tickQuests() {}, tickVitals: () => false, enemiesNearby: () => foe, dead: () => false, onEnemyBreak: () => { b3++; } });
  assert.deepEqual([both.result.enemyBroke, b3], [true, 1]);
  const whole = runRestNight({ advanceMinutes() {}, tickQuests() {}, tickVitals: () => false, enemiesNearby: () => false, dead: () => false });
  assert.equal(whole.result.textId, REST_TEXT.wakeUp, 'no latch: the night as it was');
});

/** The classic window over a bag with an act (test/systems/rest/rest1_act.test.js's shape), its health under the test's hand. */
async function classic(over = {}) {
  const { RestWindow } = await import('../../src/ui/restWindow.js');
  const calls = { night: 0, meditate: 0, breaks: 0 };
  const hp = { v: 50 };
  const deps = {
    setResting() {}, setLoitering() {}, enemiesNearby: () => false, endLines: (id) => [`text ${id}`], vitals: () => ({ health: hp.v }),
    restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: REST_CHANNEL_SECONDS }),
    restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
    restMeditate: () => { calls.meditate++; return { textId: null, text: 'calm', enemyBroke: false, died: false }; },
    onEnemyBreak: () => { calls.breaks++; }, onRestFinished() {},
    ...over,
  };
  return { w: new RestWindow(deps), calls, hp };
}
const mkEl = (tag) => ({
  tag, className: '', textContent: '', id: '', value: '', type: '', min: '', max: '', children: [], style: {}, attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  append(...c) { this.children.push(...c); }, remove() {}, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, focus() {},
  set innerHTML(v) { if (v === '') this.children = []; }, get innerHTML() { return ''; },
});
/** The enhanced card under a fake document (test/systems/rest/rest1_act.test.js's shape). */
async function enhanced(over, fn) {
  const prev = [globalThis.document, globalThis.window, globalThis.requestAnimationFrame];
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {}, querySelector: () => null };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = () => 0;
  try {
    const { mountEnhancedRest } = await import('../../src/ui/enhanced/enhancedRest.js');
    const calls = { night: 0, meditate: 0, breaks: 0 };
    const hp = { v: 50 };
    const deps = {
      setResting() {}, setLoitering() {}, enemiesNearby: () => false, endLines: (id) => [`text ${id}`], vitals: () => ({ health: hp.v }),
      restAct: () => ({ point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: 6 }),
      restNight: () => { calls.night++; return { textId: REST_TEXT.wakeUp, enemyBroke: false, died: false }; },
      restMeditate: () => { calls.meditate++; return { textId: null, text: 'calm', enemyBroke: false, died: false }; },
      onEnemyBreak: () => { calls.breaks++; }, onRestFinished() {},
      ...over,
    };
    await fn({ overlay: mountEnhancedRest(mkEl('div'), deps), calls, hp });
  } finally { [globalThis.document, globalThis.window, globalThis.requestAnimationFrame] = prev; }
}

test('AUDIT REST II P8: the classic window\'s hold ends the moment it is broken - a blow at its first second, a foe come into reach, a foe stood (the latch) - with the end check\'s own lines and no night; a candle\'s kneel is not a hold a blow breaks', async () => {
  const hurt = await classic();
  hurt.w.tick(1);
  hurt.hp.v = 44;
  hurt.w.tick(1 / 60);
  assert.equal(hurt.w.state, 'ended', 'at once - before, held to the sixth second');
  assert.deepEqual(hurt.w.endLines, [REST_ACT_TEXT.interrupted]);
  assert.equal(hurt.calls.night, 0);
  let foe = false;
  const sight = await classic({ enemiesNearby: () => foe });
  sight.w.tick(1);
  foe = true;
  sight.w.tick(1 / 60);
  assert.deepEqual([sight.w.state, sight.w.endLines, sight.calls.night, sight.calls.breaks], ['ended', [`text ${REST_TEXT.enemiesNearby}`], 0, 1]);
  const stood = await classic();
  stood.w.tick(1);
  stood.w.abortForEnemySpawn();   // a quest's CreateFoe, no night running: the window's latch
  stood.w.tick(1 / 60);
  assert.deepEqual([stood.w.state, stood.w.endLines, stood.calls.night], ['ended', [`text ${REST_TEXT.enemiesNearby}`], 0]);
  const held = await classic();
  held.w.tick(REST_CHANNEL_SECONDS - 0.1);
  assert.equal(held.w.state, 'channel', 'unbroken, it holds');
  held.w.tick(0.2);
  assert.equal(held.calls.night, 1);
  const kneel = await classic({ restAct: () => ({ point: { kind: 'candle', where: 'candle' }, night: false, meditate: true, channelSeconds: REST_CHANNEL_SECONDS }) });
  kneel.w.tick(1);
  kneel.hp.v = 10;
  kneel.w.tick(1);
  assert.equal(kneel.w.state, 'channel', 'a kneel the end check lets finish hurt is not ended early');
  kneel.w.tick(REST_CHANNEL_SECONDS);
  assert.equal(kneel.calls.meditate, 1);
});

test('AUDIT REST II P8: the enhanced card\'s hold ends the moment it is broken, as the classic window\'s', async () => {
  await enhanced({}, async ({ overlay, calls, hp }) => {
    overlay.tick(1);
    hp.v = 40;
    overlay.tick(1 / 60);
    assert.equal(overlay.state, 'ended');
    assert.deepEqual(overlay._endLines, [REST_ACT_TEXT.interrupted]);
    assert.equal(calls.night, 0);
  });
  let foe = false;
  await enhanced({ enemiesNearby: () => foe }, async ({ overlay, calls }) => {
    overlay.tick(1);
    foe = true;
    overlay.tick(1 / 60);
    assert.deepEqual([overlay.state, overlay._endLines, calls.night, calls.breaks], ['ended', [`text ${REST_TEXT.enemiesNearby}`], 0, 1]);
  });
  await enhanced({}, async ({ overlay, calls }) => {
    overlay.tick(1);
    overlay.abortForEnemySpawn();
    overlay.tick(1 / 60);
    assert.deepEqual([overlay.state, calls.night], ['ended', 0]);
  });
  await enhanced({ restAct: () => ({ point: { kind: 'candle', where: 'candle' }, night: false, meditate: true, channelSeconds: 6 }) }, async ({ overlay, calls, hp }) => {
    overlay.tick(1);
    hp.v = 10;
    overlay.tick(1);
    assert.equal(overlay.state, 'channel');
    overlay.tick(6);
    assert.equal(calls.meditate, 1);
  });
});

test('AUDIT REST II P8: channelBroken - a foe stood, a foe in reach (asked only when no latch says so), a blow since the open; never a kneel\'s blow; nothing else', () => {
  const fire = { point: { kind: 'camp', where: 'fire' } };
  let asked = 0;
  const foe = (v) => () => { asked++; return v; };
  assert.equal(channelBroken(fire, true, foe(false), 50, 50), true);
  assert.equal(asked, 0, 'the latch answers first');
  assert.equal(channelBroken(fire, false, foe(true), 50, 50), true);
  assert.equal(channelBroken(fire, false, foe(false), 50, 49), true);
  assert.equal(channelBroken(fire, false, foe(false), 50, 50), false);
  assert.equal(channelBroken(fire, false, null, undefined, 10), false, 'no health read at the open: no blow to measure');
  assert.equal(channelBroken({ meditate: true }, false, foe(false), 50, 1), false);
  assert.equal(channelBroken({ meditate: true }, false, foe(true), 50, 50), true, 'a foe breaks a kneel, as at its end');
});

test('AUDIT REST III C6: the hold is broken the moment the fire it rests by goes out - both skins, with the end check\'s own "interrupted" and no night; a bed\'s hold (no `where`) never asks; a candle\'s kneel finishes wherever it began (mutants: the point unasked; asked of a bed; a kneel broken)', async () => {
  let lit = true;
  const fireAct = () => (lit ? { point: { kind: 'camp', where: 'fire' }, night: true, channelSeconds: REST_CHANNEL_SECONDS } : { point: null, night: true });
  const w = await classic({ restAct: fireAct });
  w.w.tick(1);
  assert.equal(w.w.state, 'channel');
  lit = false;
  w.w.tick(1 / 60);
  assert.deepEqual([w.w.state, w.w.endLines, w.calls.night], ['ended', [REST_ACT_TEXT.interrupted], 0], 'at once - before, held to the sixth second');
  lit = true;
  await enhanced({ restAct: fireAct }, async ({ overlay, calls }) => {
    overlay.tick(1);
    lit = false;
    overlay.tick(1 / 60);
    assert.deepEqual([overlay.state, overlay._endLines, calls.night], ['ended', [REST_ACT_TEXT.interrupted], 0]);
  });
  // the law: asked only of a fire, a tent or a Bedroll - a bed's room stands, and a kneel finishes where it began
  let asked = 0;
  const gone = () => { asked++; return { point: null }; };
  assert.equal(channelBroken({ point: { kind: 'camp', where: 'fire' } }, false, () => false, 50, 50, gone), true);
  assert.equal(channelBroken({ point: { kind: 'camp', where: 'fire' } }, false, () => false, 50, 50, () => ({ point: { where: 'fire' } })), false);
  asked = 0;
  assert.equal(channelBroken({ point: { kind: 'bed' } }, false, () => false, 50, 50, gone), false, 'a bed');
  assert.equal(channelBroken({ meditate: true, point: { kind: 'camp', where: 'fire' } }, false, () => false, 50, 50, gone), false, 'a kneel');
  assert.equal(asked, 0, 'neither asks');
});
