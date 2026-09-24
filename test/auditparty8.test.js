// AUDIT PARTY8 + AUDIT PARTY-REST (2026-09-23, Mac: "audit the 8 party integration we just pushed") - six lenses
// over PARTY8 (eight seats, the party HUD, PR #330) and the PARTY-REST DROP beneath it, the findings paid and
// PINNED BY EXECUTION where the third lens found fourteen laws pinned by regexes that passed with the feature broken.
// The pure half of the party-rest mechanic lives in systems/partyRestLaw.js now, driven on a table here; the
// picture (net/social.js), the enhanced rest window (under a fake document), the body allocator and the hub are
// driven as themselves. The world.js seams that only a browser can run are pinned by source at the foot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PARTY_READY_TIMEOUT_MS, STAMP_SLACK_MS, stampOf, memberPresent, latestStamp, voteStands, snapshotCancels, cancelRequestFor, mirrorKey,
} from '../src/systems/partyRestLaw.js';
import { validPartyPose, PARTY_MAX, PARTY_OFFLINE_MS, SOCIAL_ROOM, byteGate, QUEST_ROOM_BYTES_PER_S, QUEST_FRAME_MAX, RELAY_VERSION, NOTE_IN_HZ_MAX } from '../src/net/wire.js';
import { SocialState } from '../src/net/social.js';
import { PeerBodies, BODIES_MAX } from '../src/net/peerBodies.js';
import { fakeRoom } from './fakeRoom.mjs';
import { MAX_REST_HOURS, loiterLimitHours, cannotLoiterLines, CANNOT_REST_MORE_THAN_99_HOURS_ID } from '../src/systems/restSession.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const P = Object.freeze({ px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 });
const NOW = 1_700_000_000_000;

// ─── THE LAW, ON A TABLE ────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PARTY-REST: a wire stamp is read against the shared clock - a stamp from beyond the slack is no stamp, so one client cannot hold the party at "Resting vote ongoing" for ever', () => {
  assert.equal(stampOf(NOW - 10, NOW), NOW - 10);
  assert.equal(stampOf(NOW + STAMP_SLACK_MS, NOW), NOW + STAMP_SLACK_MS, 'the slack is honest lead');
  assert.equal(stampOf(NOW + STAMP_SLACK_MS + 1, NOW), 0, '...and a millisecond past it is refused');
  assert.equal(stampOf(1e300, NOW), 0, 'lens 3 ran this against the real gate: `voteAt: 1e300` locked the whole party');
  for (const v of [null, undefined, NaN, Infinity, 'soon']) assert.equal(stampOf(v, NOW), 0);
  const near = [{ p: { voteAt: NOW - 30_000 } }, { p: { voteAt: 1e300 } }, { p: { voteAt: null } }];
  assert.equal(latestStamp(near, 'voteAt', -Infinity, NOW), NOW - 30_000, 'the crafted stamp is ignored; the honest one wins');
  assert.equal(latestStamp(near, 'voteAt', NOW - 5_000, NOW), NOW - 5_000, 'my own refusal counts too');
  assert.equal(latestStamp([], 'voteAt', NaN, NOW), 0, 'no stamps at all reads as long ago');
});

test('AUDIT PARTY-REST: a seated member is present only while the hub says so - an offline seat\'s carried pose is a ghost', () => {
  assert.equal(memberPresent({ acct: 'a', online: true, p: { ...P } }), true);
  assert.equal(memberPresent({ acct: 'a', online: false, p: { ...P } }), false, 'the hub keeps the seat for PARTY_OFFLINE_MS with online: false; its last pose rests nobody and gathers nowhere');
  assert.equal(memberPresent({ acct: 'a', online: true, p: null }), false, 'no pose yet: nowhere to be near');
  assert.equal(memberPresent({ acct: 'a', p: { ...P } }), true, 'a row that says nothing about online (a frame from before AUDIT SOC) is present');
  assert.equal(memberPresent(null), false);
});

