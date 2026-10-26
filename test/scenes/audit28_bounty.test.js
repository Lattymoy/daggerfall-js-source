// AUDIT 28 (2026-09-28, Mac: "let's audit everything we have so far before we continue") - BOUNTY1's and DEATH-PENALTY's
// findings, each pinned on the host driven headless (scenes/bountyHost.js), the law (systems/bounty/bountyBoard.js), the wire
// (net/wire.js), the farm pool (scenes/bountyFarms.js), the board's window on the minimal DOM, and the death penalty's
// one statement - each failing on the code before the fix. bible/06-Systems/Bounty-Boards.md (AUDIT 28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { byClass } from '../chargenDom.mjs';
import {
  bountySites, boardPostings, bountyHuntKey, bountyPackOwner, bountyPoseField, bountyPartyKills, bountyClearPays, bountyIdAtLevel,
  newBountyLedger, takeBounty, dropBounty, payBounty, readBountyLedger, parseBountyId,
} from '../../src/systems/bounty/bountyBoard.js';
import { createBountyHost, BOUNTY_REFUSALS } from '../../src/scenes/bountyHost.js';
import { createBountyFarms } from '../../src/scenes/bountyFarms.js';
import { mountBountyBoard } from '../../src/ui/bounty/bountyWindow.js';
import { validPartyPose, RELAY_VERSION } from '../../src/net/wire.js';
import { applyDeathPenalty, stateDeathLoss, statedDeathLoss } from '../../src/systems/deathPenalty.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const allLand = () => true;
const TOWN = { px: 300, py: 200, name: 'Daggerfall' };
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

/** A host on day 900 at level 5, with a mate (`mates` rows mutable) and a pool the packs stand into. */
function hostOf({ level = 5, now = () => 900 * 1440 + 60, here = () => null, social = null, standPack = null } = {}) {
  const entity = { goldPieces: 0, items: [] };
  const pool = [];
  const said = [];
  let board = null;
  const stood = [];
  const host = createBountyHost({
    now, level: () => level, entity: () => entity, townName: () => 'Daggerfall', siteOk: allLand,
    playerPixel: here, canStand: () => true,
    standPack: standPack ?? (({ count }) => {
      const foes = Array.from({ length: count }, () => ({ dead: false, corpse: false, entity: { health: 10 } }));
      pool.push(...foes);
      stood.push(count);
      return { foes: Promise.resolve(foes), dx: 0, dz: 80 };
    }),
    foePool: () => pool, say: (l) => said.push(l), showNotice: () => true,
    openBoardWindow: (d) => { board = d; }, social, rolls: () => 0.3,
  });
  host.openBoard(TOWN);
  return { host, entity, pool, said, stood, board: () => board };
}
/** A posting on day 900 of one group (under six), and the day it is on. */
function smallPosting(level = 5) {
  const sites = bountySites(TOWN.px, TOWN.py, allLand);
  for (let day = 900; day < 1000; day++) {
    const p = boardPostings({ day, ...TOWN, level, sites }).find((q) => q.count < 6 && q.kind !== 'dungeon');
    if (p) return { p, day };
  }
  throw new Error('no small posting');
}

test('AUDIT 28 B1: a hunt a mate already cleared cannot be taken - and a clear pays only a bounty held before it', () => {
  const { p, day } = smallPosting();
  let rows = [];
  const mates = [{ acct: 'x', name: 'Aldric', p: { px: 0, py: 0, in: 0, get bq() { return rows; } } }];
  const { host, entity, board } = hostOf({ now: () => day * 1440 + 60, social: () => ({ acct: 'me', inParty: true, mates }) });
  rows = [{ i: p.id, c: 1, t: day * 1440 + 30 }];
  const t = board().take(p.id);
  assert.deepEqual(t, { ok: false, text: BOUNTY_REFUSALS.party }, 'the hunt is done for the party');
  host.tick(1);
  assert.equal(entity.goldPieces, 0, 'and nothing is paid');
  // held before the clear: paid
  rows = [];
  assert.equal(board().take(p.id).ok, true);
  rows = [{ i: p.id, c: 1, t: day * 1440 + 30 }];
  host.tick(1);
  assert.equal(host.held().length, 1, 'a clear from before I took it pays nothing');
  rows = [{ i: p.id, c: 1, t: day * 1440 + 90 }];
  host.tick(1);
  assert.equal(host.held().length, 0);
  assert.equal(entity.goldPieces, p.gold);
  assert.deepEqual([bountyClearPays({ c: 1, t: 10 }, 10), bountyClearPays({ c: 1, t: 9 }, 10), bountyClearPays({ c: 1 }, 10)], [true, false, false]);
});

