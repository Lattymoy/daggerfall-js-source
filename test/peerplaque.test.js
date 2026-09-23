// PEER-PLAQUE1 (2026-09-22, Mac: "Using the world tooltip implementation
// for other players and interaction prompt"): ANOTHER PLAYER UNDER THE
// CROSSHAIR IS NAMED BY THE WORLD PLAQUE, with the acts the interact
// key would open under the name. The pick is SOC5's own (pickPeerInFront
// over peersNear, SOCIAL_REACH, rayPersonDistance), dressed for the
// race (peerRayPick); the words are the F-menu's own bag (actionsFor +
// tradeActionsFor) through peerPromptText; the racer stands between
// the townsperson and the foe in raceWinner's one precedence; and all
// three hosts (street, building, dungeon) race it and name it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { raceWinner } from '../src/player/activationRace.js';
import { resolveHover } from '../src/systems/worldHover.js';
import { SOCIAL_REACH, PEER_KEY_PREFIX, peerIdOfKey, peerRayPick, peerPromptText, PEER_ACT_LABELS } from '../src/player/socialPick.js';
import { socialMenuRows } from '../src/ui/socialMenu.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const at = (key, distance) => ({ key, distance, reach: 10 });

test('PEER-PLAQUE1 race: a peer is one more racer - nearest wins, the townsperson beats a peer on a tie, a peer beats a foe on a tie, and a race with no peer is the race it always was', () => {
  const door = at('__ground__', 5), person = at('mobileNpc:0', 5), peer = at('peer:abc', 5), foe = at('mobileFoe:0', 5);
  assert.equal(raceWinner({ ground: door, person, peer, foe }), door, 'the list beats all three on a tie');
  assert.equal(raceWinner({ person, peer, foe }), person, 'a townsperson beats a peer on a tie');
  assert.equal(raceWinner({ peer, foe }), peer, 'a peer beats a foe on a tie');
  assert.equal(raceWinner({ ground: at('__ground__', 6), person: at('mobileNpc:0', 6), peer, foe: at('mobileFoe:0', 6) }), peer, '...and the nearest still wins');
  assert.equal(raceWinner({ ground: door, peer: at('peer:abc', 4) }).key, 'peer:abc', 'a peer nearer than the door wins');
  assert.equal(raceWinner({ ground: door, peer: null, foe }), door, 'no peer: nothing changes');
});

test('PEER-PLAQUE1 pick: peerRayPick dresses the F key\'s own hit for the race - the peer: key, the along-ray distance, SOCIAL_REACH as the reach; null in, null out; a distance that is not a number is no pick', () => {
  assert.equal(peerRayPick(null), null);
  assert.equal(peerRayPick({ peer: null, distance: 2 }), null);
  assert.equal(peerRayPick({ peer: { id: 'abc' }, distance: Infinity }), null, 'behind or missed: rayPersonDistance answers Infinity');
  assert.deepEqual(peerRayPick({ peer: { id: 'abcd-1234' }, distance: 3.5 }), { key: 'peer:abcd-1234', distance: 3.5, reach: SOCIAL_REACH });
  assert.deepEqual(peerRayPick({ peer: { id: 'x' }, distance: 1 }, 2), { key: 'peer:x', distance: 1, reach: 2 }, 'the reach is the caller\'s');
  assert.equal(PEER_KEY_PREFIX, 'peer:');
  assert.equal(peerIdOfKey('peer:abcd-1234'), 'abcd-1234');
  assert.equal(peerIdOfKey('peer:'), null, 'an empty id is no peer');
  assert.equal(peerIdOfKey('mobileNpc:3'), null);
  assert.equal(peerIdOfKey(17), null, 'AUDIT-WH2 L2-F5: a namer is handed every key the ray can win, the exterior door\'s bare number included');
  assert.equal(peerIdOfKey(null), null);
});

