// DRUNK1 (2026-10-17, asked for: "The slurred speech and NPCs reactions should just be modified text triggered by the
// state of drunkness") - THE DRINK, HEARD (src/systems/survival/drunkSpeech.js). Pinned here: a sober line is never
// touched; the slur's own words at a forced roll, its *hic* cap per band, the (( )) aside and the markup kept; the NPC's
// greeting and answer reactions, the answer itself kept whole; the talk door's hooks - the player-says lines slurred
// and the answers reacted to as the drink stands when each is said, every other hook read through - through the real
// door and the window it builds; the Local tab alone slurs, and never past the wire's line.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  slurLine, greetingAt, answerAt, drunkTalk, chatSaid, GREETING_REACTIONS, ANSWER_REACTIONS, SLUR,
} from '../../../src/systems/survival/drunkSpeech.js';
import { drunkFeel } from '../../../src/systems/survival/drunkFeel.js';
import { survivalOf } from '../../../src/systems/survival/needs.js';
import { tavernDrink } from '../../../src/systems/survival/tavernMenu.js';
import { createTalkWindow } from '../../../src/ui/talkDoor.js';
import { CHAT_MAX } from '../../../src/net/wire.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';

afterEach(() => { _resetForTests(); drunkFeel.frame(1, { entity: { survival: { drunk: 0 } } }); });

const SOBER = Object.freeze({ band: 'sober', share: 0 });
const DRUNK = Object.freeze({ band: 'drunk', share: 0 });
const VERY = Object.freeze({ band: 'veryDrunk', share: 1 });
const always = () => 0;
const never = () => 0.999;
const LINE = 'Is this the Mages Guild? Nothing interesting.';

test('DRUNK1: a sober line is the line itself', () => {
  assert.equal(slurLine(LINE, SOBER, always), LINE);
  assert.equal(slurLine(LINE, null, always), LINE);
  assert.equal(slurLine('', VERY, always), '');
  assert.equal(greetingAt('Hello.', SOBER, always), 'Hello.');
  assert.equal(answerAt('North.', SOBER, always), 'North.');
});

test('DRUNK1: the slur\'s words at a forced roll - every s, a dragged vowel or a dropped g, and the band\'s hics', () => {
  assert.equal(slurLine(LINE, DRUNK, always), 'Ish *hic* thiiish the Mageeesh Guiiild? Nothiiing intereshtiiing.', 'at the Drunk line the -ing keeps its g');
  assert.equal(slurLine(LINE, VERY, always), "Ish *hic* thiiish *hic* the Mageeesh Guiiild? Nothin' intereshtin'.");
  assert.equal(slurLine(LINE, VERY, never), 'Ish thish the Magesh Guild? Nothing intereshting.', 'past every chance but the floor of the sh');
  assert.equal(slurLine('STOP SHOUTING', VERY, always), 'SHTOOOP *hic* SHOUTIIING', 'a word in capitals slurs in capitals');
  const hics = (state) => slurLine('one two three four five six seven', state, always).split(SLUR.hicWord).length - 1;
  assert.deepEqual([hics(DRUNK), hics(VERY)], [SLUR.hic.most.drunk, SLUR.hic.most.veryDrunk]);
});

test('DRUNK1: the (( )) aside and the markup the game reads back are never slurred', () => {
  assert.equal(slurLine('So, see you ((afk, sorry)) at %ln http://x.io', VERY, always), 'Sho, *hic* sheeee *hic* you ((afk, sorry)) at %ln http://x.io');
});

test('DRUNK1: the NPC notices the drink after the greeting, by band', () => {
  assert.equal(greetingAt('Greetings.', DRUNK, always), `Greetings. ${GREETING_REACTIONS.drunk()[0]}`);
  assert.equal(greetingAt('Greetings.', VERY, never), `Greetings. ${GREETING_REACTIONS.veryDrunk().at(-1)}`);
});

test('DRUNK1: an answer is sometimes prefaced, never changed', () => {
  assert.equal(answerAt('It is to the north.', VERY, always), `${ANSWER_REACTIONS.veryDrunk()[0]} It is to the north.`);
  assert.equal(answerAt('It is to the north.', VERY, never), 'It is to the north.', 'past the chance: the answer bare');
  assert.equal(answerAt('', VERY, always), '');
});

test('DRUNK1: the talk hooks say the drink as it stands when each line is said, and read every other hook through', () => {
  let state = SOBER;
  let named = 'Ulfric';
  const session = {
    tone: () => 1,
    get npcName() { return named; },
    asked: [],
    question(it) { this.asked.push(it.name); return `Where is ${it.name}?`; },
    answer: (it) => `${it.name} is north.`,
  };
  const { greeting, hooks } = drunkTalk('Hail.', session, { state: () => state, rng: always });
  assert.equal(greeting, 'Hail.', 'sober at the greeting');
  assert.equal(hooks.question({ name: 'the Mages Guild' }), 'Where is the Mages Guild?');
  state = VERY;
  assert.equal(hooks.question({ name: 'the Mages Guild' }), 'Whereee *hic* ish *hic* the Mageeesh Guiiild?');
  assert.equal(hooks.answer({ name: 'It' }), `${ANSWER_REACTIONS.veryDrunk()[0]} It is north.`);
  assert.deepEqual(session.asked, ['the Mages Guild', 'the Mages Guild'], 'the session\'s own hook ran as its own (`this`)');
  named = 'Elsa';
  assert.equal(hooks.npcName, 'Elsa', 'a getter reads through live');
  assert.equal(hooks.tone(), 1);
  assert.equal(hooks.workQuestion, undefined, 'a hook the session has not is not invented');
});

test('DRUNK1: through the real door - the window\'s greeting and its player-says line, from a drink the tavern poured', () => {
  const p = { isPlayer: true, stats: { endurance: 50 }, activeEffects: [] };
  const s = survivalOf(p, 0);
  tavernDrink(s, 25, { endurance: 50 });
  tavernDrink(s, 25, { endurance: 50 });   // fifty on fifty: Very drunk
  drunkFeel.frame(0, { entity: p });   // the hosts hand the feel its entity each frame
  const model = createTalkWindow('Good day.', { categories: () => [], question: (it) => `Where is ${it.name}?`, answer: () => 'There.', tone: () => 1, setTone() {}, onClose() {} });
  const greeting = String(model.conversation[0]);
  assert.ok(GREETING_REACTIONS.veryDrunk().some((r) => greeting === `Good day. ${r}`), greeting);
  model.topics = [{ name: 'the docks' }];
  model.topicMode = 'buildings';
  model._updateQuestion(0);
  assert.notEqual(model.question, 'Where is the docks?', 'the player-says line is slurred');
  assert.match(model.question, /\bish\b/,'at the endurance every s is sh, whatever else the roll does');
});

test('DRUNK1: the Local tab alone slurs, and never past the wire\'s line', () => {
  const st = () => VERY;
  assert.equal(chatSaid('world', 'Selling swords', { state: st, rng: always }), 'Selling swords');
  assert.equal(chatSaid('trade', 'Selling swords', { state: st, rng: always }), 'Selling swords');
  assert.equal(chatSaid('local', 'Selling swords', { state: st, rng: always }), "Shellin' *hic* shwooordsh");
  const long = 'sss '.repeat(Math.ceil(CHAT_MAX / 4)).trim().slice(0, CHAT_MAX - 1);
  assert.equal(chatSaid('local', long, { state: st, rng: always }), long, 'a slur that would be cut is not said slurred');
});