test('AUDIT 28 B2: a bounty given up and taken again goes on from its kills, and its live beasts are the hunt\'s again - never a fresh pack', async () => {
  const { p, day } = smallPosting();
  const { host, pool, stood, board } = hostOf({ now: () => day * 1440 + 60, here: () => ({ x: p.target.px, y: p.target.py }) });
  board().take(p.id);
  host.tick(1); await flush();
  assert.deepEqual(stood, [p.count]);
  pool[0].dead = true; pool[0].corpse = true; pool[0].entity.health = 0;
  host.tick(1);
  assert.equal(host.held()[0].killed, 1);
  board().drop(p.id);
  assert.equal(board().take(p.id).ok, true);
  assert.equal(host.held()[0].killed, 1, 'the kill kept');
  host.tick(1); await flush();
  assert.deepEqual(stood, [p.count], 'the beasts still standing are the hunt\'s - none stood again');
  const l = newBountyLedger();
  takeBounty(l, p.id, 0); l.held[0].killed = 3; dropBounty(l, p.id);
  assert.equal(readBountyLedger(JSON.parse(JSON.stringify(l))).droppedKilled[parseBountyId(p.id).slotKey], 3, 'and the save keeps them');
});

test('AUDIT 28 B3: one pack a party - whoever\'s pack already stands owns the hunt, wherever they are; the gone and the dead own nothing', () => {
  const id = '900.300.200.1.5';
  const hunt = bountyHuntKey(id);
  const at = { px: 301, py: 201 };
  const on = (acct, extra = {}, rowExtra = {}) => ({ acct, p: { px: 301, py: 201, in: 0, h: 10, bq: [{ i: id, ...rowExtra }], ...extra } });
  assert.equal(bountyPackOwner('b-9', [on('b-5', { px: 50, py: 50 }, { a: 1 }), on('a-1')], hunt, at), 'b-5', 'standing, it owns it off the pixel too');
  assert.equal(bountyPackOwner('b-9', [on('a-1')], hunt, at), 'a-1', 'nobody standing: the lowest on the pixel');
  assert.equal(bountyPackOwner('b-9', [{ ...on('a-1'), online: false }], hunt, at), 'b-9', 'gone offline: owns nothing');
  assert.equal(bountyPackOwner('b-9', [on('a-1', { h: 0 })], hunt, at), 'b-9', 'dead: owns nothing');
  const l = newBountyLedger();
  takeBounty(l, id, 0);
  assert.deepEqual(bountyPoseField(l, new Map(), { standing: () => true }).bq, [{ i: id, a: 1 }], 'my row says my pack stands');
});

test('AUDIT 28 B4: the hunt\'s kills are the party\'s - a holder takes the most any mate reports, so a hunt part done is handed on part done', () => {
  const { p, day } = smallPosting();
  let k = 0;
  const mates = [{ acct: 'x', name: 'Aldric', p: { px: 0, py: 0, in: 0, get bq() { return [{ i: p.id, k }]; } } }];
  const { host, board } = hostOf({ now: () => day * 1440 + 60, social: () => ({ acct: 'me', inParty: true, mates }) });
  board().take(p.id);
  k = 2;
  host.tick(1);
  assert.equal(host.held()[0].killed, 2);
  assert.deepEqual(host.poseField().bq[0], { i: p.id, k: 2 }, 'and says it on');
  assert.equal(bountyPartyKills([{ p: { bq: [{ i: p.id, k: 9 }, { i: p.id, c: 1, k: 50 }] } }], bountyHuntKey(p.id)), 9, 'a cleared row\'s count is no hunt\'s');
});