test('PEER-PLAQUE1 words: the prompt lists the ENABLED acts alone behind the interact key, in the menu\'s own order and with the menu\'s own labels; the trade row\'s live label; no key, no bracket; nothing to offer says the relation; a stranger with nothing says nothing', () => {
  const all = { canFriend: true, canInvite: true, canTrade: true, relation: null, whyNotInvite: null };
  assert.equal(peerPromptText(all, 'F'), '[F] Add friend · Invite to party · Trade');
  assert.equal(peerPromptText(all, ''), 'Add friend · Invite to party · Trade', 'unbound: the acts alone');
  assert.equal(peerPromptText(all), 'Add friend · Invite to party · Trade');
  assert.equal(peerPromptText({ ...all, canFriend: false }, 'F'), '[F] Invite to party · Trade', 'a disabled act is not listed');
  assert.equal(peerPromptText({ ...all, canFriend: false, canInvite: false, tradeLabel: 'Accept trade' }, 'F'), '[F] Accept trade', 'the trade row\'s own live label');
  assert.equal(peerPromptText({ canFriend: false, canInvite: false, canTrade: false, relation: 'friend', whyNotInvite: 'in your party' }, 'F'), 'In your party', 'the seat beats the friendship');
  assert.equal(peerPromptText({ canFriend: false, canInvite: false, relation: 'friend', whyNotInvite: 'the party is full' }, 'F'), 'Friend');
  assert.equal(peerPromptText({ canFriend: false, canInvite: false, relation: 'none', whyNotInvite: 'the party is full' }, 'F'), null, 'nothing to say: the name alone');
  assert.equal(peerPromptText(null, 'F'), null);
  assert.equal(peerPromptText({}, 'F'), null, 'offline (tradeActionsFor answers {}): nothing offered, nothing said');
  // ONE HOME for the labels: the menu's rows, in the menu's order
  const rows = socialMenuRows({ peerId: 'p', canFriend: true, canInvite: true, canTrade: true }).filter((r) => r.key !== 'cancel');
  assert.deepEqual(rows.map((r) => r.label), [PEER_ACT_LABELS.friend, PEER_ACT_LABELS.invite, PEER_ACT_LABELS.trade]);
  assert.equal(peerPromptText(all, 'F').slice(4), rows.map((r) => r.label).join(' · '));
});

test('PEER-PLAQUE1 frame: resolveHover over a peer pick is a name frame with the prompt as its sub line, gated by the pick\'s own reach, and a key the host has no word for (the peer left) draws nothing', () => {
  const name = (key) => (peerIdOfKey(key) === 'abc' ? { title: 'Mac ✦', subs: ['[F] Add friend · Trade'] } : null);
  const f = resolveHover(peerRayPick({ peer: { id: 'abc' }, distance: 3 }), { name });
  assert.equal(f.kind, 'name'); assert.equal(f.key, 'peer:abc'); assert.equal(f.title, 'Mac ✦');
  assert.deepEqual(f.subs, ['[F] Add friend · Trade']);
  assert.equal(resolveHover(peerRayPick({ peer: { id: 'abc' }, distance: SOCIAL_REACH + 0.01 }), { name }), null, 'past the reach the F key refuses at: nothing');
  assert.equal(resolveHover(peerRayPick({ peer: { id: 'gone' }, distance: 3 }), { name }), null, 'a peer the session no longer names: nothing');
});

