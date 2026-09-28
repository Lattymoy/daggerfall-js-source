// AUDIT (2026-09-27, "Lets do a comprehensive audit on these changes" - the Discord batch of 2026-09-27: GUILD-SHELF,
// SHORT-TOUCH, PAD-DOOR, TOUCH-BUTTONS, SPELL-GIFT, PARTY-BUFFS, COMPASS-PARTY, REST-OPT, SHARE-MEND, TRADE-INFO/FIT,
// CHAT-POST, HOME-STATIONS). Six lenses read the batch, each finding was checked against the code, and each real one is
// fixed and pinned. Most pins sit beside their slice's own (homestations, tradeinfo, sharemend, spellgift, partybuffs,
// menupad, touchbuttons, guildshelf, decor1, auditsoc, own1); these are the ones whose seam is a pure law, or a host's
// closure read by its source (world.js - the scene cannot be stood up here), recorded in
// bible/01-Overview/Field-Bugs-2026-09-27e.md ## AUDIT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spellAbsorptionChance } from '../src/systems/absorption.js';
import { cureAllOfKind } from '../src/systems/effects.js';
import { REST_OPT_RELAY_MIN, relaySupportsRestOpt, TRADE_REV_MAX } from '../src/net/wire.js';
import { restsApart, REST_APART_TEXT, restsAlone, restAloneText } from '../src/systems/partyRestLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = src('src/scenes/world.js');

// ─── SPELL-GIFT / PARTY-BUFFS (agent B) ────────────────────────────────────────────────────────────────────────────

test('AUDIT SPELL-GIFT B4: the live Spell Absorption is the BEST of its entries - a gift never merges with my own (ALLY-CAST C2), and a stranger\'s 0% one, first in the list, made my own 100% read 0 for as long as it ran (mutants: the first entry\'s)', () => {
  const entry = (chanceBase, over = {}) => ({ kind: 'spellAbsorption', chanceBase, chanceMod: 0, chancePerLevel: 1, ...over });
  assert.equal(spellAbsorptionChance({ level: 10, activeEffects: [entry(0), entry(100)] }), 100, 'the gift ahead of my own');
  assert.equal(spellAbsorptionChance({ level: 10, activeEffects: [entry(60), entry(20)] }), 60);
  assert.equal(spellAbsorptionChance({ level: 10, activeEffects: [entry(90, { ended: true }), entry(20)] }), 20, 'an ended one is none');
  assert.equal(spellAbsorptionChance({ level: 10, activeEffects: [{ kind: 'spellAbsorption', chance: 35 }, entry(10)] }), 35, 'a pre-X2 entry\'s frozen chance still counts');
  assert.equal(spellAbsorptionChance({ level: 10, activeEffects: [] }), 0);
});

test('AUDIT SPELL-GIFT B6: a cure may leave an incubating infection be - the stranger\'s - and the host says whose it is (mutants: every disease cured; the flag never passed)', () => {
  const t = { activeEffects: [{ kind: 'disease', infection: 'Vampirism-Infection' }, { kind: 'disease', disease: 3 }, { kind: 'poison' }] };
  cureAllOfKind(t, 'disease', true);
  assert.deepEqual(t.activeEffects.map((a) => a.infection ?? a.kind), ['Vampirism-Infection', 'poison']);
  cureAllOfKind(t, 'disease');
  assert.deepEqual(t.activeEffects.map((a) => a.kind), ['poison']);
  assert.match(src('src/systems/effects.js'), /cureAllOfKind\(target, CURE_KINDS\[e\.subType\], ctx\?\.strangerCast === true\);/);
  assert.match(W, /magic\.applySpellToPlayer\(spell, d\.level, null, \{ allyCast: true, strangerCast: !mate \}\);/);
});