test('AUDIT 28 B5: the respawn takes what the death screen said, capped at the purse; a Resurrect takes nothing and says so; hosts that never respawn online show no loss', () => {
  const me = { goldPieces: 100 };
  stateDeathLoss(25);
  me.goldPieces = 300;   // a mate's bounty clear paid me while I lay dead
  assert.equal(applyDeathPenalty(me), 25, 'the screen\'s 25, not a tenth of 300');
  assert.equal(me.goldPieces, 275);
  assert.equal(statedDeathLoss(), null, 'spent');
  stateDeathLoss(80);
  const poor = { goldPieces: 30 };
  assert.equal(applyDeathPenalty(poor), 30, 'never more than the purse');
  assert.equal(applyDeathPenalty({ goldPieces: 40 }), 4, 'no word: a tenth of the purse');
  const w = src('src/scenes/world.js');
  const rez = w.slice(w.indexOf('function resurrectInPlace(rez) {'), w.indexOf('\n  }', w.indexOf('function resurrectInPlace(rez) {')));
  assert.match(rez, /stateDeathLoss\(null\);/, 'a rescue withdraws the loss');
  assert.match(rez, /if \(spared > 0\) townTalk\.say\(RESURRECT_TEXT\.spared\(spared\)\);/);
  assert.match(src('src/ui/deathScreen.js'), /this\.online = online \?\? isOnlinePage\(\);/);
  // PIN MOVED (BAL4, bible/05-Combat/Balance-Arc.md section 6): a death that respawns states it - online, or a Legacy rise offline
  assert.match(src('src/ui/deathScreen.js'), /if \(respawns\) stateDeathLoss\(this\.goldLoss\);/);
  assert.match(src('src/scenes/exterior.js'), /hint: 'ENTER end', online: false \}/, 'the fixed city');
  assert.match(src('src/scenes/dungeonContext.js'), /\.\.\.\(opts\.onlineRespawn \? \{ rises: opts\.legacyWillRise \} : \{ online: false \}\)/, 'the standalone dungeon (and no rise there)');
});

test('AUDIT 28 B6/B9: a load that still holds a bounty keeps its standing pack, and the ways named are named again', async () => {
  const { p, day } = smallPosting();
  const { host, stood, board } = hostOf({ now: () => day * 1440 + 60, here: () => ({ x: p.target.px, y: p.target.py }) });
  board().take(p.id);
  host.tick(1); await flush();
  assert.equal(host.poseField().bq[0].a, 1, 'my pose says my pack stands (AUDIT 28 B3)');
  const rec = JSON.parse(JSON.stringify({ ...host._ledger(), paidIds: [] }));
  host._reset(rec);   // a same-dungeon quickload: the beasts were in the save and stand patched in place
  host.tick(1); await flush();
  assert.deepEqual(stood, [p.count], 'no second pack beside them');
  assert.ok(src('src/scenes/bountyHost.js').includes('clues.clear(); toldOwner.clear(); tierRefused.clear();'));
});

test('AUDIT 28 B7: the pose sends the NEWEST cleared rows first - today\'s never cut for yesterday\'s', () => {
  const l = newBountyLedger();
  const paid = new Map();
  for (let k = 0; k < 8; k++) {
    const id = `${899 + (k >= 4 ? 1 : 0)}.300.200.${k % 4}.5`;
    takeBounty(l, id, k * 10); payBounty(l, id, k * 10);
    paid.set(parseBountyId(id).slotKey, id);
  }
  takeBounty(l, '900.301.200.0.5', 100);
  const bq = bountyPoseField(l, paid).bq;
  assert.equal(bq.length, 8);
  assert.deepEqual(bq.slice(1, 3).map((r) => r.t), [70, 60], 'the latest first');
});

test('AUDIT 28 B8/B10: the owner is asked on the pixel the poses say, and a bounty taken on another clock runs from now', async () => {
  assert.match(src('src/scenes/world.js'), /posePixel: \(\) => playerTravelPixel\(\),/);
  // underground the dungeon's map-table pixel (the host's target) and the pose's pixel differ: a mate below me in the
  // same dungeon (their pose on MY pose's pixel) with a lower account stands the pack, not I
  const { p, day } = smallPosting();
  const stood = [];
  const mates = [{ acct: 'a-0', name: 'Aldric', p: { px: 7, py: 7, in: 0, h: 10, bq: [{ i: p.id }] } }];
  const host = createBountyHost({
    now: () => day * 1440 + 60, level: () => 5, entity: () => ({ goldPieces: 0, items: [] }), townName: () => 'X', siteOk: allLand,
    playerPixel: () => ({ x: p.target.px, y: p.target.py }), posePixel: () => ({ x: 7, y: 7 }), canStand: () => true,
    standPack: ({ count }) => { stood.push(count); return { foes: Promise.resolve([]), dx: 0, dz: 0 }; },
    say: () => {}, showNotice: () => true, openBoardWindow: () => {},
    social: () => ({ acct: 'b-9', inParty: true, mates }),
  });
  assert.equal(host.take(p.id).ok, true);
  host.tick(1); await flush();
  assert.deepEqual(stood, [], 'the mate on my pose\'s pixel owns it');
  const late = smallPosting();
  let now = late.day * 1440 + 60;
  const clocked = hostOf({ now: () => now });
  now = late.day * 1440 + 10_000;   // an offline save's clock, ahead
  clocked.board().take(late.p.id);
  now = late.day * 1440 + 60;       // played online, on the shared clock
  clocked.host.tick(1);
  assert.equal(clocked.host.held()[0].left, 24 * 60, 'a full day from now, never days');
});

