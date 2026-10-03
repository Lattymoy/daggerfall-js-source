// TV8 - GROUP TRAVEL, THE LEADER DRIVES (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28: "Leader
// drives"). The law (systems/partyWalk.js), the wire (net/wire.js validPartyPose `tw`/`ts`, world124), the host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as PW from '../src/systems/partyWalk.js';
import { walkOf, memberWalkStep, leaderMustHalt, PARTY_WALK_TS_SKEW_MS, PARTY_WALK_RADIUS_M, PARTY_WALK_ASK_MS, PARTY_WALK_GRACE_MS, PARTY_WALK_HALT_MS, NO_WALK_ANSWER, WALK_BALKS, walkBegin, leaderWalkStep, walkHeard, memberAnswer, memberFollowing, memberStopOf, walkAskStands, sameWalkDest, walkHaltLapsed } from '../src/systems/partyWalk.js';
import { validPartyPose, PARTY_WALK_RELAY_MIN, relaySupportsPartyWalk, RELAY_VERSION } from '../src/net/wire.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { mapPixelWorldOrigin } from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { modSetting } from '../src/systems/modSettings.js';
import { memberPresent } from '../src/systems/partyRestLaw.js';
import { YesNoBoxWindow } from '../src/ui/yesNoBox.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { TRAVEL_VIEW_TEXT } from '../src/scenes/travelView.js';
import { BAND_GIVE_UP_MS } from '../src/systems/travelBands.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('TV8 law: a walk as the leader\'s pose carries it - the destination pixel, a spot\'s own point, the round\'s stamp, set out at once, walking', () => {
  assert.deepEqual(walkOf({ pixel: { x: 120, y: 340 } }, 5000.4), { x: 120, y: 340, at: 5000, go: 5000, h: null });
  assert.deepEqual(walkOf({ pixel: { x: 1, y: 2 }, point: { x: 40000.6, z: 7.2 } }, 9), { x: 1, y: 2, at: 9, go: 9, h: null, sx: 40001, sz: 7 });
  assert.equal(PARTY_WALK_RADIUS_M, 60);
  assert.equal(PARTY_WALK_ASK_MS, 30_000);
});

test('TV8 law: A MEMBER\'S NEXT STEP - asked of a new round when gathered and still; begun on a yes; halted with the party; begun again when it sets out again; a no, an old round or a member away is never asked', () => {
  const tw = { x: 5, y: 6, at: 1000, go: 1000, h: null };
  const fresh = { at: null, yes: false, go: null };
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, now: 2000 }), 'ask');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: false, journeying: false, now: 2000 }), null, 'away from the leader: not asked');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: true, now: 2000 }), null, 'on a journey of my own: not asked');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, now: 1000 + PARTY_WALK_ASK_MS + 1 }), null, 'a round past its asking');
  assert.equal(memberWalkStep({ tw, mine: { at: 1000, yes: false, go: null }, gathered: true, journeying: false, now: 2000 }), null, 'a no stays a no');
  assert.equal(memberWalkStep({ tw, mine: { at: 1000, yes: true, go: null }, gathered: true, journeying: false, now: 2000 }), 'start', 'a yes: begin');
  assert.equal(memberWalkStep({ tw, mine: { at: 1000, yes: true, go: 1000 }, gathered: true, journeying: true, now: 2000 }), null, 'walking with the party');
  const halted = { ...tw, h: 3000 };
  assert.equal(memberWalkStep({ tw: halted, mine: { at: 1000, yes: true, go: 1000 }, gathered: true, journeying: true, now: 3100 }), 'halt', 'the party halted: I stop');
  assert.equal(memberWalkStep({ tw: halted, mine: { at: 1000, yes: true, go: 1000 }, gathered: true, journeying: false, now: 3100 }), null, 'stopped already');
  const again = { ...tw, go: 4000, h: null };
  assert.equal(memberWalkStep({ tw: again, mine: { at: 1000, yes: true, go: 1000 }, gathered: false, journeying: false, now: 4100 }), 'start', 'set out again: I take it up (wherever I stand)');
  // AUDIT OW3 P8 (the lead's call): the leader's walk ENDED - an arrival, a forget, the party gone - RELEASES me: my
  // journey is my own and carries on to the same place; a halt comes from `tw.h` alone
  assert.equal(memberWalkStep({ tw: null, mine: { at: 1000, yes: true, go: 4000 }, gathered: true, journeying: true, now: 5000 }), null, 'the leader\'s walk is over: I am released, and walk on');
  assert.equal(memberWalkStep({ tw: null, mine: fresh, gathered: true, journeying: true, now: 5000 }), null, 'a journey of my own is never the party\'s to stop');
});

test('TV8 law: THE LEADER\'S HALT - a present member\'s stop after the party last set out halts the leader (and the halt reaches everyone); an older stop, a halted walk or none never', () => {
  const tw = { x: 5, y: 6, at: 1000, go: 2000, h: null };
  assert.equal(leaderMustHalt(tw, [null, 2500]), true);
  assert.equal(leaderMustHalt(tw, [1500, undefined]), false, 'a stop before the party set out again');
  assert.equal(leaderMustHalt({ ...tw, h: 3000 }, [3500]), false, 'halted already');
  assert.equal(leaderMustHalt(null, [9999]), false);
  assert.equal(leaderMustHalt(tw, []), false);
  // AUDIT OW5 P4: never a stamp from the future - one far ahead read as a stop after every set-out
  assert.equal(leaderMustHalt(tw, [8.64e15], 2600), false, 'a stamp from the future halts nothing');
  assert.equal(leaderMustHalt(tw, [2600 + PARTY_WALK_TS_SKEW_MS], 2600), true, 'within the skew: a stop');
  assert.equal(leaderMustHalt(tw, [2601 + PARTY_WALK_TS_SKEW_MS], 2600), false, '...and just past it: none');
});

test('TV8 wire (world124): the leader\'s walk and a member\'s stop ride the party pose, each refused alone when out of its law - never the pose; a relay from before strips them', () => {
  const base = { px: 10, py: 20, h: 50, hm: 50, f: 40, fm: 40, m: 30, mm: 30 };
  const ok = validPartyPose({ ...base, tw: { x: 120, y: 340, at: 5000, go: 5000, h: null, sx: 40001, sz: 7 }, ts: 6000 });
  assert.deepEqual(ok.tw, { x: 120, y: 340, at: 5000, go: 5000, h: null, sx: 40001, sz: 7 });
  assert.equal(ok.ts, 6000);
  assert.deepEqual(validPartyPose({ ...base, tw: { x: 1, y: 2, at: 3, go: 4, h: 5 } }).tw, { x: 1, y: 2, at: 3, go: 4, h: 5 }, 'halted; no spot');
  for (const bad of [{ x: -1, y: 2, at: 3, go: 3 }, { x: 1000, y: 2, at: 3, go: 3 }, { x: 1, y: 500, at: 3, go: 3 }, { x: 1.5, y: 2, at: 3, go: 3 }, { x: 1, y: 2, at: -3, go: 3 }, { x: 1, y: 2, at: 3 }, { x: 1, y: 2, at: 3, go: 3, sx: 1 }, [1, 2], 'x']) {
    const v = validPartyPose({ ...base, tw: bad });
    assert.equal(v.tw, undefined, `refused: ${JSON.stringify(bad)}`);
    assert.equal(v.px, 10, 'the pose itself stands');
  }
  assert.equal(validPartyPose({ ...base, ts: -1 }).ts, undefined);
  assert.equal(validPartyPose({ ...base, ts: 'x' }).ts, undefined);
  assert.equal(RELAY_VERSION, 'world155');   // ARENA4 moved it on last (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main's FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant's name, nm, and a beaten one's kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon's Breach - its words in the omen's lines and the herald's posts, the faithful's rite - main's CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc's six relays renumbered past main's HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch's tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose's climb - `cl`, `cw` and a move's `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL's `heal` and a chart row's `hl` with it - main's HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main's PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT's badge vocabulary (world129); before it WB8 moved it on (world128: the Warden's marks - world126 on its branch, one relay past OW6L); OW6L before it (world127: the overworld ledger of a cell)
  assert.equal(PARTY_WALK_RELAY_MIN, 124);
  assert.deepEqual(['world123', 'world124', 'world130', 'nope'].map(relaySupportsPartyWalk), [false, true, true, false]);
});