test('AUDIT SPELL-GIFT B1 + B3 + B5: a gift never lands on the opponent of the duel I fight (a duel\'s beneficial spell stays home), nor on a CONCEALED stranger (INVIS-NET: named aloud and given to), a concealed mate still a mate; the marks say who is a mate, mates first - a blast\'s burst went to the room\'s first strangers (mutants: each dropped)', () => {
  assert.match(W, /const giftablePeers = \(list\) => \(list \?\? \[\]\)\.filter\(\(p\) => !\(duelMgr\.fighting && p\.id === duelMgr\.opponent\)\s*\n\s*&& !\(p\.cv && !\(social\?\.party && social\.isPartyPeer\(p\.id\)\)\)\);/);
  assert.match(W, /const hit = pickPeerInFront\(eye \?\? cam\.pos, dir \?\? socialFwd\(\), giftablePeers\(peersNear\(\)\), reach, rayPersonDistance\);/, 'the crosshair\'s pick');
  assert.match(W, /const marks = giftablePeers\(near\)\.filter\(\(p\) => online\.reachesPeer\?\.\(p\.id\) && \(mateOf\(p\.id\) \|\| strangers\)\)\s*\n\s*\.map\(\(p\) => \(\{ \.\.\.p, mate: mateOf\(p\.id\), name: [^\n]*\n\s*return \[\.\.\.marks\.filter\(\(m\) => m\.mate\), \.\.\.marks\.filter\(\(m\) => !m\.mate\)\];/, 'the marks, mates first');
  assert.match(src('src/scenes/hostMagic.js'), /out\.push\(\{ ally: true, mate: q\.mate !== false, id: q\.id,/, 'the engine keeps the word');
  assert.match(src('src/scenes/hostMagic.js'), /for \(const m of allyMarksFor\(sp\)\) \{\s*\n\s*if \(!m\.mate\) continue;/, 'and the arm counts mates (B2, driven in spellgift.test.js)');
});

test('AUDIT SPELL-GIFT B1 + B7: the receiver refuses my duel opponent\'s gift while we fight, and a stranger\'s from anyone not standing where I can see them; a stranger\'s lines are said once in a while (a crafted frame from the cell\'s far end spammed my screen) (mutants: each dropped)', () => {
  const on = W.slice(W.indexOf('    online.onCast = (id, d) => {'), W.indexOf('    online.onCast = (id, d) => {') + 2200);
  assert.match(on, /if \(duelMgr\.fighting && id === duelMgr\.opponent\) return;/);
  assert.match(on, /if \(!mate && !\(peersNear\(\) \?\? \[\]\)\.some\(\(p\) => p\.id === id\)\) return;/);
  assert.match(on, /const loud = mate \|\| !\(t - \(_strangerCastSaid\.get\(id\) \?\? -Infinity\) < STRANGER_CAST_SAY_MS\);\s*\n\s*if \(loud && !mate\) _strangerCastSaid\.set\(id, t\);/);
  assert.match(on, /if \(loud\) townTalk\.say\(allyCastTargetLine\(who, spell\.name\)\);/);
  assert.match(W, /const STRANGER_CAST_SAY_MS = 3000;/);
});

// ─── REST-OPT / COMPASS-PARTY (agent C) ────────────────────────────────────────────────────────────────────────────

test('AUDIT REST-OPT C1: the switch is honoured only through a hub that carries `nr` (world120) - through an older one the party counted the member a voter to gather while the member\'s own client refused every rest; the link reads it off the hub\'s welcome, and the pose, the vote\'s words and the party\'s gate all read the switch as the party can hear it (mutants: the switch read raw; the welcome\'s word never kept)', () => {
  assert.equal(REST_OPT_RELAY_MIN, 120);
  assert.deepEqual(['world119', 'world120', 'world121', 'nope', null].map(relaySupportsRestOpt), [false, true, true, false, false]);
  const O = src('src/net/online.js');
  assert.match(O, /this\.restOptOk = false;/);
  assert.match(O, /if \(primary\) this\.restOptOk = relaySupportsRestOpt\(relayV\);/);
  assert.match(W, /const restsWithParty = \(\) => getPref\('restWithParty'\) !== false \|\| !socialLink\(\)\?\.restOptOk;/);
  assert.equal((W.match(/getPref\('restWithParty'\)/g) ?? []).length, 1, 'read raw in that one place alone');
});

test('AUDIT REST-OPT C2: a party mate\'s night beside mine that is not one with it is ANOTHER CAMP - STRANGER-REST keeps it apart as a stranger\'s: two nights side by side each rolled the night\'s foes for the whole party (mutants: a resting mate never a camp; a mate at rest with me a camp)', () => {
  const m = (p) => ({ acct: 'a-bran', p });
  assert.equal(restsApart(m({ rs: 1, nr: 1 }), true), true, 'resting alone beside my party\'s night');
  assert.equal(restsApart(m({ rs: 1 }), false), true, 'resting at all while I rest alone');
  assert.equal(restsApart(m({ rs: 1 }), true), false, 'the same night: one camp');
  assert.equal(restsApart(m({ nr: 1 }), true), false, 'not resting: no camp (the party may rest beside a mate who opted out)');
  assert.equal(restsApart(null, false), false);
  assert.equal(restsAlone(m({ nr: 1 })), true);
  assert.match(REST_APART_TEXT, /resting apart from you nearby - rest farther away/);
  assert.match(W, /const otherPartyCamp = \(peerId\) => restsApart\(social\?\.others\(\)\.find\(\(o\) => o\.peers\?\.includes\(peerId\)\) \?\? null, restTogether\(\)\);/);
});

test('AUDIT REST-OPT C3 + F4: a night granted as my own stays my own to its end (`nr` while it runs) - a leader who turned the switch back on mid-night pulled the whole party into it; a followed night is the party\'s; and the switch is named where it is (Features, Other players - not Settings) (mutants: the grant\'s word never kept; a mirror left alone)', () => {
  assert.match(W, /\.\.\.\(!restsWithParty\(\) \|\| \(_restAloneNight && playerEntity\.isResting\) \? \{ nr: 1 \} : \{\}\),/);
  assert.match(W, /_cancelSeen = snapshotCancels\(social\.others\(\)\);[^\n]*\n\s*_restAloneNight = !restTogether\(\);/, 'the grant says whose night it is');
  assert.match(W, /_partyRestStartWaived = false;   \/\/ PARTY-REST29: a real \(mirrored\) rest cools down again\n\s*_restAloneNight = false;/, 'a mirror is the party\'s');
  assert.equal(restAloneText(false), 'You rest on your own. Turn on "Rest with my party" (Features, Other players) to rest with them.');
  assert.match(src('src/ui/enhancedMenu.js'), /function modsFooter\(body\) \{[\s\S]{0,300}body\.append\(peerSpritesCard\(\)\);/, 'the Other players card is the Features pane\'s');
});

test('AUDIT COMPASS-PARTY C4 + C6: a concealed mate is no compass mark (the leader\'s own feet followed them); out of a party the room\'s players are not walked each frame for it (mutants: the poses unfiltered; the walk first)', () => {
  assert.match(W, /others: social\.others\(\)\.filter\(\(m\) => !m\.peers\?\.some\(\(id\) => _hiddenPeers\.has\(id\)\)\)/);
  assert.match(W, /const partyNear = \(\) => \{\s*\n\s*if \(!social\?\.party\) return \[\];[^\n]*\n\s*const near = peersNear\(\);/);
});

// ─── TRADE-FIT (agents D and F) ────────────────────────────────────────────────────────────────────────────────────

test('AUDIT TRADE-FIT D1: the wire names the revision\'s bound the offer is measured by, and the session measures the commit with it (driven in tradeinfo.test.js) (mutants: the frame alone)', () => {
  assert.equal(TRADE_REV_MAX, 1_000_000);
  const T = src('src/net/tradeSession.js');
  assert.match(T, /export const tradeCommitBytes = \(\{ items, g, to, s, r \}\) => JSON\.stringify\(\{ to, k: 'commit', s, r, o: TRADE_REV_MAX, items, g \}\)\.length;/);
  assert.match(T, /\|\| tradeCommitBytes\(\{ items: wired, g, to: this\.peer, s: this\.sid, r: this\.rev \+ 1 \}\) > TRADE_DATA_MAX\) \{/);
});