test('AUDIT 28 B11: the board keeps the keyboard\'s place through its repaint, and an armed Abandon never outlives its visit', () => {
  const { p } = smallPosting();
  const host = document.createElement('div');
  const rows = [{ posting: p, state: 'open', mates: [], held: null }, { posting: { ...p, id: `${p.id}x`, title: 'Other' }, state: 'open', mates: [], held: null }];
  const view = mountBountyBoard(host, { town: { name: 'Daggerfall' }, rows: () => rows, held: () => [], nextDayIn: () => 60, inParty: () => false, take: () => ({ ok: true }), drop: () => ({ ok: true }), share: () => ({ ok: true }) });
  const before = byClass(host, 'bounty-post-i1')[0];
  before.focus();
  view.repaint();
  const after = byClass(host, 'bounty-post-i1')[0];
  assert.notEqual(after, before, 'the row was rebuilt');
  assert.equal(document.activeElement, after, 'and the rebuilt row has the focus');
  view.unmount();
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /bountyAbandonArmed = null;   \/\/ AUDIT 28 B11/);
  assert.match(src('src/ui/enhanced/enhancedChronicle.js'), /bountyArmed = null;   \/\/ AUDIT 28 B11/);
});

test('AUDIT 28 B12: a mate\'s copy taken up is mine - rebuilt at my level where its tier is mine', () => {
  assert.equal(bountyIdAtLevel('900.300.200.2.4', 5), '900.300.200.2.5');
  assert.equal(bountyHuntKey('900.300.200.2.4'), bountyHuntKey('900.300.200.2.5'), 'the same hunt');
  const { host } = hostOf({ level: 5 });
  assert.equal(host.take('900.300.200.2.4').ok, true);
  assert.equal(host.held()[0].id, '900.300.200.2.5');
});

test('AUDIT 28 B13: a second farm never stands on one that stands', async () => {
  const collider = { heightAt: () => 0, addMesh() {}, removeBucket() {} };
  const farms = createBountyFarms({
    collider: () => collider, pixelTranslation: () => [0, 0, 0], pixelBuilt: () => ({}),
    farmBlockNear: () => ({ models: [{ modelIdNum: 1, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }], side: 100000 }),
    getGpuMesh: async () => ({}), cpuModel: () => ({ positions: [0, 0, 0, 1, 0, 1], indices: [0] }), prepare: async () => {},
    spotOk: () => true, feet: () => [0, 0, 0], mode: () => 'exterior',
  });
  farms.sync([{ id: 'a.1', px: 5, py: 5 }]);
  await flush(); await flush();
  assert.deepEqual(farms.standing(), ['a.1']);
  farms.sync([{ id: 'a.1', px: 5, py: 5 }, { id: 'b.2', px: 5, py: 5 }]);
  await flush(); await flush();
  assert.equal(farms.failed('b.2'), true, 'every spot is on the first farm: the second stands none (its pack stands as any other)');
  assert.equal(farms.occupied(0, 0), true);
});