test('TV8 host: the leader\'s walk begins with an Overworld journey (a gathered member, a hub that carries it) and runs on the law\'s own steps (AUDIT OW3: leaderWalkStep, halted through the panel); a member hears it with a grace, is asked only when free, walks the same journey on a yes, halts with the party through the panel, publishes only their own stops', () => {
  const w = rd('src/scenes/world.js'), on = rd('src/net/online.js');
  assert.match(on, /if \(primary\) this\.partyWalkOk = relaySupportsPartyWalk\(relayV\);/, 'the hub that carries it');
  assert.match(w, /\.\.\.\(_walkLead && socialLink\(\)\?\.partyWalkOk \? \{ tw: _walkLead \} : \{\}\),/);
  assert.match(w, /\.\.\.\(_walkTs != null && socialLink\(\)\?\.partyWalkOk \? \{ ts: _walkTs \} : \{\}\),/);
  // the begin: AUDIT OW3 P2 - the old walk cleared FIRST; P9 - the law decides a new round or the halted walk set out again
  assert.match(w, /function partyWalkBegin\(dest\) \{\n\s*const prev = _walkLead;\n\s*_walkLead = null;[^\n]*\n\s*if \(!social\?\.party \|\| !social\.leads\?\.\(\) \|\| !socialLink\(\)\?\.partyWalkOk\) return;\n\s*const gathered = social\.others\(\)\.filter\(\(m\) => memberPresent\(m\) && distanceToPartyAccount\(m\.acct\) <= PARTY_WALK_RADIUS_M\);\n\s*_walkLead = walkBegin\(prev, dest, walkNow\(\), gathered\.length\);\n\s*_walkCleared = travelOptions\?\.cleared \?\? 0;/, 'the walk begins with a member gathered - or the halted one sets out again');
  assert.match(w, /partyWalkBegin\(\{ pixel: summary\.pixel \}\);/, 'a place\'s journey');
  assert.match(w, /partyWalkBegin\(\{ pixel: pix, point: \{ x: n\.x, z: n\.z \} \}\);/, 'a spot\'s');
  // AUDIT OW3 P1: MOVING is the panel AND an autopilot; P5: an END is Travel Options' own count moving
  assert.match(w, /const walkJourneying = \(\) => !!travelOptions\?\.isTravelActive && !!travelOptions\.state\?\.autopilot;/);
  assert.match(w, /const cleared = travelOptions\?\.cleared \?\? 0, ended = cleared !== _walkCleared;[^\n]*\n\s*_walkCleared = cleared;/);
  assert.match(w, /const next = leaderWalkStep\(\{ tw: _walkLead, journeying, dest: walkDestLive\(\), ended, stops, now \}\);\n\s*_walkLead = next\.tw;\n\s*if \(next\.halt\) \{ travelOptions\?\.messages\?\.pauseTravel\(\); tvSay\(TRAVEL_VIEW_TEXT\.partyHalted\); \}/, 'the leader\'s step, and a member\'s stop halts the leader through the panel');
  assert.match(w, /const stops = social\.others\(\)\.filter\(\(m\) => memberPresent\(m\)\)\.map\(\(m\) => m\.p\?\.ts\);/);
  assert.match(w, /if \(_walkLead && !leads\) _walkLead = null;/, 'no longer the leader: no walk to lead');
  // A MEMBER - AUDIT OW3 P7: heard with a grace; P3: the answer dies with its round
  assert.match(w, /_walkHeard = walkHeard\(_walkHeard, \{ acct: leadRow\?\.acct \?\? null, present: memberPresent\(leadRow\), tw: leadRow\?\.p\?\.tw \?\? null \}, nowMs\);\n\s*const tw = leadRow \? _walkHeard\.tw : null;\n\s*_walkMine = memberAnswer\(_walkMine, tw\);/);
  assert.match(w, /const stop = memberStopOf\(\{ was: _walkWas, journeying, ended, following: memberFollowing\(_walkMine, tw\), why \}\);\n\s*if \(stop === 'stop' \|\| stop === 'balk'\) _walkTs = now;[^\n]*\n\s*if \(stop === 'balk'\) _walkMine = \{ \.\.\._walkMine, balk: true \};[^\n]*\n\s*else if \(stop === 'done'\) _walkMine = \{ \.\.\._walkMine, yes: false \};/, 'a member publishes their own stops - never the party\'s halt, never an arrival (AUDIT OW4 P4: a balk marked)');
  // AUDIT OW3 P4: the question - on an empty slot, taken down when its round or its asking goes, forgotten when replaced;
  // AUDIT OW4 P3: tracked while the STACK holds it, withdrawn and closed through it, an answer counted only while it stands
  assert.match(w, /if \(_walkBox && !townTalk\.containsOverlay\(_walkBox\)\) \{ _walkBox = null; _walkBoxRound = null; \}/);
  assert.match(w, /if \(_walkBox && !walkAskStands\(\{ tw, round: _walkBoxRound, now, danger: walkDanger\(\) \}\)\) walkBoxDown\(\);/);
  assert.match(w, /function walkBoxDown\(\) \{\n\s*const box = _walkBox;\n\s*_walkBox = null; _walkBoxRound = null;\n\s*if \(!box\) return;\n\s*box\.withdraw\(\);\n\s*townTalk\.closeOverlay\(box\);/);
  assert.match(w, /const step = memberWalkStep\(\{ tw, mine: _walkMine, gathered, journeying, onWalk, was: _walkWas, free: !!tw && walkFree\(\), now \}\);/);
  assert.match(w, /const onWalk = journeying && sameWalkDest\(tw, walkDestLive\(\), true\);/);
  // AUDIT OW3 P4/P6: FREE - outdoors, alive, no window of any kind, no danger; AUDIT OW4 P5: no arrival in flight
  assert.match(w, /const walkFree = \(\) => !!travelOptions && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && playerSpawned && playerEntity\.health > 0 && !modes\?\.deathUp\?\.\(\)\n\s*&& !worldMoveBusy\(\) && !townTalk\.overlay && !gamePaused\(\) && !\(modes\?\.modalWindowUp\?\.\(\) \?\? false\) && pointerSurfaces\.size === 0 && !walkDanger\(\)\n(?:\s*\/\/[^\n]*\n)*\s*&& travelViewAllowed\(\)\.ok && !csaAboard\.aboard;/);   // PIN MOVED (AUDIT OW5 P1): the Overworld's own gate and a passenger's refusal
  assert.match(w, /const walkDanger = \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\)\);/);
  assert.match(w, /onYes: \(\) => walkAnswered\(box, round, true\),\n\s*onNo: \(\) => walkAnswered\(box, round, false\),/);
  // PIN MOVED (AUDIT OW5 P3): a sea spot is walked as the sea (the planner's byte for its pixel)
  assert.match(w, /const water = tw\.sx != null && !there && tvWater\(tw\.x, tw\.y\);\n\s*const ok = summary \? travelViewRouteTo\(summary\) : travelViewWalkTo\(tvSceneOf\(tw\.sx \?\? o\.x \+ 16384, tw\.sz \?\? o\.z \+ 16384, 0\), \{ x: tw\.x, y: tw\.y \}, \{ door, water \}\);\n\s*_walkMine = \{ \.\.\._walkMine, go: tw\.go, yes: ok, balk: false \};/, 'the same journey');
  // AUDIT OW4 P4: the travel frame says why a journey stopped, for the walk's next step
  assert.match(w, /_travelDrive = report\?\.drive\?\.arrived === false \? report\.drive : null;\n\s*if \(report\?\.stopped\) _walkStopWhy = report\.stopped;/);
  // PIN MOVED (AUDIT OW5 P5): a halt is said, leader and member alike, once the panel is down
  assert.match(w, /\} else if \(step === 'halt'\) \{\n\s*travelOptions\?\.messages\?\.pauseTravel\(\);[^\n]*\n\s*tvSay\(TRAVEL_VIEW_TEXT\.partyHalted\);/, 'halted with the party, through the panel (AUDIT OW3 P1)');
  assert.match(w, /\} else if \(step === 'leave'\) \{\n\s*_walkMine = \{ \.\.\._walkMine, yes: false \};/);
  assert.match(w, /_walkWas = walkJourneying\(\) && memberFollowing\(_walkMine, tw\) && sameWalkDest\(tw, walkDestLive\(\), true\);\n\s*\}/, 'read AFTER the party\'s halt, so its stop is never taken for mine');
  assert.doesNotMatch(w.slice(w.indexOf('function partyWalkFrame('), w.indexOf('const partyFrame = (nowMs) => {')), /interruptTravel\(\)/, 'AUDIT OW3 P1: never the bare interrupt, which leaves the panel up');
  assert.match(w, /partyWalkFrame\(nowMs\);   \/\/ TV8/);
  assert.match(w, /let _walkLead = null;   \/\/ TV8[^\n]*\n[\s\S]*?let _walkHeard = null;[^\n]*\n\s*let _walkCleared = 0;[^\n]*\n[\s\S]*?let social = null, _partyComposedAt/, 'above its readers (BOOT-TDZ)');
});

// ── AUDIT OW3 (2026-09-28): THE LAW, RUN ─────────────────────────────────────────────────────────────────────────────

const PLACE = { pixel: { x: 505, y: 250 } };
const SPOT = { pixel: { x: 505, y: 250 }, point: { x: 40000.4, z: 9000.6 } };