test('AUDIT PARTY-REST: a vote stands while it is fresh - cast within the timeout and after the last rest that started here; a world94 client\'s `ready` (no readyAt) carries no vote', () => {
  const started = NOW - 30_000;
  assert.equal(voteStands({ ready: true, readyAt: NOW - 10_000 }, NOW, started), true);
  assert.equal(voteStands({ ready: true, readyAt: NOW - PARTY_READY_TIMEOUT_MS - 1 }, NOW, started), false, 'older than the timeout');
  assert.equal(voteStands({ ready: true, readyAt: started - 1 }, NOW, started), false, 'cast BEFORE the last rest started: that rest spent it (a voter whose window was open when the rest started, or whose tab sat in the background, approved the next one with it)');
  assert.equal(voteStands({ ready: true, readyAt: started + 1 }, NOW, started), true, 'cast after: a fresh round');
  assert.equal(voteStands({ ready: true, readyAt: null }, NOW, started), false, 'no readyAt: no vote');
  assert.equal(voteStands({ ready: true, readyAt: 1e300 }, NOW, started), false, 'a stamp from the future is no stamp');
  assert.equal(voteStands({ ready: false, readyAt: NOW }, NOW, started), false);
  assert.equal(voteStands({ ready: true, readyAt: NOW - 10 }, NOW, -Infinity), true, 'no rest has started here yet: any fresh vote stands');
  assert.equal(voteStands(null, NOW, started), false);
  assert.equal(PARTY_READY_TIMEOUT_MS, 60_000, 'PARTY-REST2b: "make this 60 seconds"');
});

test('AUDIT PARTY-REST: a follower\'s cancel is its sender\'s own marker - two tabs of different ages both stop the rest, one request fires once, a request in flight before the rest is not aimed at it, and a reload does not replay one', () => {
  const me = 'acct-lead';
  const A = { acct: 'acct-a', online: true, p: { ...P, restCancelFor: me, restCancelAt: 1.08e7 } };   // a tab three hours old, a Stop from BEFORE this rest
  const B = { acct: 'acct-b', online: true, p: { ...P, restCancelFor: null, restCancelAt: null } };
  const seen = snapshotCancels([A, B]);
  assert.deepEqual([...seen], [['acct-a', 1.08e7], ['acct-b', null]], 'the markers as they stood when my rest began');
  assert.equal(cancelRequestFor([A, B], me, seen), null, 'A\'s old request was in flight before this rest: not aimed at it (the reload case - the mark used to reset to 0 and this ended the next rest on its first tick)');
  B.p = { ...B.p, restCancelFor: me, restCancelAt: 3e5 };   // a tab five minutes old presses Stop
  assert.equal(cancelRequestFor([A, B], me, seen), B, 'B\'s Stop counts although its stamp is SMALLER than A\'s (the old high-water mark ignored it)');
  assert.equal(cancelRequestFor([A, B], me, seen), null, 'once');
  B.p = { ...B.p, restCancelAt: 12 };   // B reloaded and pressed Stop again: a smaller stamp still
  assert.equal(cancelRequestFor([A, B], me, seen), B, 'a NEW marker from the same sender, whatever its size');
  A.p = { ...A.p, restCancelAt: 1.08e7 + 1 };
  assert.equal(cancelRequestFor([A, B], me, seen), A, 'A pressing Stop for real now: her marker moved');
  const C = { acct: 'acct-c', online: true, p: { ...P, restCancelFor: 'acct-other', restCancelAt: 99 } };
  assert.equal(cancelRequestFor([C], me, seen), null, 'a request naming somebody else is not mine');
  assert.equal(cancelRequestFor([{ acct: 'acct-d', online: true, p: null }], me, seen), null);
});

