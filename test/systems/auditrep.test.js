// AUDIT REP (2026-09-30) - THE REPUTATION OVERHAUL, AUDITED. Mac: "Audit this" - REP1-REP6 (bible/06-Systems/
// Standing-Arc.md), read end to end against its own claims; the record is bible/01-Overview/audits/Audit-REP.md. Each pin below
// fails on the code as REP shipped it (b65f7691d).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArrestFlow } from '../../src/scenes/arrestFlow.js';
import { CRIMES, legalRepOf } from '../../src/systems/court.js';
import { setSharedClock, hearSharedClock, trustedWorldMinutes, worldMinutes } from '../../src/systems/worldTick.js';
import { banish, isBanished, banishmentLeft, BANISHMENT_MINUTES, PARDON_BASE_PRICE } from '../../src/systems/standing.js';
import { createRegionConditions } from '../../src/systems/region/regionConditions.js';
import { buildDonationFlow } from '../../src/ui/guildServiceWindows.js';
import { lawRows } from '../../src/ui/enhanced/enhancedMenu.js';
import { createStandingWatch, STANDING_LOOK_MS, installLegalNotices } from '../../src/scenes/standingHost.js';
import { grantRaidReputation } from '../../src/systems/raidingParties.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** The arrest flow over a stub overlay (rep2_sentences.test.js's rig: the boxes' fallback texts, no court art). */
function flowRig(crime, legal = 0) {
  const shown = [];
  const townTalk = { texts: () => null, showOverlay: (w) => shown.push(w), pushOverlay: (w) => shown.push(w), overlay: null, factionDict: null, locationName: 'Daggerfall' };
  const p = { name: 'P', health: 40, crimeCommitted: crime, legalRep: { 2: legal }, skills: 30, skillUses: [], stats: { personality: 50 }, items: [], goldPieces: 0 };
  const flow = createArrestFlow({ townTalk, playerEntity: p, regionIndex: 2, rolls: () => 0.99, advanceDays: () => {}, advanceMinutes: () => {} });
  return { p, flow, shown };
}

test('AUDIT REP F1: the court charges the crime it tries - a townsperson murdered after the surrender box, then the fatal blow: the Murder is charged before its trial, not tried free and credited; a Y read after the crime changed charges the new one; a door that charged already charges nothing more (mutant: the court\'s charge dropped)', () => {
  const r = flowRig(CRIMES.Theft);
  r.flow.onGuardHit(5, () => {});   // the first box: the Theft charged
  assert.equal(legalRepOf(r.p, 2), -8);
  r.shown.at(-1).input('KeyN');     // fight on
  r.p.crimeCommitted = CRIMES.Murder;   // a townsperson, not a watchman: the surrender still stands (REP2)
  assert.equal(r.flow.onGuardHit(100, () => {}), true, 'the blow that would kill: the surrender taken, the court');
  assert.equal(r.p.arrested, true);
  assert.deepEqual([legalRepOf(r.p, 2), r.p.chargedCrime], [-28, CRIMES.Murder], 'the Murder charged (REP as shipped: -8, and the sentence then CREDITED a Murder never charged)');
  r.flow.dispose();
  const y = flowRig(CRIMES.Theft);
  y.flow.onGuardHit(5, () => {});
  y.p.crimeCommitted = CRIMES.Murder;   // committed while the box stood (online the world runs under it)
  y.shown.at(-1).input('KeyY');
  assert.deepEqual([legalRepOf(y.p, 2), y.p.arrested], [-28, true]);
  y.flow.dispose();
  const q = flowRig(0, -20);
  assert.equal(q.flow.surrenderToChallenge(), true);
  assert.equal(legalRepOf(q.p, 2), -22, 'the watch\'s stop: its Conspiracy once');
  q.flow.dispose();
});