test('AUDIT OW3 P2/P9: THE LEADER\'S BEGIN - a new round only with someone gathered and never the old walk; the halted walk\'s own place taken up again SETS IT OUT again (the same round, near or far); the same place while it walks is the same walk', () => {
  assert.deepEqual(walkBegin(null, PLACE, 1000, 1), walkOf(PLACE, 1000), 'a new round');
  assert.equal(walkBegin(null, PLACE, 1000, 0), null, 'nobody gathered: no walk');
  const other = walkOf({ pixel: { x: 9, y: 9 } }, 500);
  assert.equal(walkBegin({ ...other, h: 800 }, PLACE, 1000, 0), null, 'P2: a halted walk elsewhere is never carried into a journey with nobody gathered');
  assert.deepEqual(walkBegin({ ...other, h: 800 }, PLACE, 1000, 2), walkOf(PLACE, 1000), 'another place: a new round');
  const halted = { ...walkOf(PLACE, 500), go: 600, h: 800 };
  assert.deepEqual(walkBegin(halted, PLACE, 1000, 0), { ...halted, go: 1000, h: null }, 'P9: set out again - the same `at`, so nobody is asked again or dropped (and nobody need be gathered)');
  const walking = walkOf(PLACE, 500);
  assert.equal(walkBegin(walking, PLACE, 1000, 3), walking, 'the flag clicked while it walks: the same walk');
  const spotHalted = { ...walkOf(SPOT, 500), h: 700 };
  assert.deepEqual(walkBegin(spotHalted, { pixel: SPOT.pixel, point: { x: 41000, z: 9100 } }, 1000, 0), { ...spotHalted, go: 1000, h: null, sx: 41000, sz: 9100 }, 'a spot in its pixel again: set out, to the new point');
  assert.deepEqual(walkBegin(halted, SPOT, 1000, 1), walkOf(SPOT, 1000), 'a place\'s walk is never set out again as a spot: a new round');
  assert.equal(sameWalkDest(walkOf(PLACE, 1), { x: 505, y: 250, spot: true }), false);
  assert.equal(sameWalkDest(walkOf(PLACE, 1), { x: 505, y: 250, spot: true }, true), true, 'a member\'s spot to an unfound place is the walk\'s');
  assert.equal(sameWalkDest(walkOf(PLACE, 1), { x: 505, y: 251 }, true), false);
  assert.equal(sameWalkDest(null, { x: 505, y: 250 }), false);
});

test('AUDIT OW3 P1/P2/P5: THE LEADER\'S STEP - a stop halts, the journey taken up again sets out, an end (arrival, forget) ends; a member\'s stop halts AT ONCE and says to stop; a spot\'s stop is a halt, never an arrival; a halted walk forgotten, left with nothing to resume or replaced is dropped', () => {
  const place = { x: 505, y: 250, spot: false };
  const tw = walkOf(PLACE, 1000);
  const step = (q) => leaderWalkStep({ tw, journeying: true, dest: place, ended: false, stops: [], now: 2000, ...q });
  assert.deepEqual(step({}), { tw, halt: false }, 'walking');
  assert.deepEqual(step({ journeying: false }), { tw: { ...tw, h: 2000 }, halt: false }, 'my stop: the walk halts');
  assert.deepEqual(step({ journeying: false, ended: true }), { tw: null, halt: false }, 'my arrival (or Exit): the walk is over');
  assert.deepEqual(step({ stops: [1500, 2500] }), { tw: { ...tw, h: 2000 }, halt: true }, 'P1: a member\'s stop - halted now, and my journey is to stop');
  assert.deepEqual(step({ dest: { x: 9, y: 9, spot: false } }), { tw: null, halt: false }, 'a journey of another place: over');
  assert.deepEqual(step({ dest: null }), { tw: null, halt: false }, 'the follow key (no destination): over');
  // P5: a SPOT walk's stop nulls its route - still a halt, not the end the old destination fields read
  const spotTw = walkOf(SPOT, 1000);
  assert.deepEqual(leaderWalkStep({ tw: spotTw, journeying: false, dest: null, ended: false, stops: [], now: 2000 }).tw, { ...spotTw, h: 2000 });
  const spotHalted = { ...spotTw, h: 2000 };
  assert.equal(leaderWalkStep({ tw: spotHalted, journeying: false, dest: null, ended: false, stops: [], now: 3000 }).tw, spotHalted, 'a halted spot walk waits for the next click');
  // halted: the halt/resume cycle, and P2's drops
  const halted = { ...tw, h: 2000 };
  const hstep = (q) => leaderWalkStep({ tw: halted, journeying: false, dest: place, ended: false, stops: [9999], now: 3000, ...q }).tw;
  assert.equal(hstep({}), halted, 'halted, the place kept for the resume (a stop after the halt changes nothing)');
  assert.deepEqual(hstep({ journeying: true }), { ...halted, go: 3000, h: null }, 'the map\'s Resume: set out again');
  assert.equal(hstep({ ended: true }), null, 'P2: forgotten while halted (the map\'s Forget it, a load)');
  assert.equal(hstep({ dest: null }), null, 'P2: a place\'s walk with nothing left to resume');
  assert.equal(hstep({ journeying: true, dest: { x: 9, y: 9, spot: false } }), null, 'P2: the next journey elsewhere never sets the old walk out');
  assert.equal(hstep({ journeying: true, dest: null }), null);
  assert.equal(leaderWalkStep({ tw: spotHalted, journeying: true, dest: null, ended: false, stops: [], now: 3000 }).tw, null, 'the follow key after a halted spot walk: over');
  assert.deepEqual(leaderWalkStep({ tw: null, journeying: true, dest: place, ended: false, stops: [9999], now: 1 }), { tw: null, halt: false });
});

test('AUDIT OW3 P7: THE LEADER\'S WALK AS HEARD - a pose that says it is believed at once (walk or none); no pose keeps the last walk PARTY_WALK_GRACE_MS, then lets it go; a new leader starts from nothing', () => {
  const tw = walkOf(PLACE, 1000);
  let h = walkHeard(null, { acct: 'a', present: true, tw }, 100);
  assert.deepEqual(h, { acct: 'a', tw, at: 100 });
  h = walkHeard(h, { acct: 'a', present: false, tw: null }, 100 + PARTY_WALK_GRACE_MS);
  assert.equal(h.tw, tw, 'a reconnect\'s moment without a pose: still walking');
  assert.equal(walkHeard(h, { acct: 'a', present: false, tw: null }, 101 + PARTY_WALK_GRACE_MS).tw, null, 'gone past the grace: no walk');
  assert.equal(walkHeard(h, { acct: 'a', present: true, tw: null }, 150).tw, null, 'a pose with no walk: none, at once');
  assert.equal(walkHeard(h, { acct: 'b', present: false, tw: null }, 150).tw, null, 'another leader: never the last one\'s walk');
  assert.ok(PARTY_WALK_GRACE_MS >= 5_000 && PARTY_WALK_GRACE_MS < PARTY_WALK_ASK_MS);
});

test('AUDIT OW3 P3/P5: A MEMBER\'S ANSWER dies with its round; FOLLOWING is the current round\'s yes, walked on; what my journey did - my own stop, an arrival (never a stop), the party\'s halt (never echoed)', () => {
  const tw = walkOf(PLACE, 1000);
  const yes = { at: 1000, yes: true, go: 1000 };
  assert.equal(memberAnswer(yes, tw), yes);
  assert.equal(memberAnswer(yes, { ...tw, go: 5000, h: null }), yes, 'P9: the same round set out again keeps it');
  assert.deepEqual(memberAnswer(yes, null), NO_WALK_ANSWER, 'P3: no walk - the yes is gone (my next journey of my own is mine)');
  assert.deepEqual(memberAnswer(yes, walkOf(PLACE, 7000)), NO_WALK_ANSWER, 'P3: another round - never following it');
  assert.equal(memberFollowing(yes, tw), true);
  assert.equal(memberFollowing({ ...yes, go: null }, tw), false, 'not walked on yet');
  assert.equal(memberFollowing({ ...yes, yes: false }, tw), false);
  assert.equal(memberFollowing(yes, walkOf(PLACE, 7000)), false, 'P3: another round\'s walk');
  assert.equal(memberFollowing(yes, null), false);
  assert.equal(memberStopOf({ was: true, journeying: false, ended: false, following: true }), 'stop', 'a foe stopped my walk: the party hears it');
  assert.equal(memberStopOf({ was: true, journeying: false, ended: true, following: true }), 'done', 'P5: my arrival (a spot\'s as well) - never a stop');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: true, following: true }), 'done', 'forgot my halted journey: my part is over');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: false, following: true }), null, 'the party halted me (the host drops `was`): never echoed');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: false, following: false }), null, 'P3: a stop of a journey of my own is mine');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: true, following: false }), null);
  assert.equal(memberStopOf({ was: true, journeying: false, ended: false, following: false }), null, 'released in the same breath (the walk gone, a new round): my stop halts nobody');
  assert.equal(memberStopOf({ was: true, journeying: true, ended: false, following: true }), null, 'walking on');
});

