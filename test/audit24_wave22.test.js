// AUDIT 24 (the full-codebase parity sweep), wave 22: six seams that
// were ported and then never reached - plus one pin that had asserted
// the port's behaviour instead of the source's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HudText } from '../src/ui/hudText.js';
import { PlayerNotebook } from '../src/systems/notebook.js';
import { STATIC_NPC_ACTIVATION_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../src/systems/talk.js';
import { midDateTimeString } from '../src/systems/gameDate.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('audit24 wave22: every HUD popup files into the notebook message ring', () => {
  // PopupText.AddText's last line (:123) is
  // `GameManager.Instance.PlayerEntity.Notebook.AddMessage(pgText)`,
  // and DaggerfallHUD.SetMidScreenText (:371) does the same. The
  // journal's Messages page IS that ring. The port had the ring,
  // GetMessages and AddMessage all ported with NOTHING calling
  // AddMessage, so the fourth page of the journal was blank for ever.
  const notebook = new PlayerNotebook();
  const hud = new HudText();
  hud.onMessage = (t) => notebook.addMessage(t);
  hud.add('Your Lockpicking skill has improved.');
  hud.add('You are too far away.');
  const messages = notebook.getMessages().map((m) => m.map((t) => t.text ?? '').join('').trim());
  assert.deepEqual(messages, ['Your Lockpicking skill has improved.', 'You are too far away.']);
  // the row is still queued for drawing - the file is an addition, not
  // a diversion
  assert.equal(hud.lines.length, 2);

  // and a HudText with no sink still works (the dungeon host builds
  // one before the bridge exists)
  const bare = new HudText();
  bare.add('x');
  assert.equal(bare.lines.length, 1);
});

test('audit24 wave22: the two hosts hand their HudText the notebook sink', () => {
  assert.match(rd('src/ui/hudText.js'), /this\.lines\.push\(\{ text \}\);\s*\n\s*this\.onMessage\?\.\(text\);/,
    'AddText files AFTER it queues, as C# does');
  assert.match(rd('src/scenes/world.js'),
    /townTalk\.hudMessageSink = \(t\) => questBridge\?\.notebook\?\.addMessage\(t\);/);
  assert.match(rd('src/scenes/townTalk.js'), /set hudMessageSink\(fn\) \{ hud\.onMessage = fn; \}/);
  assert.match(rd('src/scenes/dungeonContext.js'), /hudText\.onMessage = \(t\) => opts\.hudMessageSink\?\.\(t\);/);
  assert.match(rd('src/scenes/worldModes.js'),
    /hudMessageSink: \(t\) => questBridge\?\.notebook\?\.addMessage\(t\),/);
});

test('audit24 wave22: the TG/DB map reveal files its notebook note', () => {
  // ThievesGuild.cs:114-116 and DarkBrotherhood.cs:107-109 both do
  // `Notebook.AddNote(GetLocalizedText(key).Replace("%map", name))`.
  // The port's revealLocation discovered the dungeon and then only
  // console.warn'd "the notebook note pends its surface" - a seam that
  // had in fact been wired 340 lines above it since wave 4.
  const s = rd('src/scenes/world.js');
  assert.match(s, /readMapTG: 'The Thieves Guild have revealed the closely-guarded whereabouts of a treasure trove called %map\.'/);
  assert.match(s, /readMapDB: 'The Dark Brotherhood revealed the secret of some treasure-laden crypts located somewhere called %map\.'/);
  assert.match(s, /questBridge\?\.notebook\?\.addNote\(REVEAL_NOTE_TEXT\[noteKey\]\?\.replace\('%map', picked\.name\) \?\? ''\);/);
  assert.doesNotMatch(s, /the notebook note pends its surface/, 'and the pending warning is gone');

  // the note itself, end to end through the real notebook
  const notebook = new PlayerNotebook({ dateTimeString: () => '13:30:00', cityName: () => 'Daggerfall' });
  notebook.addNote('The Thieves Guild have revealed the closely-guarded whereabouts of a treasure trove called Privys Crypt.');
  const note = notebook.getNote(0).map((t) => t.text ?? '').join(' ');
  assert.match(note, /Privys Crypt/);
  assert.match(note, /13:30:00 in Daggerfall:/, 'and it carries the dated header');
});