test('AUDIT PARTY-REST: one mirror per nap - the mirror key is the rester and the shared-clock moment their rest started; an older client\'s pose has no key and is mirrored as before', () => {
  assert.equal(mirrorKey({ acct: 'acct-a', p: { ...P, restStartedAt: NOW } }), `acct-a:${NOW}`);
  assert.notEqual(mirrorKey({ acct: 'acct-a', p: { ...P, restStartedAt: NOW } }), mirrorKey({ acct: 'acct-a', p: { ...P, restStartedAt: NOW + 15_000 } }), 'the same rester\'s next nap is a new key');
  assert.equal(mirrorKey({ acct: 'acct-a', p: { ...P, restStartedAt: null } }), null);
  assert.equal(mirrorKey({ acct: 'acct-a', p: null }), null);
});

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT PARTY-REST wire (world95, then world96 under ALLY-CAST, world97 under its audit): `readyAt` rides the party pose under voteAt\'s own bounds - rounded, floored at zero, absent as null; the version moved with it', () => {
  assert.equal(validPartyPose({ ...P, readyAt: 1758000000000.4 }).readyAt, 1758000000000);
  assert.equal(validPartyPose({ ...P, readyAt: -5 }).readyAt, 0);
  assert.equal(validPartyPose({ ...P }).readyAt, null, 'a world94 client sends none');
  assert.equal(validPartyPose({ ...P, readyAt: 'now' }).readyAt, null, '...and a bad one lands as none, never refusing the pose');
  assert.equal(RELAY_VERSION, 'world105', 'DUEL1 (the duel frame, the card\'s account stamp) last; TITLE-N (the dm frame, the badge vocabulary) before it; ALLY-CAST moved it again, AUDIT ALLY-CAST once more, SPELLFX1\'s pose fields a third time, HCC-PARK + RIDE (the park frame, the pose\'s riding fields) a fourth, DISC7\'s hs and DISC12\'s lh/wb after, and the community arc\'s frames and AUDIT ATTACH\'s meters after them (world102)');
  assert.equal(QUEST_ROOM_BYTES_PER_S, 4 * 1024 * 1024);
  // the quest fan's byte budget, as the hub charges it: a share times the tabs it reaches, borrowing, so one
  // full party's largest share lands whole and the flood behind it waits
  const cost = QUEST_FRAME_MAX * (PARTY_MAX - 1) * 8;   // every member on every tab, the worst case at eight seats
  let g = byteGate(null, NOW, cost, QUEST_ROOM_BYTES_PER_S, true);
  assert.equal(g.pass, true, 'the first lands whole (3.5 MiB against a 4 MiB bucket)');
  g = byteGate(g.bucket, NOW, cost, QUEST_ROOM_BYTES_PER_S, true);
  assert.equal(g.pass, true, 'the second borrows');
  g = byteGate(g.bucket, NOW, cost, QUEST_ROOM_BYTES_PER_S, true);
  assert.equal(g.pass, false, 'the third, in the same instant, is busy - the rate gate alone let eight through');
  g = byteGate(g.bucket, NOW + 2000, cost, QUEST_ROOM_BYTES_PER_S, true);
  assert.equal(g.pass, true, 'two seconds later the debt is paid');
});

// ─── THE PICTURE ────────────────────────────────────────────────────────────────────────────────────────────────

const stateFrame = (members) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], invites: [],
  party: { id: 'q1', leader: 'acct-me', members } });
const seat = (n, over = {}) => ({ acct: `acct-${n}`, name: n, online: true, seen: NOW, peers: [`peer-${n}`], p: null, ...over });

test('AUDIT PARTY-REST picture: a party view that marks a seat OFFLINE drops the pose it carried over; a view with the seat online and no pose keeps it (a pose frame between two views is newer)', () => {
  const s = new SocialState({ now: () => NOW, acct: 'acct-me' });
  s.apply(stateFrame([seat('me'), seat('Bran')]));
  assert.equal(s.applyParty('acct-Bran', { ...P }), true);
  assert.deepEqual(s.others()[0].p, { ...P });
  s.apply({ t: 'social', k: 'party', party: { id: 'q1', leader: 'acct-me', members: [seat('me'), seat('Bran', { p: null })] } });
  assert.deepEqual(s.others()[0].p, { ...P }, 'online and no pose in the view: the last pose rides over');
  s.apply({ t: 'social', k: 'party', party: { id: 'q1', leader: 'acct-me', members: [seat('me'), seat('Bran', { online: false, peers: [], p: null })] } });
  assert.equal(s.others()[0].p, null, 'the hub\'s `online: false` outranks the carried pose - the gate counted this ghost among the online for five minutes, and indoors mirrored its stale rest after every OK');
  assert.equal(memberPresent(s.others()[0]), false);
});

test('AUDIT PARTY8 picture: a member\'s pose is a quiet change - the first pose of a seat moves the version (its row has no line yet), a pose that REPLACES one moves poseVersion alone, so the open social panel never rebuilds its buttons under the pointer', () => {
  const s = new SocialState({ now: () => NOW, acct: 'acct-me' });
  s.apply(stateFrame([seat('me'), seat('Bran'), seat('Cyl')]));
  const kinds = [];
  s.onChange = (k) => kinds.push(k);
  const v0 = s.version, p0 = s.poseVersion;
  s.applyParty('acct-Bran', { ...P });
  assert.equal(s.version, v0 + 1, 'the first pose: a repaint');
  assert.equal(s.poseVersion, p0);
  s.applyParty('acct-Bran', { ...P, h: 40 });
  s.applyParty('acct-Bran', { ...P, h: 30 });
  assert.equal(s.version, v0 + 1, 'the next poses move no version - lens C watched seven Kick buttons replaced under one pose');
  assert.equal(s.poseVersion, p0 + 2, '...they move the pose version, which the HUD watches');
  assert.deepEqual(kinds, ['pose', 'pose', 'pose'], 'and every one is still announced');
  assert.equal(s.others()[0].p.h, 30, 'the row was written in place');
});

// ─── THE ENHANCED REST WINDOW, UNDER A FAKE DOCUMENT ────────────────────────────────────────────────────────────