test('AUDIT OW3 P4/P6/P8/P10: a member is asked, and sets out, only when FREE (and waits, the set-out unwalked, until then); a journey elsewhere leaves the walk; no walk releases; the question stands only for its round, within its asking, out of danger', () => {
  const tw = walkOf(PLACE, 1000);
  const fresh = NO_WALK_ANSWER;
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, free: false, now: 2000 }), null, 'P4: a window up, a foe near: not asked now');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, free: true, now: 2000 }), 'ask', '...asked when free');
  const yes = { at: 1000, yes: true, go: null };
  assert.equal(memberWalkStep({ tw, mine: yes, gathered: true, journeying: false, free: false, now: 2000 }), null, 'P6: in a dungeon, dead, mid-fight, a window open: waits');
  assert.equal(memberWalkStep({ tw, mine: yes, gathered: false, journeying: false, free: true, now: 90_000 }), 'start', 'P6: ...and starts the step it is able (the set-out was never marked walked)');
  assert.equal(memberWalkStep({ tw, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: false, now: 2000 }), 'leave', 'walking somewhere else: I left the walk');
  assert.equal(memberWalkStep({ tw, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: true, now: 2000 }), null);
  assert.equal(memberWalkStep({ tw: { ...tw, h: 3000 }, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: true, free: false, now: 3100 }), 'halt', 'a halt never waits');
  assert.equal(memberWalkStep({ tw: null, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: false, now: 3100 }), null, 'P8: released');
  assert.equal(walkAskStands({ tw, round: 1000, now: 2000, danger: false }), true);
  assert.equal(walkAskStands({ tw, round: 1000, now: 1000 + PARTY_WALK_ASK_MS + 1, danger: false }), false, 'P10: the asking passed - left behind');
  assert.equal(walkAskStands({ tw: null, round: 1000, now: 2000, danger: false }), false, 'the round over, the party gone');
  assert.equal(walkAskStands({ tw: walkOf(PLACE, 1500), round: 1000, now: 2000, danger: false }), false, 'a new round');
  assert.equal(walkAskStands({ tw: { ...tw, go: 1800, h: null }, round: 1000, now: 2000, danger: false }), true, 'the same round set out again');
  assert.equal(walkAskStands({ tw, round: 1000, now: 2000, danger: true }), false, 'a foe near, a duel');
});


// ── AUDIT OW4 (2026-09-28, the second pass): THE LAW, RUN ───────────────────────────────────────────────────────────

test('AUDIT OW4 P1/P2: THE LEADER\'S BEGIN AND STEP - a spot re-aimed at another point of its pixel while it walks SETS OUT to it (the same round, `go` now, the new point); the same point is the same walk; a halt lapses after PARTY_WALK_HALT_MS - dropped from the pose and never taken up again', () => {
  const walking = walkOf(SPOT, 500);   // sx 40000, sz 9001
  assert.equal(walkBegin(walking, { pixel: SPOT.pixel, point: { x: 40000.2, z: 9000.9 } }, 1000, 0), walking, 'the same point (as the pose rounds it): the same walk');
  assert.deepEqual(walkBegin(walking, { pixel: SPOT.pixel, point: { x: 41000, z: 9001 } }, 1000, 0), { ...walking, go: 1000, sx: 41000 }, 'P1: B, not A - set out, the same round, nobody asked again');
  assert.deepEqual(walkBegin(walking, { pixel: SPOT.pixel, point: { x: 40000, z: 9500 } }, 1000, 0), { ...walking, go: 1000, sz: 9500 }, 'P1: either axis');
  const place = walkOf(PLACE, 500);
  assert.equal(walkBegin(place, PLACE, 1000, 3), place, 'a place has no point to re-aim: the same walk');
  // P2: the lapse
  const halted = { ...walkOf(PLACE, 500), go: 600, h: 800 };
  assert.equal(walkHaltLapsed(halted, 800 + PARTY_WALK_HALT_MS), false);
  assert.equal(walkHaltLapsed(halted, 801 + PARTY_WALK_HALT_MS), true);
  assert.equal(walkHaltLapsed(place, 500 + 10 * PARTY_WALK_HALT_MS), false, 'a walk that walks never lapses');
  assert.equal(walkHaltLapsed(null, 1e9), false);
  assert.deepEqual(walkBegin(halted, PLACE, 800 + PARTY_WALK_HALT_MS, 0), { ...halted, go: 800 + PARTY_WALK_HALT_MS, h: null }, 'within the bound: set out again (OW3 P9)');
  assert.equal(walkBegin(halted, PLACE, 801 + PARTY_WALK_HALT_MS, 0), null, 'P2: lapsed, nobody gathered - no walk, nobody started unasked');
  assert.deepEqual(walkBegin(halted, PLACE, 801 + PARTY_WALK_HALT_MS, 2), walkOf(PLACE, 801 + PARTY_WALK_HALT_MS), 'lapsed, members gathered: a new round, asked');
  assert.equal(walkBegin(place, PLACE, 500 + 10 * PARTY_WALK_HALT_MS, 0), place, 'a long walk is still its walk');
  const hstep = (now, journeying = false) => leaderWalkStep({ tw: halted, journeying, dest: { x: 505, y: 250, spot: false }, ended: false, stops: [], now }).tw;
  assert.equal(hstep(800 + PARTY_WALK_HALT_MS), halted, 'waiting to be taken up');
  assert.equal(hstep(801 + PARTY_WALK_HALT_MS), null, 'P2: lapsed - off the pose');
  assert.equal(hstep(801 + PARTY_WALK_HALT_MS, true), null, '...and a Resume after it is the leader\'s own journey');
  const spotHalted = { ...walkOf(SPOT, 500), h: 700 };
  assert.equal(leaderWalkStep({ tw: spotHalted, journeying: false, dest: null, ended: false, stops: [], now: 701 + PARTY_WALK_HALT_MS }).tw, null, 'a halted spot walk no longer rides the pose for ever');
  assert.equal(PARTY_WALK_HALT_MS, 300_000);
  assert.ok(PARTY_WALK_HALT_MS > BAND_GIVE_UP_MS && PARTY_WALK_HALT_MS > PARTY_WALK_ASK_MS, 'past a band\'s whole chase, past the asking');
});

test('AUDIT OW4 P1/P4/P6: A MEMBER\'S NEXT STEP - still walking an older set-out, re-routed to the new one; a journey that cannot run (WALK_BALKS) is said once and set out again only by the member\'s own taking it up; stopped under the halt and walking its way again is the member\'s own journey - they leave the walk', () => {
  const tw = { ...walkOf(SPOT, 1000), go: 2000 };   // the spot re-aimed at 2000
  const walked = { at: 1000, yes: true, go: 1000 };
  const step = (q) => memberWalkStep({ tw, mine: walked, gathered: true, journeying: true, onWalk: true, was: true, free: true, now: 2100, ...q });
  assert.equal(step({}), 'start', 'P1: walking to A, the walk set out to B - re-routed');
  assert.equal(step({ free: false }), null, '...when free (a window, a foe, an arrival in flight)');
  assert.equal(step({ mine: { ...walked, go: 2000 } }), null, 'walking the set-out that stands');
  assert.equal(step({ onWalk: false }), 'leave', 'somewhere else: left');
  // P4: the balk
  assert.deepEqual(WALK_BALKS, ['health', 'fatigue', 'stuck', 'blocked', 'ocean']);
  for (const why of WALK_BALKS) assert.equal(memberStopOf({ was: true, journeying: false, ended: false, following: true, why }), 'balk', why);
  for (const why of ['enemies', 'location', null, undefined]) assert.equal(memberStopOf({ was: true, journeying: false, ended: false, following: true, why }), 'stop', `${why}: the world's - the leader's Resume sets them out again`);
  assert.equal(memberStopOf({ was: true, journeying: false, ended: true, following: true, why: 'health' }), 'done', 'an end is an end');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: false, following: true, why: 'health' }), null, 'the party\'s own halt is never mine, whatever the panel said');
  const balked = { ...walked, balk: true };
  assert.equal(step({ mine: balked, journeying: false, onWalk: false, was: false }), null, 'P4: balked - the party\'s set-out passes me by');
  assert.equal(step({ mine: walked, journeying: false, onWalk: false, was: false }), 'start', '...a plain stop is set out again');
  assert.equal(step({ mine: balked }), 'start', 'P4: my own Resume on the walk brings me back in');
  // P6: the halt
  const halted = { ...walkOf(PLACE, 1000), h: 3000 };
  const hstep = (q) => memberWalkStep({ tw: halted, mine: walked, gathered: true, journeying: true, onWalk: true, now: 3100, ...q });
  assert.equal(hstep({ was: true }), 'halt', 'walking it when the halt came: stop');
  assert.equal(hstep({ was: true, free: false }), 'halt', 'a halt never waits');
  assert.equal(hstep({ was: false }), 'leave', 'P6: stopped under the halt and walking its way again - my own Resume: I leave the walk');
  assert.equal(hstep({ was: false, journeying: false, onWalk: false }), null, 'stopped: nothing');
  assert.equal(hstep({ was: false, mine: { ...walked, go: null } }), 'leave', 'P6: a yes never set out, on a journey of its own to that place: its own');
});

const RIPWYCH = { pixel: { x: 505, y: 250 }, name: 'Ripwych', mapId: 42 };
const talkHost = (name = 'P') => createTownTalk({ renderer: {}, canvas: { width: 320, height: 200 }, fetchBytes: async () => { throw new Error('no data'); }, playerEntity: { name, stats: {} }, regionIndex: 0 });