test('PEER-PLAQUE1 hosts by source: the street races the F key\'s own pick and names it in the PORT\'s own (ungated) namers, with the badge marks and the live binding; the building and the dungeon race and name it through the outer host\'s two doors', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ pickPeerInFront, SOCIAL_REACH, peerRayPick, peerIdOfKey, peerPromptText \} from '\.\.\/player\/socialPick\.js';/);
  assert.match(w, /import \{ glyphMarks \} from '\.\.\/ui\/playerBadge\.js';/, 'the badge\'s plain-text marks, for a text plaque');
  assert.match(w, /const _hoverPeerPick = \(eye, dir\) => peerRayPick\(pickPeerInFront\(eye, dir, peersNear\(\), SOCIAL_REACH, rayPersonDistance\), SOCIAL_REACH\);/,
    'SOC5\'s one pick, the same reach and the same cylinder, dressed for the race');
  assert.match(w, /person: _hoverPersonPick\(cam\.pos, _hd\),\s*\n\s*peer: _hoverPeerPick\(cam\.pos, _hd\),/, 'raced beside the townsperson in the street\'s pick');
  const namers = w.slice(w.indexOf('const _hoverNamers = ['), w.indexOf('const _hoverModNamers = ['));
  assert.match(namers, /\(key\) => peerHoverName\(key\),\s*\n\s*\];/, 'named in the port\'s own array, which speaks whether World Tooltips is on or off');
  assert.match(w, /const interactKeyLabel = \(\) => String\(getBinding\(bindings\(\), 'SocialInteract'\) \?\? ''\)\.replace\(\/\^Key\/, ''\);/, 'AUDIT SOC D10/C19: the key is READ, never assumed');
  const namer = w.slice(w.indexOf('const peerHoverName = (key) => {'), w.indexOf('const socialInteract = () => {'));
  assert.match(namer, /const id = peerIdOfKey\(key\);\s*if \(!id\) return null;/);
  assert.match(namer, /const name = peerName\(id\);\s*if \(!name\) return null;/, 'a peer the session no longer names draws nothing');
  assert.match(namer, /const marks = badge \? glyphMarks\(badge\) : '';/);
  assert.match(namer, /peerPromptText\(\{ \.\.\.social\.actionsFor\(id\), \.\.\.tradeActionsFor\(id\) \}, interactKeyLabel\(\)\)/, 'the F-menu\'s own bag, both halves');
  assert.match(namer, /return \{ title: marks \? `\$\{name\} \$\{marks\}` : name, subs: \[cast, prompt\]\.filter\(Boolean\) \};/);   // ALLY-CAST: the cast line above the prompt
  assert.match(w, /peerHoverPick: \(\) => _hoverPeerPick\(cam\.pos, socialFwd\(\)\),\s*\n\s*peerHoverName: \(key\) => peerHoverName\(key\),/, 'the two doors the modal hosts reach - the pick off the F key\'s OWN ray (AUDIT DROPS E3), never the mode\'s eye');
  assert.match(w, /const hit = pickPeerInFront\(cam\.pos, socialFwd\(\), near, SOCIAL_REACH, rayPersonDistance\);/, 'the same ray the key casts');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /foe: pickActivatableHit\(mwv\.eye, d, liveFoeTargets\(interiorFoePool\(\), 'mobileFoe'\), interiorCtx\.collider\),\s*\n\s*peer: host\.peerHoverPick\?\.\(\) \?\? null,/, 'the building races it off the key\'s own ray');
  const interiorNamer = m.slice(m.indexOf('const interiorHoverName = composeNamer(['), m.indexOf('if (!worldTooltipsOn()) return null;', m.indexOf('const interiorHoverName = composeNamer([')));
  assert.match(interiorNamer, /\(key\) => host\.peerHoverName\?\.\(key\) \?\? null,/, 'the building names it above the mod\'s switch');
  assert.match(m, /shareQuest: \(uid, questName, displayName\) => host\.shareQuest\?\.\(uid, questName, displayName\),\s*\n(?:\s*\/\/[^\n]*\n)*\s*peerHoverPick: \(\) => host\.peerHoverPick\?\.\(\) \?\? null,/, 'the dungeon is handed the pick with the quest doors');
  assert.match(m, /ctx\.addActivationNamer\(\(key\) => host\.peerHoverName\?\.\(key\) \?\? null\);/, 'the dungeon names it through the extension door the exit uses');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /foe: pickActivatableHit\(eye, d, liveFoeTargets\(foes, 'mobileFoe'\), collider\),\s*\n\s*peer: opts\.peerHoverPick\?\.\(\) \?\? null,/, 'the dungeon races it off the key\'s own ray');
  const race = rd('src/player/activationRace.js');
  assert.match(race, /person = null, peer = null, foe = null,/);
  // AUDIT DROPS (lens 3): "the press has no arm for it" - raceActivation, the PRESS's own race, passes no peer
  const press = race.slice(race.indexOf('export function raceActivation('), race.indexOf('export function raceWinner('));
  assert.ok(press.length > 0 && !/\bpeer\b/.test(press), 'the press races no peer: the F key is its own gesture');
  // AUDIT DROPS E1: indoors and underground the plaque comes down under a pointer surface (the F-menu over the very peer it names)
  assert.match(w, /pointerSurfaceUp: \(\) => pointerSurfaces\.size > 0,/);
  assert.match(m, /cursorActive: overlayHeld \|\| !!host\.pointerSurfaceUp\?\.\(\),/);
  assert.match(m, /pointerSurfaceUp: \(\) => !!host\.pointerSurfaceUp\?\.\(\),/);
  assert.match(d, /cursorActive: dungeonPaused\(\) \|\| !!opts\.pointerSurfaceUp\?\.\(\),/);
  assert.match(race, /for \(const p of \[camp, water, wagon, torch, corpse, pile, ground, person, peer, foe\]\) \{/, 'between the townsperson and the foe');
});