const mkEl = (tag) => ({
  tag, className: '', textContent: '', id: '', value: '', type: '', min: '', max: '', children: [], style: {}, attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  append(...c) { this.children.push(...c); }, remove() {}, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, focus() {},
  set innerHTML(v) { if (v === '') this.children = []; }, get innerHTML() { return ''; },
});
const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };
const button = (host, label) => findAll(host, 'act').find((b) => b.textContent === label);
async function withRestWindow(fn, over = {}) {
  const prevD = globalThis.document, prevW = globalThis.window, prevRaf = globalThis.requestAnimationFrame;
  const doc = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'),
    addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {}, querySelector: () => null };
  globalThis.document = doc;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = () => 0;
  try {
    const { mountEnhancedRest } = await import('../src/ui/enhancedRest.js');
    const calls = { moveToBed: [], onRentExpired: 0, updateNpcPresence: 0, onRestFinished: 0, onManualStop: 0, onClose: 0, loiter: [] };
    const deps = {
      setResting() {}, setLoitering(v) { calls.loiter.push(v); },
      vitals: () => ({ health: 10, maxHealth: 40, fatigue: 100, magicka: 5 }),
      tickVitals: () => false, fullyHealed: () => false, dead: () => false, enemiesNearby: () => false,
      advanceMinutes() {}, endLines: (id) => [`text ${id}`], say() {},
      moveToBed: (bed) => calls.moveToBed.push(bed), onRentExpired: () => { calls.onRentExpired++; }, updateNpcPresence: () => { calls.updateNpcPresence++; },
      onRestFinished: () => { calls.onRestFinished++; }, onManualStop: () => { calls.onManualStop++; }, onClose: () => { calls.onClose++; },
      ...over.deps,
    };
    const host = mkEl('div');
    const overlay = mountEnhancedRest(host, deps, over.ignoreAllocatedBed ?? false);
    await fn({ overlay, host, deps, calls });
  } finally { globalThis.document = prevD; globalThis.window = prevW; globalThis.requestAnimationFrame = prevRaf; }
}

/** A guild hall with two beds: canRest's guild arm allocates bed 0 - index ZERO, which classic's truthiness test would
 *  have skipped and this window's `!= null` moves to. */
const GUILD = { restPlace: () => ({ inTownLocation: true, insideBuilding: true, buildingType: 1, guildCanRest: true, restMarkers: 2 }) };
test('AUDIT PARTY-REST window: the three interior hooks classic calls - the bed after a timed or full start (never loiter, never under ignoreAllocatedBed), the expired room as the end\'s first arm, the presence re-roll on close', async () => {
  await withRestWindow(async ({ overlay, host, calls }) => {
    button(host, 'Rest for a While').onclick();
    assert.equal(overlay._allocatedBed, 0, 'canRest allocated the guild\'s first bed');
    assert.equal(overlay.state, 'hours');
    overlay._hoursValue = '2';
    button(host, 'Start').onclick();
    assert.equal(overlay.state, 'resting'); assert.equal(overlay.mode, 'timed');
    assert.deepEqual(calls.moveToBed, [0], 'MoveToBed after a timed start, as restWindow.js\'s TimedRestPrompt_OnGotUserInput');
    overlay._end({ rentExpired: true, textId: 5 });
    assert.equal(calls.onRentExpired, 1, 'RemoveExpiredRentedRooms - the first arm of EndRest');
    assert.equal(overlay.state, 'ended');
    assert.equal(calls.updateNpcPresence, 0);
    button(host, 'OK').onclick();
    assert.equal(overlay.done, true);
    assert.equal(calls.updateNpcPresence, 1, 'the presence re-roll on close - shopkeepers hidden before the nap were staying hidden');
    assert.equal(calls.onRestFinished, 1, 'and the raise, as before');
    assert.equal(calls.onClose, 1);
  }, { deps: GUILD });
  await withRestWindow(async ({ overlay, host, calls }) => {
    button(host, 'Rest Until Healed').onclick();
    assert.equal(overlay.mode, 'full'); assert.deepEqual(calls.moveToBed, [0], 'HealedButton moves to the bed too');
  }, { deps: GUILD });
  await withRestWindow(async ({ overlay, host, calls }) => {
    button(host, 'Loiter').onclick(); overlay._hoursValue = '1'; button(host, 'Start').onclick();
    assert.equal(overlay.mode, 'loiter'); assert.deepEqual(calls.moveToBed, [], 'the loiter prompt sets IsLoitering and does NOT move'); assert.deepEqual(calls.loiter, [true]);
  }, { deps: GUILD });
  await withRestWindow(async ({ overlay, host, calls }) => {
    button(host, 'Rest for a While').onclick(); overlay._hoursValue = '2'; button(host, 'Start').onclick();
    assert.deepEqual(calls.moveToBed, [], 'ignoreAllocatedBed reaches the enhanced window now (the door dropped it)');
  }, { ignoreAllocatedBed: true, deps: GUILD });
});