test('AUDIT OW4 P3: THE QUESTION\'S DOORS - withdrawn, a Yes/No box is inert (no key, no click, no answer reaches either arm) and a real talk host\'s own drain drops it when it is the top; the talk host says whether its STACK holds a window - the slot\'s, or suspended under a push - and a replacement holds it no more', () => {
  const got = [];
  const box = new YesNoBoxWindow({ rows: ['?'], onYes: () => got.push('yes'), onNo: () => got.push('no') });
  box.withdraw();
  box.input('KeyY'); box.input('Enter'); box.answer(true); box.click(0, 0);
  assert.deepEqual([got, box.done], [[], true]);
  const tt = talkHost();
  const q = new YesNoBoxWindow({ rows: ['?'], onYes: () => got.push('yes') });
  tt.showOverlay(q);
  assert.equal(tt.containsOverlay(q), true, 'the slot\'s');
  const pushed = { done: false, dispose() {} };
  tt.pushOverlay(pushed);
  assert.deepEqual([tt.overlay === pushed, tt.containsOverlay(q)], [true, true], 'suspended under a push: still held');
  q.withdraw();
  tt.closeOverlay(pushed);
  assert.equal(tt.overlay, q, 'surfaced...');
  tt.keydown({ code: 'KeyY', preventDefault() {} });
  assert.deepEqual([tt.overlay, tt.containsOverlay(q), got], [null, false, []], '...and dropped by the drain, answering nothing');
  const r = new YesNoBoxWindow({ rows: ['?'] });
  tt.showOverlay(r);
  tt.showOverlay({ done: false, dispose() {} });
  assert.equal(tt.containsOverlay(r), false, 'replaced (showOverlay disposes the occupant): gone');
});

// ── THE HOST, LIFTED AND RUN (AUDIT OW4 P7) ──────────────────────────────────────────────────────────────────────────

// Travel Options itself, as the world host wires it: its panel's Camp is InterruptTravel, its Exit
// ClearTravelDestination. `go` puts the traveller somewhere and runs the mod's own frame (TravelOptionsMod.Update).
function travelClient() {
  const at = (px, py, dx = 16384, dz = 16384) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + dx, z: o.z + dz }; };
  const state = { pos: at(500, 250), pixel: { x: 500, y: 250 }, enemies: false };
  const entity = { health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 };
  let to = null;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => to?.interruptTravel(), onCancel: () => to?.clearTravelDestination() });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false,
    localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231,
    entity: () => entity,
    enemiesNearby: () => state.enemies, diseaseCount: () => 0,
    say: () => {}, messageBox: () => {},
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null,
    pushWindow: (w) => { w.show(); },
  });
  const c = { to, ui, state, entity };
  c.go = (px, py, dx, dz) => { state.pixel = { x: px, y: py }; state.pos = at(px, py, dx, dz); return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); };
  c.journey = () => to.beginTravelAlongRoute({ legs: [{ x: 505, y: 250, kind: 'road' }], summary: RIPWYCH }, false, { quiet: true });
  c.journeying = () => !!to.isTravelActive && !!to.state.autopilot;
  return c;
}

test('AUDIT OW3 P1/P5: through Travel Options itself - the bare interrupt leaves the panel up (the party read a stopped journey as walking); the mod\'s Camp (pauseTravel) takes it down and keeps the place; every END is counted, a stop never is (a spot\'s stop included)', () => {
  const a = travelClient();
  a.journey();
  a.to.interruptTravel();
  assert.equal(a.to.isTravelActive, true, 'P1: the panel still up - the old halt\'s whole bug');
  assert.equal(a.journeying(), false, '...not moving, and the host now reads that');
  const b = travelClient();
  b.journey();
  b.to.messages.pauseTravel();
  assert.deepEqual([b.to.isTravelActive, b.to.state.autopilot, b.to.destinationName, !!b.to.route, b.to.cleared], [false, null, 'Ripwych', true, 0], 'Camp: down, stopped, the place kept for the resume - not an end');
  b.to.resumeTravel();
  assert.equal(b.journeying(), true, 'the map\'s Resume takes it up');
  b.go(505, 250, 16300, 16300); b.go(505, 250, 16300, 16300);
  assert.deepEqual([b.to.isTravelActive, b.to.cleared], [false, 1], 'P5: the arrival - counted');
  const s = travelClient();
  s.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...s.state.pos }, false, { quiet: true });
  s.to.messages.pauseTravel();
  assert.deepEqual([s.to.route, s.to.destinationName, s.to.cleared], [null, null, 0], 'P5: a spot\'s STOP leaves no destination field at all - and is no end');
  s.journey();
  s.ui.cancelWindow();
  assert.equal(s.to.cleared, 1, 'Exit: an end');
});

// THE HOST'S OWN TV8 HALF, lifted from scenes/world.js's source text and run: its state, its helpers (walkNow,
// walkJourneying, walkDestLive, walkDanger, walkFree), partyWalkBegin, walkBoxDown, walkAnswered, partyWalkFrame, the
// pose's two fields and the travel frame's word on why a journey stopped. AUDIT OW4 P7: the run before drove a hand
// copy, called "word for word", that dropped walkFree, the question box, the grace, `gathered` and walkDestLive's third
// branch - and the host's records died only on the regexes above. What is stubbed is the world AROUND the block: the
// party's picture (every other client's pose as composed), the hub, the two Overworld journeys (the journey begun, then
// partyWalkBegin, as travelViewRouteTo / travelViewWalkTo do) and the land's few questions; Travel Options, the talk
// host's window stack and the Yes/No box are the real ones.
const WORLD = rd('src/scenes/world.js');
const lift = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `lifted from scenes/world.js: ${what}`); return m[1]; };
const HOST_STATE = lift(/\n {2}(let _walkLead = null;[^\n]*\n(?: {2}let _walk[^\n]*\n)+)/, 'the TV8 state');
const HOST_BLOCK = lift(/\n {2}(const walkNow = [\s\S]*?\n {2}function partyWalkFrame\(nowMs\) \{\n[\s\S]*?\n {2}\})\n/, 'the TV8 block');
const POSE_TW = lift(/\n\s*(\.\.\.\(_walkLead && socialLink\(\)\?\.partyWalkOk \? \{ tw: _walkLead \} : \{\}\),)/, 'the pose\'s walk');
const POSE_TS = lift(/\n\s*(\.\.\.\(_walkTs != null && socialLink\(\)\?\.partyWalkOk \? \{ ts: _walkTs \} : \{\}\),)/, 'the pose\'s stop');
const STOP_WHY = lift(/\n\s*(if \(report\?\.stopped\) [^\n;]*;)/, 'the travel frame\'s word on why a journey stopped');
const LAW = lift(/\nimport \{ ([^}]*) \} from '\.\.\/systems\/partyWalk\.js';/, 'the law the host imports').split(',').map((s) => s.trim());
const AROUND = ['social', 'socialLink', 'travelOptions', 'modes', 'playerSpawned', 'playerEntity', 'townTalk', 'gamePaused', 'pointerSurfaces',
  'duelEnemyNear', 'areEnemiesNearby', 'exteriorFoePool', 'worldMoveBusy', 'memberPresent', 'distanceToPartyAccount', 'tvPlaceSummary',
  'mapPixelToWorldCoords', 'tvSceneOf', 'travelViewRouteTo', 'travelViewWalkTo', 'YesNoBoxWindow', 'TRAVEL_VIEW_TEXT', 'locationIndex', 'locationWorldRect', 'tvLocationAt',
  'travelViewAllowed', 'csaAboard', 'tvWater', 'tvSay'];   // AUDIT OW5 P1: the Overworld's own gate and a passenger's refusal; P3: the planner's sea
const liftedHost = new Function('d', `const { ${[...AROUND, ...LAW].join(', ')} } = d;
${HOST_STATE}
${HOST_BLOCK}
return {
  frame: partyWalkFrame, begin: partyWalkBegin,
  pose: () => ({ ${POSE_TW} ${POSE_TS} }),
  travelled: (report) => { ${STOP_WHY} },
  get lead() { return _walkLead; }, get mine() { return _walkMine; }, get ts() { return _walkTs; }, get box() { return _walkBox; },
};`);

/** One client: Travel Options, a real talk host, and the host's lifted TV8 half, in `world` (the party, the hub's clock,
 *  who stands far off, whose pose is missing a moment). `go` runs the travel frame and hands its report to the lifted
 *  stop-reason line. `over` replaces parts of the world around the block (Travel Options off: `travelOptions: null`). */