test('AUDIT 28 the wire: a bounty row carries `k`, `a` and a cleared row\'s `t` - world123 on the branch, world125 since the merge of main', () => {
  const base = { px: 1, py: 1, in: 0, loc: '', h: 1, hm: 1, f: 1, fm: 1, m: 1, mm: 1 };
  const out = validPartyPose({ ...base, bq: [{ i: '900.300.200.1.5', k: 3, a: 1, t: 50 }, { i: '900.300.200.2.5', c: 1, t: 1296060 }, { i: '900.300.200.3.5', k: -1, a: 2 }] });
  assert.deepEqual(out.bq, [{ i: '900.300.200.1.5', k: 3, a: 1 }, { i: '900.300.200.2.5', c: 1, t: 1296060 }, { i: '900.300.200.3.5' }], 'a held row\'s `t` and every value out of its law dropped');
  assert.equal(RELAY_VERSION, 'world267');   // PIN MOVED: world267, KETCH-WORDS (the Sky-Ketch herald cards reworded, the ship no longer she; NOT YET DEPLOYED); PIN MOVED: world266, AUDIT KETCH II (the airship raid: the whole state word carries the wave to five, a sweep by the ship says sw, the number of a voyage is a receipt bound, the last minutes of her crews forty-five, a fight lost after two minutes, the receipts of a fall told before her record goes; world265 on its branch, renumbered past GATE-COURTS at the merge; NOT YET DEPLOYED); PIN MOVED: world265, GATE-COURTS (the night of a gate held in courts of fifty, each seated by the book of the first; NOT YET DEPLOYED); PIN MOVED: world264, REWARD-KILLS (a staff event reward is earned by three kills alone; world258 then world262 on its branch, renumbered past world258-world263 at the merges; NOT YET DEPLOYED); PIN MOVED: world263, HIBERNATE (a quiet cell sleeps, a freeze or mute asks its lease with the door off; world260/world261 on its branch, renumbered past THE FOLD's world260, #1281's world261 and #1238's world262 at the merges); PIN MOVED: world261, EVENT-RULES, BOSS-TRAITS and RAID5 (a realm keeps a death down two minutes for a Resurrect by a friend, SD_REZ_MS; a foe record carries its boss traits bt, its wrath bw and the leader of a raid rl; NOT YET DEPLOYED); PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1's world253 and AUDIT FOE-KEEPS' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub's hello and leave without a walk of every socket; a busy refusal's token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc's lane 3 - world186 on its branch, renumbered past SD-HERALD's world186 and WAGONS1's world187 at the merge); PIN MOVED: world183, CHAP4c (the chapters' seats' titles on the token - past THE WROTHGARIAN ZONE's world177, TAVERN CARDS' world178, HOURS-FIRST's world179, TAVERN-TABLES' world180, TV-BEYOND's world181 and CARDS10's world182 at the merges); world123 on the branch; main's OVERWORLD NAMES, THE MERGE and TV8 took world122-world124 first, then world125 at THE MERGE; MERGE 2 took it past main's REALM-DOOR (world130); STRIKE-SHARED moved it on after (world132), SOFTCAP1 (world133), then PARTY-MAP (world134), then WB9 (world135), then GATE-UX (world136), then KEPT-KILL (world137), then HERALD (world138), then LOOT7 (world139), then WB11 (world140), then CLIMB5 and CLIMB6 (world141), then FRIENDS-SYNC (world142), then ELITE FOES (world143), then SEAT1b (world144), then SEAT1c (world145), then PVP-REF (world146), then SEAT2a (world147), then CROWN1 part two (world148), then SEASON1 part two, the banner ribbon (world149), then SEAT2b part two (b) (world150), then WB12 (world151), then GLYPH-WEAR (world152), then REVENANT-WIRE (world153), then BROKER-CAGE (world154), then ARENA4 (world155 - world142 on its branch, renumbered past main's FRIENDS-SYNC to BROKER-CAGE at the merge), then AEGIS (world160), then GUILD2 (world161), then PRIMARCH (world162), then SUNBABY1 (world163), then PARTY-LEAD (world164), then SERPENT1 (world165 - world162 on its branch), then SERPENT2 (world166), then SHADOW-CLOAK (world167 - world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges), then SERAPH-WINGS (world168), then AUDIT ARENA-LADDER (world169 - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges), then FEUD (world170 - world162-world165 on its branch, renumbered past main's world169 at its merge), then CRYSTAL-FIST (world171 - world170 on its branch, renumbered past FEUD's at the merge), then WATCH-FIX (world172 - the watch record names its resident), then SERPENT3 (world173 - world171 on its branch, renumbered past CRYSTAL-FIST's and WATCH-FIX's at the merges), then LEGACY7 (world174 - the house on the token and the row, world172 on its branch, renumbered past WATCH-FIX's and SERPENT3's at the merge), then TEXT-F1 (world175, the words a player types starred), then SUPER-DUNGEONS (world176 - world171 on its branch, renumbered past CRYSTAL-FIST's at one merge, past WATCH-FIX's, SERPENT3's and LEGACY7's at the next and past TEXT-F1's at the one after)
});