test('AUDIT PARTY-REST window: the hours prompt keeps classic\'s arms - an empty field goes back to selection, a loiter over the limit and a rest over 99 are refused on a page whose OK returns to selection, a zero is a zero-hour rest', async () => {
  await withRestWindow(async ({ overlay, host }) => {
    button(host, 'Loiter').onclick(); overlay._hoursValue = ''; button(host, 'Start').onclick();
    assert.equal(overlay.state, 'selection', 'an empty Return lands the player on the selection page');
    button(host, 'Loiter').onclick(); overlay._hoursValue = String(loiterLimitHours() + 1); button(host, 'Start').onclick();
    assert.equal(overlay.state, 'hoursRefused'); assert.deepEqual(overlay._hoursLines, cannotLoiterLines(), 'classic refused a 99-hour loiter in a town street; this skin clamped it to 99 and started');
    button(host, 'OK').onclick();
    assert.equal(overlay.state, 'selection', 'a retry is a fresh While/Loiter press');
    button(host, 'Rest for a While').onclick(); overlay._hoursValue = String(MAX_REST_HOURS + 1); button(host, 'Start').onclick();
    assert.equal(overlay.state, 'hoursRefused'); assert.deepEqual(overlay._hoursLines, [`text ${CANNOT_REST_MORE_THAN_99_HOURS_ID}`], 'TEXT.RSC 26, where this skin silently cut to 99');
    button(host, 'OK').onclick();
    button(host, 'Rest for a While').onclick(); overlay._hoursValue = String(MAX_REST_HOURS); button(host, 'Start').onclick();
    assert.equal(overlay.state, 'resting'); assert.equal(overlay.session.hoursRemaining, MAX_REST_HOURS, 'exactly 99 is allowed');
  });
  await withRestWindow(async ({ overlay, host }) => {
    button(host, 'Rest for a While').onclick(); overlay._hoursValue = '0'; button(host, 'Start').onclick();
    assert.equal(overlay.state, 'resting'); assert.equal(overlay.session.hoursRemaining, 0, 'classic runs a zero-hour rest; this skin floored it at one');
  });
});

test('AUDIT PARTY-REST window: Escape (the host\'s `back`) and the stack\'s close are the window\'s own Stop / OK / close - mid-rest a Stop that asks the rester too, ended an OK with the raise, a page closed; the confirm box keeps its own answer', async () => {
  await withRestWindow(async ({ overlay, host, calls }) => {
    button(host, 'Rest for a While').onclick(); overlay._hoursValue = '3'; button(host, 'Start').onclick();
    assert.equal(overlay.state, 'resting');
    overlay.input('back');
    assert.equal(overlay.state, 'ended', 'Escape mid-rest is Stop - the rest ends into its wake box');
    assert.equal(calls.onManualStop, 1, '...and a mirror\'s Stop asks the rester to stop (PARTY-REST19) - Tab used to dispose the window and the follower was pulled straight back in');
    assert.equal(calls.onRestFinished, 0, 'not raised yet: the box is up');
    assert.equal(overlay.stopOrClose(), true, 'the stack\'s close arm on the ended page is OK');
    assert.equal(overlay.done, true); assert.equal(calls.onRestFinished, 1, 'the raise rides the OK, as restWindow.js\'s input() names it');
  });
  await withRestWindow(async ({ overlay, calls }) => {
    overlay.input('back');
    assert.equal(overlay.done, true, 'on the selection page: closed'); assert.equal(calls.onRestFinished, 0); assert.equal(calls.onManualStop, 0);
  });
  await withRestWindow(async ({ overlay }) => {
    overlay.state = 'confirm';
    assert.equal(overlay.stopOrClose(), false, 'the illegal-rest box answers Yes/No itself: the stack falls back to dispose');
  });
});

test('AUDIT PARTY-REST window: a rest until healed shows the hours PASSED and a meter that is the health itself - the session never counts its hours down', async () => {
  await withRestWindow(async ({ overlay, host }) => {
    button(host, 'Rest Until Healed').onclick();
    assert.equal(overlay.state, 'resting'); assert.equal(overlay.mode, 'full');
    assert.equal(findAll(host, 'meter-k')[0].children[0].textContent, 'Time passed');
    assert.equal(findAll(host, 'meter-v')[0].textContent, '0h');
    assert.equal(findAll(host, 'meter-fill')[0].style.width, '25%', '10 of 40 health');
    assert.equal(findAll(host, 'vitals-line')[0].textContent, 'Health 10/40  Fatigue 100  Magicka 5');
  });
});