function walkHost(world, acct, over = {}) {
  const c = travelClient();
  Object.assign(c, { acct, busy: false, cautious: false, tt: talkHost(acct) });
  const begun = (ok, dest) => { if (!ok) return false; c.host.begin(dest); return true; };
  const d = {
    ...PW,
    social: {
      get party() { return world.party; },
      leads: () => world.party?.leader === acct,
      others: () => world.clients.filter((o) => o !== c).map((o) => ({ acct: o.acct, name: o.acct, online: true, p: world.nopose.has(o.acct) ? null : o.host.pose() })),
      now: () => world.now,
    },
    socialLink: () => ({ partyWalkOk: true }),
    travelOptions: c.to,
    modes: { mode: 'exterior', deathUp: () => false, modalWindowUp: () => false },
    playerSpawned: true, playerEntity: c.entity, townTalk: c.tt,
    gamePaused: () => c.tt.overlayActive, pointerSurfaces: new Set(),
    duelEnemyNear: () => false, areEnemiesNearby: () => c.state.enemies, exteriorFoePool: () => [],
    worldMoveBusy: () => c.busy,
    travelViewAllowed: () => ({ ok: c.viewOk ?? true }), csaAboard: { get aboard() { return !!c.aboard; } },   // AUDIT OW5 P1
    tvWater: (x, y) => !!c.sea?.(x, y),   // AUDIT OW5 P3
    tvSay: (t) => { c.said = [...(c.said ?? []), t]; },   // AUDIT OW5 P5
    memberPresent, distanceToPartyAccount: (other) => (world.far.has(acct) || world.far.has(other) ? 500 : 10),
    tvPlaceSummary: (x, y) => (x === RIPWYCH.pixel.x && y === RIPWYCH.pixel.y ? RIPWYCH : null),
    mapPixelToWorldCoords: mapPixelWorldOrigin,
    tvSceneOf: (x, z, up) => [x, up, z],
    travelViewRouteTo: (summary) => begun(c.to.beginTravelAlongRoute({ legs: [{ x: 505, y: 250, kind: 'road' }], summary, name: summary.name }, c.cautious, { quiet: true }), { pixel: summary.pixel }),
    travelViewWalkTo: (point, pix, opts = {}) => { c.walks = [...(c.walks ?? []), { pix, door: opts.door ?? null, ...(opts.water ? { water: true } : {}) }]; return begun(c.to.beginTravelToPoint({ pixel: pix, x: point[0], z: point[2] }, c.cautious, { quiet: true }), { pixel: pix, point: { x: point[0], z: point[2] } }); },
    YesNoBoxWindow, TRAVEL_VIEW_TEXT,
    locationIndex: new Map(), locationWorldRect: (loc) => loc.rect,
    // AUDIT OW5b D3: what stands on a pixel, built or not - the index's, else the spawn its roll would stand (the host's tvLocationAt)
    unbuilt: new Map(), tvLocationAt: (x, y) => d.locationIndex.get(`${x},${y}`) ?? d.unbuilt.get(`${x},${y}`) ?? null,
    ...over,
  };
  c.d = d;
  c.host = liftedHost(d);
  const go = c.go;
  c.go = (...a) => { const r = go(...a); c.host.travelled(r); return r; };
  c.routeTo = () => d.travelViewRouteTo(RIPWYCH);   // the Overworld's click on the place
  c.walkTo = (dx, dz) => { const o = mapPixelWorldOrigin(505, 250); return d.travelViewWalkTo([o.x + dx, 0, o.z + dz], { x: 505, y: 250 }); };   // on a spot of its pixel
  c.key = (code) => c.tt.keydown({ code, preventDefault() {} });
  for (const k of ['lead', 'mine', 'ts', 'box']) Object.defineProperty(c, k, { get: () => c.host[k] });
  return c;
}
/** A party of lifted clients, the first its leader; a last argument `{ [acct]: over }` replaces parts of a client's world. */
function walkParty(...accts) {
  const overs = typeof accts.at(-1) === 'object' ? accts.pop() : {};
  const world = { now: 0, party: { leader: accts[0] }, far: new Set(), nopose: new Set(), clients: [] };
  for (const acct of accts) world.clients.push(walkHost(world, acct, overs[acct]));
  world.tick = (now) => { world.now = now; for (const c of world.clients) c.host.frame(now); };
  return world;
}

test('AUDIT OW3/OW4 P7: THE PARTY WALKS, RUN ON THE HOST\'S OWN CODE - asked on a real talk host and started on a yes; a member\'s own stop halts the leader (through the panel) and every member, never echoed back; the leader\'s resume sets everyone out again, the stopped member too; taken up again from the flag, the same round, near or far; the leader\'s arrival releases the members, who walk on and arrive - never a stop', () => {
  const w = walkParty('L', 'M', 'N');
  const [L, M, N] = w.clients;
  w.now = 1000;
  assert.equal(L.routeTo(), true, 'the Overworld\'s click on the place');
  assert.deepEqual([L.lead.at, L.lead.go, L.lead.h], [1000, 1000, null], 'a walk: M and N gathered');
  w.tick(1100);
  assert.ok(M.box && M.tt.overlay === M.box && N.tt.overlay === N.box, 'asked, each on their own screen');
  assert.deepEqual(M.box.rows, ['L leads the party to Ripwych.', 'Travel with them?']);
  M.key('KeyY'); N.key('KeyY');
  assert.deepEqual([M.tt.overlay, M.box, M.mine.at, M.mine.yes, N.mine.yes], [null, null, 1000, true, true], 'answered: the box down by its own door');
  w.tick(1400);
  assert.deepEqual([M.journeying(), N.journeying()], [true, true], 'the same journey, each in their own world');
  w.tick(1700);
  // M meets a foe: the mod's own stop
  M.state.enemies = true; assert.equal(M.go(500, 250).stopped, 'enemies'); M.state.enemies = false;
  assert.equal(M.journeying(), false);
  w.tick(2000);
  assert.equal(M.ts, 2000, 'M\'s own stop, said');
  w.tick(2250);
  assert.equal(L.lead.h, 2250, 'the leader halts on it at once...');
  assert.deepEqual([L.to.isTravelActive, L.to.destinationName], [false, 'Ripwych'], 'OW3 P1: through the panel, the place kept for the resume');
  assert.equal(N.to.isTravelActive, false, '...and the halt reached N, through the panel');
  w.tick(2500);
  assert.equal(N.ts, null, 'the party\'s halt is never echoed back as N\'s own stop');
  assert.equal(L.lead.h, 2250, 'no ping-pong');
  // the leader takes it up again: the map's Resume
  L.to.resumeTravel();
  w.tick(3000);
  assert.deepEqual([L.lead.go, L.lead.h], [3000, null], 'set out again');
  assert.deepEqual([M.journeying(), N.journeying()], [true, true], 'both set out again - the one a foe stopped (the world\'s stop, AUDIT OW4 P4), and the one the party halted');
  w.tick(3250);
  // OW3 P9: stopped again, taken up again from the Overworld's flag with nobody near - the same round
  L.to.messages.pauseTravel();
  w.tick(3500);
  assert.deepEqual([L.lead.h, M.journeying(), N.journeying()], [3500, false, false], 'halted, every one');
  w.far.add('M'); w.far.add('N');
  w.now = 4000; L.routeTo();
  assert.deepEqual([L.lead.at, L.lead.go, L.lead.h], [1000, 4000, null], 'nobody gathered - still their walk');
  w.tick(4100);
  assert.deepEqual([M.journeying(), N.journeying(), M.mine.at, N.mine.at], [true, true, 1000, 1000], 'set out again, far off as they stand');
  // the leader arrives: the walk is over, and the members are released (OW3 P8)
  L.go(505, 250, 16300, 16300); L.go(505, 250, 16300, 16300);
  w.tick(5000);
  assert.equal(L.lead, null, 'arrived: the walk ends');
  assert.equal(L.host.pose().tw, undefined, 'off the pose');
  assert.deepEqual([M.journeying(), N.journeying()], [true, true], 'released, walking on to the same place');
  assert.deepEqual([M.mine, N.mine], [NO_WALK_ANSWER, NO_WALK_ANSWER], 'OW3 P3: the yes died with the walk');
  M.go(505, 250, 16300, 16300); M.go(505, 250, 16300, 16300);
  w.tick(5500);
  assert.equal(M.ts, 2000, 'my arrival after the walk is no stop');
  // OW3 P5: a member who arrives FIRST, while the walk still stands, is done - never a stop, never started again
  const v = walkParty('L', 'P');
  const [L2, P] = v.clients;
  v.now = 10_000; L2.routeTo(); v.tick(10_100); P.key('KeyY'); v.tick(10_400);
  assert.equal(P.journeying(), true);
  P.go(505, 250, 16300, 16300); P.go(505, 250, 16300, 16300);
  v.tick(10_700);
  assert.deepEqual([P.ts, P.mine.yes, L2.lead.h], [null, false, null], 'arrived first - no stop said, the leader walks on');
  L2.to.messages.pauseTravel(); v.tick(11_000); L2.to.resumeTravel(); v.tick(11_300);
  assert.equal(L2.lead.go, 11_300);
  assert.equal(P.journeying(), false, 'the next set-out does not send an arrived member back out');
});

test('AUDIT OW5 P1 (run on the host\'s own code): a passenger aboard another\'s boat, and a member the Overworld\'s own gate refuses (the classic skin, underwater), are never asked and never set out - the passenger said Yes and was walked off the deck', () => {
  const v = walkParty('L', 'P', 'C');
  const [L, P, C] = v.clients;
  P.aboard = true;   // on the leader's deck (CSA-K)
  C.viewOk = false;   // travelViewAllowed refuses: the classic skin, or under the water
  v.now = 1000; L.routeTo(); v.tick(1100);
  assert.ok(L.lead, 'a walk, both gathered');
  assert.deepEqual([P.box, C.box], [null, null], 'neither asked');
  v.tick(1400);
  assert.deepEqual([P.journeying(), C.journeying()], [false, false], 'nor walked');
});