test('AUDIT REP F2: a banishment\'s term reads the world\'s calendar only when it can be trusted - online NaN until the relay\'s clock is heard; an untrusted read neither stamps nor lifts a term (mutants: the machine clock trusted; the lift on an untrusted read; the NaN stamped)', () => {
  const fast = 1000 + 400 * 1440;   // this machine's clock, a year and more fast at the boot
  try {
    setSharedClock(() => fast);
    assert.ok(Number.isNaN(trustedWorldMinutes()), 'online, the relay unheard: not trusted');
    const p = { legalRep: { 4: 0 }, regionConditions: createRegionConditions() };
    banish(p, 4, 1000);
    assert.equal(isBanished(p, 4, trustedWorldMinutes()), true, 'the boot\'s frames lift nothing (REP as shipped read worldMinutes(): lifted for good)');
    assert.equal(p.regionConditions[4].banishedUntil, 1000 + BANISHMENT_MINUTES);
    hearSharedClock();
    assert.equal(trustedWorldMinutes(), worldMinutes(), 'heard: the world\'s own');
  } finally { setSharedClock(null); }
  assert.equal(trustedWorldMinutes(), worldMinutes(), 'offline: the one clock');
  const old = { legalRep: { 4: 0 }, regionConditions: createRegionConditions() };
  old.regionConditions[4].severePunishmentFlags = 1;   // a banishment from before REP: no term
  assert.equal(isBanished(old, 4, NaN), true);
  assert.equal(old.regionConditions[4].banishedUntil, null, 'no term stamped off an untrusted clock');
  assert.equal(isBanished(old, 4, 2000), true);
  assert.equal(old.regionConditions[4].banishedUntil, 2000 + BANISHMENT_MINUTES, 'the first trusted read stamps it');
  const b = { legalRep: { 4: 0 }, regionConditions: createRegionConditions() };
  assert.equal(banish(b, 4, NaN), true);
  assert.deepEqual([b.regionConditions[4].severePunishmentFlags & 1, b.regionConditions[4].banishedUntil], [1, null], 'the court\'s banishment on an unheard relay: the bit, no term yet');
  assert.ok(Number.isNaN(banishmentLeft(b, 4, NaN)));
  assert.deepEqual(lawRows(b, NaN), [{ region: 'Yeorth Burrowland', rep: 0, word: 'a common citizen', note: `banished (a pardon: ${PARDON_BASE_PRICE} gold)` }],
    'the Standing page lists it, its days unknown (REP as shipped: the row vanished)');
  const win = buildDonationFlow(b, null, 29, { rows: () => [], onClose: () => {}, regionIndex: 4, regionName: 'Wayrest', ownNow: () => 0, worldNow: () => NaN });
  assert.match((win.top?.rows ?? []).map((l) => l.text).join(' '), /^You are banished from Wayrest\. For 2500 gold the temple will plead for your pardon\. Will you pay\?$/);
  for (const [file, re] of [
    ['src/scenes/world.js', /ownNow: \(\) => ownMinutes\(\), worldNow: \(\) => trustedWorldMinutes\(\),/],
    ['src/scenes/exterior.js', /ownNow: \(\) => ownMinutes\(\), worldNow: \(\) => trustedWorldMinutes\(\),/],
    ['src/scenes/worldModes.js', /ownNow: \(\) => ownMinutes\(\), worldNow: \(\) => trustedWorldMinutes\(\),/],
    ['src/scenes/arrestFlow.js', /banish\(playerEntity, region\(\), trustedWorldMinutes\(\)\);/],
    ['src/ui/enhanced/enhancedMenu.js', /export function statsLaw\(detail, entity, \{ worldNow = trustedWorldMinutes\(\) \} = \{\}\)/],
  ]) assert.match(src(file), re, file);
});

/** REP1's watch rig (rep1_watchstop.test.js), with the effects the audit needs. */
function watchRig() {
  const p = { legalRep: { 3: -20 }, goldPieces: 5000, items: [], health: 50, regionConditions: createRegionConditions() };
  const t = { ms: 0 };
  const shown = [], calls = { look: 0 };
  const watch = createStandingWatch({
    playerEntity: p,
    townTalk: { showOverlay: (w) => shown.push(w), say: () => {} },
    arrestFlow: { inCourt: () => false, surrenderToChallenge: () => true },
    cityGuards: { guardSeesPlayer: () => { calls.look++; return { guard: true }; } },
    guardPool: () => [], playerFeet: () => [0, 0, 0], regionIndex: () => 3, regionName: () => 'Daggerfall',
    ownNow: () => 5000, worldNow: () => 5000, crimeResponse: () => {}, clock: () => t.ms,
  });
  return { p, shown, calls, look: () => { t.ms += STANDING_LOOK_MS; return watch.frame(); } };
}

test('AUDIT REP F7: an invisible criminal is nobody\'s face - the witness arm\'s own gate; the guard is not even asked (mutant: the stop through Invisibility)', () => {
  for (const kind of ['invisNormal', 'invisTrue']) {
    const r = watchRig();
    r.p.activeEffects = [{ kind }];
    assert.equal(r.look(), false, kind);
    assert.equal(r.calls.look, 0, `${kind}: no guard asked`);
  }
  const seen = watchRig();
  assert.equal(seen.look(), true, 'visible: the stop');
});

test('AUDIT REP F3: no stop in a fight - a foe that sees the player, or a duel, holds the watch on both street hosts (mutant: the fight not a block)', () => {
  // AUDIT NAV2 F10: PIN MOVED - the sea fight's arms follow the foot fight's (the world host alone has a sea)
  assert.match(src('src/scenes/world.js'), /blocked: \(\) => townTalk\.overlayActive \|\| !!modes\?\.overlayHeld \|\| !!travelView\?\.active \|\| !!raidDefendingHere\(\)\n\s*\|\| duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoes\.foes\)[,\n]/);
  assert.match(src('src/scenes/exterior.js'), /blocked: \(\) => townTalk\.overlayActive \|\| !!modes\?\.overlayHeld \|\| areEnemiesNearby\(exteriorFoes\.foes\),/);
});