// ─── THE BODIES: A PARTY MATE BEFORE A STRANGER ─────────────────────────────────────────────────────────────────

const rig = () => ({ attach() {}, async build() { return { ok: true }; }, canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode: () => true, thirdActive: () => false, update() {}, drawThird: () => false, unload() {} });
const peer = (id, z, told = true) => ({ id, told, look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, shown: { x: 0, y: 0, z, yaw: 0, mv: 0 } });
const same = (p) => [p.x, p.y, p.z];

test('AUDIT PARTY8 bodies: a party mate is sorted first, takes a stranger\'s slot outright, and never loses hers to one', () => {
  const pb = new PeerBodies({ renderer: {}, createRig: rig, buildOpts: () => ({}), now: () => 1000 });
  const mates = Array.from({ length: PARTY_MAX - 1 }, (_, i) => peer(`m${i}`, 10 + i));   // seven companions, 10..16 away
  const strangers = [peer('s0', 1), peer('s1', 2)];   // two strangers nearer than any of them
  const isMate = (id) => id.startsWith('m');
  pb.sync([...strangers, ...mates], same, 0.016, [0, 0, 0], { priority: isMate });
  assert.equal(pb._bodies.size, BODIES_MAX);
  assert.deepEqual(mates.map((m) => pb._bodies.has(m.id)), mates.map(() => true), 'every companion stands in a body - nearest-first alone gave two of them to the strangers');
  assert.equal(pb._bodies.has('s0'), true, 'the eighth body is the nearest stranger\'s'); assert.equal(pb._bodies.has('s1'), false);
  assert.deepEqual([...pb._bodies.keys()].slice(0, PARTY_MAX - 1), mates.map((m) => m.id), 'the companions are SEATED first - their rigs are the first the one-at-a-time builder makes, not the strangers\' (nearest-first alone seated the two strangers ahead of every companion)');
  // a stranger walking right up to me takes the FAR stranger's slot by the margin rule, never a companion's
  pb.sync([...strangers, peer('s2', 0.1), ...mates], same, 0.016, [0, 0, 0], { priority: isMate });
  assert.deepEqual(mates.map((m) => pb._bodies.has(m.id)), mates.map(() => true), 'the seven companions keep their bodies');
  assert.equal(pb._bodies.has('s2'), true, 'the nearer stranger took the farther stranger\'s slot'); assert.equal(pb._bodies.has('s0'), false);
});

test('AUDIT PARTY8 bodies: a companion arriving when eight strangers stand in the bodies takes the farthest stranger\'s, margin or none; without the priority seam the strangers keep them (the old law, kept for a stranger)', () => {
  const pb = new PeerBodies({ renderer: {}, createRig: rig, buildOpts: () => ({}), now: () => 1000 });
  const strangers = Array.from({ length: BODIES_MAX }, (_, i) => peer(`s${i}`, 1 + i));
  pb.sync(strangers, same, 0.016, [0, 0, 0]);
  assert.equal(pb._bodies.size, BODIES_MAX);
  pb.sync([...strangers, peer('m0', 50)], same, 0.016, [0, 0, 0], { priority: (id) => id === 'm0' });
  assert.equal(pb._bodies.has('m0'), true, 'the companion, fifty away, has a body'); assert.equal(pb._bodies.has('s7'), false, '...the farthest stranger\'s');
  const pb2 = new PeerBodies({ renderer: {}, createRig: rig, buildOpts: () => ({}), now: () => 1000 });
  pb2.sync(strangers, same, 0.016, [0, 0, 0]);
  pb2.sync([...strangers, peer('x0', 50)], same, 0.016, [0, 0, 0]);
  assert.equal(pb2._bodies.has('x0'), false, 'a stranger fifty away yields to the margin, as before');
});

// ─── THE HUB AT EIGHT ───────────────────────────────────────────────────────────────────────────────────────────