test('AUDIT OW3 P1/P2/P6/P7, run on the host\'s own code (AUDIT OW4 P7): a journey stopped under a panel left up is a stop; a begin that makes no walk leaves none; nobody is asked with no journeys to walk, underground or dead; the leader\'s pose missing a moment (a reconnect) keeps the walk its grace, then lets it go', () => {
  const w = walkParty('L', 'M');
  const [L, M] = w.clients;
  w.now = 1000; L.routeTo(); w.tick(1100); M.key('KeyY'); w.tick(1400);
  M.to.interruptTravel();   // a window over the journey: the bare interrupt, its panel left up
  assert.deepEqual([M.to.isTravelActive, M.journeying()], [true, false]);
  w.tick(1700);
  assert.equal(M.ts, 1700, 'OW3 P1: stopped under a panel left up - a stop, said');
  w.tick(2000);
  assert.equal(L.lead.h, 2000, '...and the party halts on it');
  assert.deepEqual(L.said, [TRAVEL_VIEW_TEXT.partyHalted], 'AUDIT OW5 P5: and says so - the panel only closed');
  L.to.resumeTravel();
  w.tick(2300);
  assert.deepEqual([L.lead.go, L.lead.h], [2300, null]);
  w.party.leader = 'M';   // the lead passes
  L.routeTo();
  assert.equal(L.lead, null, 'OW3 P2: no longer the leader - the journey begun makes no walk, and leaves none on the pose');
  // OW3 P6: never asked with no journeys to walk (Travel Options off), underground, or dead
  const v = walkParty('L', 'O', 'U', 'D', { O: { travelOptions: null } });
  const [L2, O, U, D] = v.clients;
  U.d.modes.mode = 'dungeon';
  D.entity.health = 0;
  v.now = 1000; L2.routeTo(); v.tick(1100);
  assert.ok(L2.lead, 'a walk, all three gathered');
  assert.deepEqual([O.box, U.box, D.box], [null, null, null], 'none of them asked');
  // OW3 P7: the leader's pose missing a moment (a hub reconnect) - the walk believed its grace, then let go
  const g = walkParty('L', 'M');
  const [L3, M3] = g.clients;
  g.now = 1000; L3.routeTo(); g.tick(1100); M3.key('KeyY'); g.tick(1400);
  g.nopose.add('L');
  g.tick(1400 + PARTY_WALK_GRACE_MS);
  assert.deepEqual([M3.mine.at, M3.mine.yes, M3.journeying()], [1000, true, true], 'within the grace: still the walk');
  g.nopose.delete('L');
  g.tick(1700 + PARTY_WALK_GRACE_MS);
  L3.to.messages.pauseTravel();
  g.tick(2000 + PARTY_WALK_GRACE_MS);
  assert.equal(M3.journeying(), false, '...and the halt still reaches M');
  g.nopose.add('L');
  g.tick(2250 + 2 * PARTY_WALK_GRACE_MS);
  assert.deepEqual(M3.mine, NO_WALK_ANSWER, 'gone past the grace: no walk, the yes with it');
});

test('AUDIT OW4 P1/P5 (run on the host\'s own code): a spot walk re-aimed at another point of its pixel sets out to it - a member still walking to A is re-routed to B, a late starter sent to B, nobody released at A; a set-out waits out an arrival in flight', () => {
  const w = walkParty('L', 'M', 'N');
  const [L, M, N] = w.clients;
  const o = mapPixelWorldOrigin(505, 250);
  w.now = 1000;
  assert.equal(L.walkTo(16000, 9000), true, 'A');
  w.tick(1100);
  // PIN MOVED (AUDIT OW5 P5): "the marked spot" inside the sentence
  assert.deepEqual(M.box.rows, [`L leads the party to ${TRAVEL_VIEW_TEXT.theSpot}.`, 'Travel with them?']);
  assert.equal(TRAVEL_VIEW_TEXT.theSpot, 'the marked spot');
  M.key('KeyY'); N.key('KeyY');
  N.busy = true;   // P5: N is landing from a fast travel - the feet read mid-arrival lie
  w.tick(1400);
  assert.deepEqual([M.journeying(), M.to.route.point.x, M.to.route.point.z], [true, o.x + 16000, o.z + 9000], 'M to A');
  assert.equal(N.journeying(), false, 'P5: an arrival in flight - never set out from where its feet read');
  w.tick(1700);
  assert.equal(N.journeying(), false, '...while it lasts');
  w.now = 2000;
  assert.equal(L.walkTo(20000, 12000), true, 'B, in the same pixel');
  assert.deepEqual([L.lead.at, L.lead.go, L.lead.h, L.lead.sx, L.lead.sz], [1000, 2000, null, o.x + 20000, o.z + 12000], 'P1: the same round, set out to B');
  N.busy = false;
  w.tick(2100);
  assert.deepEqual([M.journeying(), M.to.route.point.x, M.to.route.point.z, M.mine.go], [true, o.x + 20000, o.z + 12000, 2000], 'P1: M, walking to A, re-routed to B');
  assert.deepEqual([N.journeying(), N.to.route.point.x, N.to.route.point.z], [true, o.x + 20000, o.z + 12000], 'landed: the late starter goes to B');
  const route = M.to.route;
  w.tick(2400);
  assert.equal(M.to.route, route, 'walking the set-out that stands: not routed again every step');
});

test('AUDIT OW4 P2 (run on the host\'s own code): a halt waits PARTY_WALK_HALT_MS - past it the walk is off the leader\'s pose and every member released; the leader\'s next click there with nobody gathered starts nobody (and a member far off is never asked)', () => {
  const w = walkParty('L', 'M', 'N');
  const [L, M, N] = w.clients;
  w.far.add('N');
  w.now = 1000; L.routeTo(); w.tick(1100);
  assert.deepEqual([!!M.box, N.box, N.tt.overlay], [true, null, null], 'M gathered and asked; N, far off, never');
  M.key('KeyY'); w.tick(1400);
  assert.equal(M.journeying(), true);
  L.to.messages.pauseTravel();
  w.tick(1700);
  assert.deepEqual([L.lead.h, M.journeying()], [1700, false]);
  w.tick(1700 + PARTY_WALK_HALT_MS);
  assert.equal(L.lead?.h, 1700, 'within the bound: still the walk, waiting');
  w.tick(1950 + PARTY_WALK_HALT_MS);
  assert.equal(L.lead, null, 'lapsed: dropped');
  assert.equal(L.host.pose().tw, undefined, 'off the pose');
  assert.deepEqual(M.mine, NO_WALK_ANSWER, 'M released - the yes died with the walk');
  w.far.add('M');
  w.now = 3_600_000; L.to.resumeTravel(); L.routeTo();   // an hour on foot, and the leader takes the place up again
  assert.equal(L.lead, null, 'nobody gathered: no walk');
  w.tick(3_600_000);
  assert.equal(M.journeying(), false, 'M never started unasked');
});

test('AUDIT OW4 P3 (run on the host\'s own code and a real talk host\'s stack): the question with a window PUSHED over it is still the question - answered when it surfaces within its round; past its round it is taken down through the stack (withdrawn where it lies, dropped as it surfaces), never answerable; a yes pressed after its asking starts nothing; a window that REPLACED it loses it, and the member is asked again when free; a non-pausing window in the slot is a window', () => {
  const w = walkParty('L', 'M');
  const [L, M] = w.clients;
  w.now = 1000; L.routeTo(); w.tick(1100);
  const box = M.box;
  assert.equal(M.tt.overlay, box);
  const trade = { done: false, dispose() {} };   // the trade window, a quest popup, the exhaustion box: pushOverlay
  M.tt.pushOverlay(trade);
  w.tick(1400);
  assert.deepEqual([M.box, M.tt.overlay], [box, trade], 'still the question: the stack holds it');
  M.tt.closeOverlay(trade);
  assert.equal(M.tt.overlay, box, 'surfaced');
  M.key('KeyY');
  assert.deepEqual([M.mine.at, M.mine.yes, M.tt.overlay], [1000, true, null], 'answered within its round: it counts');
  w.tick(1700);
  assert.equal(M.journeying(), true);
  // the round passes under the push
  const v = walkParty('L', 'K');
  const [L2, K] = v.clients;
  v.now = 1000; L2.routeTo(); v.tick(1100);
  const kbox = K.box;
  const popup = { done: false, dispose() {} };
  K.tt.pushOverlay(popup);
  v.tick(1100 + PARTY_WALK_ASK_MS);
  assert.equal(K.box, null, 'past its asking: taken down');
  assert.deepEqual([kbox.done, K.tt.overlay], [true, popup], '...withdrawn where it lies, the popup untouched');
  K.tt.closeOverlay(popup);
  K.key('KeyY');   // the key that lands on it as it surfaces
  assert.equal(K.tt.overlay, null, 'dropped by the stack\'s own drain - never answerable');
  assert.deepEqual(K.mine, NO_WALK_ANSWER, 'it answered nothing');
  v.tick(1400 + PARTY_WALK_ASK_MS);
  assert.deepEqual([K.box, K.journeying()], [null, false], 'left behind, as its round said');
  // a yes pressed after its asking, before the step that would take it down, starts nothing
  const u = walkParty('L', 'J');
  const [L3, J] = u.clients;
  u.now = 1000; L3.routeTo(); u.tick(1100);
  u.now = 1001 + PARTY_WALK_ASK_MS;
  J.key('KeyY');
  assert.deepEqual([J.tt.overlay, J.mine], [null, NO_WALK_ANSWER], 'a stale yes does nothing');
  u.tick(1300 + PARTY_WALK_ASK_MS);
  assert.equal(J.journeying(), false, 'never started');
  // ...nor one pressed with a foe come near, before the step takes the question down
  const x = walkParty('L', 'X');
  const [L6, X] = x.clients;
  x.now = 1000; L6.routeTo(); x.tick(1100);
  X.state.enemies = true;
  X.key('KeyY');
  assert.deepEqual(X.mine, NO_WALK_ANSWER, 'danger: a yes does nothing');
  // a window that REPLACES it (showOverlay disposes the occupant): lost - asked again when the slot is free
  const r = walkParty('L', 'Q');
  const [L4, Q] = r.clients;
  r.now = 1000; L4.routeTo(); r.tick(1100);
  const first = Q.box;
  const talk = { done: false, dispose() {} };
  Q.tt.showOverlay(talk);
  r.tick(1400);
  assert.equal(Q.box, null, 'replaced: forgotten');
  Q.tt.closeOverlay(talk);
  r.tick(1700);
  assert.ok(Q.box && Q.box !== first && Q.tt.overlay === Q.box, 'asked again, free');
  // a window that does not pause (the status readout) is still a window: nobody is asked over it
  const s = walkParty('L', 'S');
  const [L5, S] = s.clients;
  const readout = { done: false, pauseWhileOpen: false, dispose() {} };
  S.tt.showOverlay(readout);
  s.now = 1000; L5.routeTo(); s.tick(1100);
  assert.deepEqual([S.box, S.tt.overlay], [null, readout], 'OW3 P4: never over a window, pausing or not');
});