test('audit24 wave22: a quest ITEM gets the 128 reach, a quest PERSON the 256', () => {
  // PlayerActivate.cs:326-332 - the quest-resource arm is gated on
  // `!(questResourceBehaviour.TargetResource is Person)` and then
  // measured against DefaultActivationDistance. A Person goes through
  // StaticNPCClick instead, at StaticNPCActivationDistance.
  assert.equal(DEFAULT_ACTIVATION_DISTANCE, 128 * 0.025);
  assert.equal(STATIC_NPC_ACTIVATION_DISTANCE, 256 * 0.025);
  assert.equal(STATIC_NPC_ACTIVATION_DISTANCE, DEFAULT_ACTIVATION_DISTANCE * 2, 'twice, exactly');

  const s = rd('src/scenes/worldModes.js');
  assert.match(s, /const isPerson = s\.behaviour\?\.targetResource\?\.isPerson === true;/);
  assert.match(s, /distance: isPerson \? STATIC_NPC_ACTIVATION_DISTANCE : DEFAULT_ACTIVATION_DISTANCE,/);
  // `=== true` is load-bearing: a behaviour with NO target resource is
  // not a Person either (`!(null is Person)` is true in C#), so it
  // must land on the 128 arm rather than on `undefined ? ... : ...`
  // reading as anything else.
  assert.doesNotMatch(s, /distance: s\.behaviour\?\.targetResource\?\.isPerson \?/);
});

test('audit24 wave22: the quest NPC hash reads marker.flatPosition, not the stand position', () => {
  // GameObjectHelper.cs:1062 -
  // `npc.SetLayoutData((int)marker.flatPosition.x, ..., person)`.
  // The billboard stands at `dungeonBlockPosition + marker
  // .flatPosition` (:1022), and the port hashed THAT. Same thing in a
  // building (dungeonX/dungeonZ are 0); a whole RDB block apart in a
  // dungeon, which is a different hash, a different nameSeed fallback
  // and therefore a different generated name than DFU's.
  const s = rd('src/scenes/worldModes.js');
  assert.match(s, /function standQuestFlat\(archive, record, position, behaviour, staticNpcFactionId = null, hashPosition = null\)/);
  assert.match(s, /marker: hashPosition \?\? position,/);
  assert.match(s, /standNPC: \(\{ marker, person, flatData, position, behaviour \}\) =>\s*\n\s*standQuestFlat\(flatData\.archive, flatData\.record, position, behaviour, person\?\.factionId \?\? null, marker\?\.flatPosition \?\? null\),/);
});

test('audit24 wave22: StaticNPCClick talks with menu:false and carries the spymaster flag', () => {
  // All four TalkToStaticNPC calls in StaticNPCClick pass menu:false
  // (:1591, :1601, :1633, :1636) - the talk did not come from a popup
  // menu, so DaggerfallQuestOfferWindow must not close itself when its
  // message box closes (:94-97). And the HolyOrder/spymaster escape
  // (:1633) is the one that passes `factionData.id == TG_Spymaster`,
  // which staticNpcRoute has computed since G8 and the call site threw
  // away.
  const s = rd('src/scenes/worldModes.js');
  assert.match(s, /\{ menu: false, isSpyMaster: route\.spymaster === true \}\);/);
  assert.doesNotMatch(s, /\{ menu: true \}\);/, 'and not the popup-menu form');
});

test("audit24 wave22: the {0:00} pad rounds, so DFU prints ':60'", () => {
  // DaggerfallDateTime.Second is a FLOAT (:63) and .NET's "00" custom
  // format rounds away from zero. The port floored, and an earlier pin
  // in questbridge.test.js asserted the flooring was correct "because
  // C#'s Hour/Minute/Second are ints" - which is true of two of the
  // three.
  assert.match(midDateTimeString({ year: 405, month: 0, day: 0, hour: 1, minute: 2, second: 59.5 }),
    /^01:02:60 /, 'the impossible reading, verbatim');
  assert.match(midDateTimeString({ year: 405, month: 0, day: 0, hour: 1, minute: 2, second: 59.49 }),
    /^01:02:59 /);
  assert.match(rd('src/systems/gameDate.js'), /const pad2 = \(n\) => String\(Math\.round\(n\)\)\.padStart\(2, '0'\);/);
});