const ofKind = (ws, k) => ws.sent.filter((m) => m.t === 'social' && m.k === k);
const lastOf = (ws, k) => ofKind(ws, k).at(-1) ?? null;
const codes = (ws) => ofKind(ws, 'note').map((m) => m.code);
const errors = (ws) => ofKind(ws, 'error').map((m) => m.m);
async function withHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 600) => { clock += ms; };
  const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
  const pose = (ws) => r.raw(ws, JSON.stringify({ t: 'party', p: P }));
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); tick(10); return ws; };
  /** A party of `names`, the first the leader; returns the sockets and the party id. */
  const party = async (names) => {
    const socks = [];
    for (const n of names) socks.push(await join(n));
    await act(socks[0], { k: 'party.invite', peer: `peer-${names[1]}` }); tick();
    const pid = lastOf(socks[1], 'invite').party;
    await act(socks[1], { k: 'party.accept', party: pid }); tick();
    for (let i = 2; i < names.length; i++) { await act(socks[0], { k: 'party.invite', peer: `peer-${names[i]}` }); tick(); await act(socks[i], { k: 'party.accept', party: pid }); tick(); }
    return { socks, pid };
  };
  try { await fn({ r, act, pose, join, party, tick, now: () => clock }); } finally { Date.now = realNow; }
}

test('AUDIT PARTY8 hub: seven founding seats lapsing at once say the lead ONCE - fourteen notes in a burst overran the client\'s gate of ten and the one dropped was "You lead the party now"', () => withHub(async ({ r, pose, party, tick }) => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const { socks, pid } = await party(names);
  assert.equal(r.store.get('party:' + pid).members.length, PARTY_MAX);
  for (const ws of socks.slice(0, 7)) await r.drop(ws);
  tick(PARTY_OFFLINE_MS + 1000);
  const h = socks[7];
  const before = h.sent.length;
  await pose(h); tick();
  const burst = h.sent.slice(before).filter((m) => m.t === 'social' && m.k === 'note').map((m) => m.code);
  assert.equal(burst.filter((c) => c === 'party.lapsed').length, 7, 'each lapse says its note');
  assert.equal(burst.filter((c) => c === 'party.leader').length, 1, 'the lead, once, for whoever holds it at the end');
  assert.ok(burst.length <= NOTE_IN_HZ_MAX, `${burst.length} notes: under the client's gate`);
  assert.equal(r.store.get('party:' + pid).leader, 'acct-h');
  assert.deepEqual(r.store.get('party:' + pid).members, ['acct-h']);
}));

test('AUDIT PARTY8 hub: the lead passes to the longest-standing seat that is ONLINE - an away seat handed the lead left nobody able to kick for five minutes', () => withHub(async ({ r, act, party, tick }) => {
  const { socks, pid } = await party(['a', 'b', 'c']);
  await r.drop(socks[1]); tick();   // b's tab closed: the seat is kept, away
  await act(socks[0], { k: 'party.leave' }); tick();
  assert.equal(r.store.get('party:' + pid).leader, 'acct-c', 'c leads, not the away b');
  assert.deepEqual(r.store.get('party:' + pid).members, ['acct-b', 'acct-c'], 'b keeps the seat for the grace period');
  assert.equal(lastOf(socks[2], 'note')?.code, 'party.leader'); assert.equal(lastOf(socks[2], 'note')?.acct, 'acct-c');
}));

test('AUDIT PARTY8 hub: with EVERY remaining seat away, the lead still falls to the longest-standing, not the newest (S23 survived: no pin held the all-away arm)', () => withHub(async ({ r, act, party, tick }) => {
  const { socks, pid } = await party(['a', 'b', 'c']);
  await r.drop(socks[1]); tick();   // b away
  await r.drop(socks[2]); tick();   // c away
  await act(socks[0], { k: 'party.leave' }); tick();
  assert.deepEqual(r.store.get('party:' + pid).members, ['acct-b', 'acct-c']);
  assert.equal(r.store.get('party:' + pid).leader, 'acct-b', 'nobody online: b, the longest-standing, leads - not c');
}));