const citizen = (legal, gold) => ({ legalRep: { 4: legal }, goldPieces: gold, items: [], regionConditions: createRegionConditions() });
const temple = (p) => buildDonationFlow(p, null, 29, { rows: () => [], onClose: () => {}, regionIndex: 4, regionName: 'Wayrest', ownNow: () => 9000, worldNow: () => 9000 });
const text = (win) => (win.top?.rows ?? []).map((l) => l.text).join(' ');

test('AUDIT REP F4: a Yes ends the priest\'s asking - a pardon or a penance paid is the last box, never DFU\'s field pre-filled with 1000; a purse short of it is told so and offered what is left, not the field; only a No goes on to the donation (mutants: the paid offer queued before the field; the short purse sent to the field)', () => {
  const p = citizen(-30, 100000);
  banish(p, 4, 9000);
  const w = temple(p);
  w.input('KeyY');
  assert.match(text(w), /You are pardoned\./);
  w.input('Enter');
  assert.deepEqual([w.done, w.top, p.goldPieces], [true, null, 100000 - PARDON_BASE_PRICE], 'no penance asked after it, no field (REP as shipped: both, and Return gave 1000 more)');
  const q = citizen(-30, 1000);
  const w2 = temple(q);
  w2.input('KeyY');
  assert.match(text(w2), /Your penance is accepted \(\+5\)\./);
  w2.input('Enter');
  assert.deepEqual([w2.done, q.goldPieces], [true, 800]);
  const s = citizen(-30, 300);
  banish(s, 4, 9000);
  const w3 = temple(s);
  w3.input('KeyY');
  assert.match(text(w3), /You do not have enough gold\./);
  w3.input('Enter');
  assert.match(text(w3), /For 200 gold the temple will do penance on your behalf\. Will you pay\?/, 'what is left: the cheaper penance');
  w3.input('KeyN');
  assert.equal(w3.done, true, 'and no field after it');
  const n = citizen(-30, 100000);
  banish(n, 4, 9000);
  const w4 = temple(n);
  w4.input('KeyN');
  assert.match(text(w4), /penance/);
  w4.input('KeyN');
  assert.ok(w4.top?.field, 'two Noes: DFU\'s donation field');
  assert.equal(n.goldPieces, 100000);
});

test('AUDIT REP F5: a raid\'s defence says its thanks - the one legal change a cause moved that REP5\'s notices never said; the mod\'s clamp kept, the line its true delta (mutant: the raid written past the door)', () => {
  const f = (id, o) => [id, { id, rep: 0, region: -1, type: 0, ggroup: 0, parent: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, ...o }];
  const store = { dict: new Map([f(41, {})]) };
  const me = { legalRep: { 17: 98 } };
  const said = [];
  const off = installLegalNotices({ playerEntity: me, say: (l) => said.push(l), regionName: () => 'Wayrest' });
  try {
    assert.equal(grantRaidReputation({ player: me, store }, 17), true);
    assert.deepEqual([me.legalRep[17], said], [100, ['Wayrest thanks you for its defense (+2). You are revered.']]);
    grantRaidReputation({ player: me, store }, 17);
    assert.equal(said.length, 1, 'at the top: nothing moved, nothing said');
  } finally { off(); }
});

test('AUDIT REP F6: DFU\'s per-minute levy stays retired - no production caller; its home says so (mutant: none - the guard is this pin)', () => {
  const callers = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/systems/worldTick.js']
    .filter((file) => /passiveGuardSpawns\(/.test(src(file)));
  assert.deepEqual(callers, []);
  assert.match(src('src/systems/encounters.js'), /AUDIT REP F6: KEPT, WITH NO PRODUCTION CALLER SINCE REP1/);
});

test('AUDIT REP, Mac\'s call ("What do you think? I trust you"): an online death ends the chase - the crime cleared and the chase forgotten at the respawn\'s top, before the teleport\'s await; the charge laid stays (mutants: the crime kept through the death; the chase kept)', () => {
  const w = src('src/scenes/world.js');
  const body = w.slice(w.indexOf('  function respawnOnlinePlayer() {'), w.indexOf('    Promise.resolve().then(async () => {', w.indexOf('  function respawnOnlinePlayer() {')));
  assert.match(body, /reviveForPlay\(playerEntity, \{ force: true \}\);[\s\S]*applyDeathPenalty\(playerEntity\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*setCrimeCommitted\(playerEntity, CRIMES\.None\);\n\s*arrestFlow\.abandon\(\);/,
    'after the revive and the death\'s price, before anything is awaited');
  // abandon's own law (REP2's pin): the chase's charge and its slain watchman go with it; the name keeps the charge
  const r = flowRig(CRIMES.Murder);
  r.flow.onGuardHit(5, () => {});
  r.p.watchSlain = true;
  r.p.crimeCommitted = 0;   // the respawn's clear
  r.flow.abandon();
  assert.deepEqual([r.p.chargedCrime, r.p.watchSlain, legalRepOf(r.p, 2)], [0, false, -20], 'the Murder\'s charge stands whole');
  r.flow.dispose();
});