test('AUDIT OW4 P4 (run on the host\'s own code): a member whose journey CANNOT RUN as they are (cautious travel on low health) halts the party once - the leader\'s Resume does not set them out to stop at once and halt it again; their own Resume brings them back in, and after that a plain stop of theirs is set out again as ever', () => {
  const w = walkParty('L', 'M');
  const [L, M] = w.clients;
  M.cautious = true;
  w.now = 1000; L.routeTo(); w.tick(1100); M.key('KeyY'); w.tick(1400);
  assert.equal(M.journeying(), true);
  M.entity.health = 1;   // wounded: cautious travel will not walk on (TravelOptionsMod.cs:1377-1389)
  assert.equal(M.go(500, 250).stopped, 'health');
  w.tick(1700);
  assert.deepEqual([M.ts, M.mine.balk], [1700, true], 'said, as a stop - and marked');
  w.tick(2000);
  assert.equal(L.lead.h, 2000, 'the party halts on it - once');
  L.to.resumeTravel();
  w.tick(2300);
  assert.deepEqual([L.lead.go, L.lead.h, M.journeying()], [2300, null, false], 'set out again - without M, whose journey would stop at once');
  w.tick(2600); w.tick(2900);
  assert.deepEqual([L.lead.h, M.ts], [null, 1700], 'no halt bought by the Resume');
  // M heals and takes it up: their own Resume brings them back in
  M.entity.health = 50;
  M.to.resumeTravel();
  w.tick(3200);
  assert.deepEqual([M.journeying(), M.mine.go, M.mine.balk], [true, 2300, false], 'back on the walk, the balk taken up');
  // later a plain stop of M's own (a window: the Camp) - the leader's Resume sets them out again, as ever
  M.to.messages.pauseTravel();
  w.tick(3500);
  assert.deepEqual([M.ts, M.mine.balk], [3500, false], 'a stop, not a balk: the last one\'s reason was read once');
  w.tick(3800);
  assert.equal(L.lead.h, 3800);
  L.to.resumeTravel();
  w.tick(4100);
  assert.equal(M.journeying(), true, 'set out again with the party');
});

test('AUDIT OW4 P6 (run on the host\'s own code): a member\'s own journey taken up under the halt - the map\'s Resume, or the mod\'s own journey to the same place - leaves the walk and walks on; before, it was stopped within a step, silently, for as long as the leader stood', () => {
  const w = walkParty('L', 'M', 'N');
  const [L, M, N] = w.clients;
  w.now = 1000; L.routeTo(); w.tick(1100); M.key('KeyY'); N.key('KeyY'); w.tick(1400);
  L.to.messages.pauseTravel();   // the leader stops (dies, fast-travels, idles)
  w.tick(1700);
  assert.deepEqual([L.lead.h, M.journeying(), N.journeying()], [1700, false, false], 'halted with the party');
  M.to.resumeTravel();   // M's own Resume, from the map
  N.to.beginTravel(RIPWYCH);   // N's own journey by the mod's own map (walkDestLive's third branch: the mod's named journey)
  assert.deepEqual([N.to.route, N.to.destinationName], [null, 'Ripwych']);
  w.tick(2000); w.tick(2300);
  assert.deepEqual([M.journeying(), N.journeying()], [true, true], 'walking on');
  assert.deepEqual([M.mine.yes, N.mine.yes], [false, false], 'left the walk');
  L.to.beginTravel(RIPWYCH);   // the leader takes it up by the mod's own map - walkDestLive's third branch, the walk's own place
  w.tick(2600);
  assert.deepEqual([L.lead?.at, L.lead?.go, L.lead?.h], [1000, 2600, null], 'set out again');
  M.to.messages.pauseTravel();   // their stops are their own now
  w.tick(2900); w.tick(3200);
  assert.deepEqual([M.ts, L.lead.h], [null, null], 'a stop of a member who left halts nobody');
});

test('AUDIT OW5 P3 (run on the host\'s own code): a walk to a spot on the SEA is walked by the member as the sea - asked as land, a member at a helm had no way and one ashore was routed into the water', () => {
  const w = walkParty('L', 'M');
  const [L, M] = w.clients;
  M.sea = () => true;   // the spot's pixel is the planner's sea
  w.now = 1000; L.walkTo(16000, 9000); w.tick(1100);
  M.key('KeyY'); w.tick(1400);
  assert.equal(M.walks.at(-1).water, true, 'as the sea');
  const land = walkParty('L', 'M');
  land.now = 1000; land.clients[0].walkTo(16000, 9000); land.tick(1100);
  land.clients[1].key('KeyY'); land.tick(1400);
  assert.equal(land.clients[1].walks.at(-1).water, undefined, 'a spot on land: as land');
});

test('AUDIT OW4 X1 (run on the host\'s own code): a place the member has not found, or a spawn, is walked as its DOOR - never refused for the peaks; a bare spot stays a spot', () => {
  const rect = { minX: 1, maxX: 2, minZ: 3, maxZ: 4 };
  const w = walkParty('L', 'M', { M: { tvPlaceSummary: () => null } });
  const [L, M] = w.clients;
  M.d.locationIndex.set(`${RIPWYCH.pixel.x},${RIPWYCH.pixel.y}`, { rect });
  w.now = 1000; L.routeTo(); w.tick(1100);
  M.key('KeyY'); w.tick(1400);
  assert.equal(M.journeying(), true, 'M walks it');
  assert.deepEqual(M.walks.at(-1), { pix: { x: RIPWYCH.pixel.x, y: RIPWYCH.pixel.y }, door: rect }, 'as the place\'s door');
  const bare = walkParty('L', 'M', { M: { tvPlaceSummary: () => null } });
  bare.now = 1000; bare.clients[0].routeTo(); bare.tick(1100);
  bare.clients[1].key('KeyY'); bare.tick(1400);
  assert.equal(bare.clients[1].walks.at(-1).door, null, 'no place in the pixel: a spot');
});

test('AUDIT OW5b D3 (run on the host\'s own code): THE LEADER\'S SPAWN IS A DOOR TO A MEMBER WHOSE OWN PIXELS NEVER BUILT IT - asked what stands there, not what the index holds', () => {
  const rect = { minX: 5, maxX: 6, minZ: 7, maxZ: 8 };
  const w = walkParty('L', 'M', { M: { tvPlaceSummary: () => null } });
  const [L, M] = w.clients;
  M.d.unbuilt.set(`${RIPWYCH.pixel.x},${RIPWYCH.pixel.y}`, { rect });   // a spawn M's index never held (its pixel never built for M)
  w.now = 1000; L.routeTo(); w.tick(1100);
  M.key('KeyY'); w.tick(1400);
  assert.equal(M.journeying(), true, 'M walks it');
  assert.deepEqual(M.walks.at(-1).door, rect, 'as its door - never refused for the peaks, never a bare spot');
  const w8 = rd('src/scenes/world.js');
  assert.match(w8, /const there = summary \? null : tvLocationAt\(tw\.x, tw\.y\);/, 'the host asks what stands there');
  assert.match(w8, /const tvLocationAt = \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\) \?\? \(params\.has\('online'\) && spawnsDungeon\(_spawnSalt, x, y\) \? tvSpawnAt\(x, y\) : null\);/, 'the index, else the spawn its roll would stand (online; side-effect free)');
});