test('AUDIT PARTY8 hub: the ninth seat is refused on the ACCEPT path too - seven seated, two invited, the first yes seats the eighth and the second is told the party is full (lens A found this arm unpinned)', () => withHub(async ({ r, act, join, party, tick }) => {
  const { socks, pid } = await party(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  const x = await join('x'), y = await join('y');
  await act(socks[0], { k: 'party.invite', peer: 'peer-x' }); tick();
  await act(socks[0], { k: 'party.invite', peer: 'peer-y' }); tick();
  await act(x, { k: 'party.accept', party: pid }); tick();
  assert.equal(r.store.get('party:' + pid).members.length, PARTY_MAX);
  await act(y, { k: 'party.accept', party: pid }); tick();
  assert.equal(errors(y).at(-1), 'the party is full');
  assert.equal(r.store.get('party:' + pid).members.length, PARTY_MAX);
  assert.deepEqual(lastOf(y, 'state').invites, [], 'and the invite is spent');
}));

// ─── THE SEAMS ONLY A BROWSER RUNS, BY SOURCE ───────────────────────────────────────────────────────────────────

test('AUDIT PARTY8 + PARTY-REST by source: world.js\'s seams - the mirror\'s key and its own rest gate, the follower\'s gather around the leader, the vote origin following the floating origin, the quest echo closed, the bodies\' priority, the pose\'s readyAt; the hosts answer the mirror\'s foe question; the door\'s close is the window\'s own', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const key = mirrorKey\(restingRow\);\s*\n\s*if \(key && key === _partyRestMirrored\) return;[\s\S]{0,900}?if \(mirrorRestRefused\(\)\) return;\s*\n\s*_partyRestMirrored = key;/, 'one mirror per nap, and only where I could rest myself');
  assert.match(w, /const mirrorRestRefused = \(\) => \{\s*\n\s*if \(modes\?\.overlayHeld\) return true;[\s\S]{0,700}?const d = restDecision\(\{\s*\n\s*enemiesNearby: enemies,\s*\n\s*swimming: !!player\.isPlayerSwimming,/, 'the rest gate\'s own questions, the interior stack included');
  assert.match(w, /canceledByFollower: \(\) => false,   \/\/ AUDIT PARTY-REST: a mirror is nobody's target/);
  assert.match(w, /playerEntity\._restCancelRequestFor = null; playerEntity\._restCancelRequestAt = null;/, 'a request aimed at the last rester does not ride into the next nap');
  assert.match(w, /_cancelSeen = snapshotCancels\(social\.others\(\)\);/, 'the markers snapshotted as my rest begins');
  assert.match(w, /readyAt: _partyRestReady && Number\.isFinite\(_partyRestReadyAt\) && _partyRestReadyAt > 0 \? _partyRestReadyAt : null,/);
  assert.match(w, /if \(_partyRestVoteOrigin\) \{ _partyRestVoteOrigin\[0\] \+= r\.offset\[0\]; _partyRestVoteOrigin\[1\] \+= r\.offset\[1\]; _partyRestVoteOrigin\[2\] \+= r\.offset\[2\]; \}/, 'PARTY-REST16\'s origin follows the floating origin');
  assert.match(w, /if \(q\) _questSyncSeen\.set\(quest\.questName, q\.getLogMessages\(\)\?\.length \?\? 0\);/, 'what I just received is what I have seen: no echo');
  assert.match(w, /peerBodies\.sync\(afoot, onlineToScene, dt, player\.pos, \{ priority: \(id\) => !!social\?\.isPartyPeer\(id\) \}\);/);   // RIDE: the bodies stand the peers afoot - a rider is peerRiders' (hcc_park.test.js)
  assert.match(w, /inside: \(\) => \(modes\?\.mode \?\? 'exterior'\) !== 'exterior',/, 'the mirror\'s deps say where the follower stands');
  assert.match(w, /const restWin = !isEnhanced\(\) \? null/, 'ONLINE-REST1: a classic-skin rest is nobody\'s to mirror');
  assert.match(rd('src/scenes/worldModes.js'), /restEnemiesNearby: \(\) => interiorEnemiesNearby\(\{ resting: true \}\),/);
  assert.match(rd('src/scenes/dungeonContext.js'), /restEnemiesNearby: \(\) => _restDeps\.enemiesNearby\(\),/);
  assert.match(rd('src/ui/restDoor.js'), /unregister = registerOverlay\(\(\) => \{ if \(!overlay\.stopOrClose\?\.\(\)\) overlay\.dispose\(\); \}\);/);
  assert.match(rd('src/ui/socialPanel.js'), /if \(n\.subNode\) liveSubs\.push\(\{ el: n\.subNode, of: \(\) => partyPoseText\(m\.p\) \}\);/, 'a pose writes its row\'s line in place');
  assert.match(rd('src/ui/partyPanel.js'), /if \(social\.version === painted && \(social\.poseVersion \?\? 0\) === paintedPose\) \{ paintLive\(\); return; \}/, 'the HUD watches the pose version');
  const hub = rd('server/src/index.js');
  assert.match(hub, /const bytes = byteGate\(this\._roomQuestBytes, now, out\.length \* targets\.length, QUEST_ROOM_BYTES_PER_S, true\);/, 'the quest fan pays in bytes');
  assert.match(hub, /party = await this\._partyOut\(id, party, now, 'party\.lapsed', rec\?\.name \?\? null, \{ leaderNote: false \}\);/);
});
