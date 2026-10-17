// @ts-check
// DRUNK1 (2026-10-17, asked for: "The slurred speech and NPCs reactions
// should just be modified text triggered by the state of drunkness").
// THE DRINK, HEARD. The words half of the drunk feel (drunkFeel.js is
// the eye and the feet): text only, read off the same bands the HUD's
// chip draws (drunkFeel.js drunkStateOf), so a sober player's words are
// never touched and a line is changed as the drink stands when it is
// said, not when the window opened.
//
//   - SLURRED SPEECH: what the PLAYER says - the talk window's
//     player-says line (NativeTalkWindow's question, the Work page's
//     too) and a line said aloud on the Local chat tab, the in-character
//     one (net/chat.js CHAT_TABS: "speak in character here"). An `s`
//     turns `sh`, a word drags a vowel, an -ing loses its g and a *hic*
//     falls between words. Never inside (( )), the Local tab's
//     out-of-character aside, and never a word carrying markup (a
//     macro's %, a link, a mention), so nothing the game reads back is
//     broken. The other channels are left alone: World, Trade and LFG
//     are the player at the keyboard, not the character at the bar.
//   - NPC REACTIONS: what the NPC says back - a line after the greeting
//     that notices the drink, and now and then a word before an answer.
//     The answer itself is never changed: a quest's directions stay
//     readable however drunk the asker.
//
// The door is talkDoor.js createTalkWindow (the one door under every
// conversation): `drunkTalk` hands it the greeting and a hooks object
// whose question and answer hooks say the drink, everything else read
// through to the session's own.

import { drunkFeel, feelTarget, FEEL_FLOOR } from './drunkFeel.js';
import { CHAT_MAX } from '../../net/wire.js';   // the one line a chat send carries
import { t } from '../textManager.js';   // L10N4: the NPC's words in the player's language, read as they are said

/** What the NPC says after the greeting, by band - read through the text core each time one is said. */
export const GREETING_REACTIONS = Object.freeze({
  drunk: () => [
    t('survival.drunk.greet.fewHad', 'Had a few, have we?'),
    t('survival.drunk.greet.tavernFloor', 'You smell like a tavern floor.'),
    t('survival.drunk.greet.steadyOn', 'Steady on, friend.'),
    t('survival.drunk.greet.atTheAle', 'Been at the ale, I see.'),
  ],
  veryDrunk: () => [
    t('survival.drunk.greet.barelyStand', 'By the Nine, you can barely stand!'),
    t('survival.drunk.greet.reek', 'You reek of drink. Make it quick.'),
    t('survival.drunk.greet.soberUp', 'Sober up before you talk to me.'),
    t('survival.drunk.greet.seeStraight', 'Can you even see straight? Speak slowly.'),
  ],
});

/** What the NPC says before an answer, by band - and the chance of one. */
export const ANSWER_REACTIONS = Object.freeze({
  drunk: () => [
    t('survival.drunk.answer.hm', 'Hm? Oh.'),
    t('survival.drunk.answer.slowDown', 'Slow down, friend.'),
    t('survival.drunk.answer.plainly', 'Let me say it plainly.'),
  ],
  veryDrunk: () => [
    t('survival.drunk.answer.speakClearly', 'What? Speak clearly!'),
    t('survival.drunk.answer.breath', 'Gods, your breath...'),
    t('survival.drunk.answer.barelyUnderstand', 'I can barely understand you.'),
    t('survival.drunk.answer.sitDown', 'Sit down before you fall down.'),
  ],
});
export const ANSWER_REACTION_CHANCE = Object.freeze({ drunk: 0.25, veryDrunk: 0.5 });

/** THE SLUR at full strength (strength is drunkFeel.js feelTarget: 0.35 at the Drunk line, 1 at the endurance): an `s`
 *  turned `sh` (the floor and the share added at full), a long word's vowel dragged, an -ing's g dropped (only past
 *  the floor), a *hic* between two words - at most this many a line. */
export const SLUR = Object.freeze({
  sh: Object.freeze({ floor: 0.5, add: 0.5 }),
  drag: 0.12,
  dragMinLetters: 4,
  dropG: 0.6,
  hic: Object.freeze({ floor: 0.06, add: 0.1, most: Object.freeze({ drunk: 1, veryDrunk: 2 }) }),
  hicWord: '*hic*',
});

/** A word the slur leaves alone: markup the game reads back (a macro, a placeholder, a tag, a link, a mention). */
const UNTOUCHED = /[%{}<>[\]\/@#\\|_=]|:\/\//;
const VOWEL = /[aeiouAEIOU]/;

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** One word slurred at `k`. */
function slurWord(word, k, rng) {
  if (!word || UNTOUCHED.test(word) || !/[A-Za-z]/.test(word)) return word;
  const shouted = word === word.toUpperCase();   // a word in capitals slurs in capitals
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const c = word[i], next = word[i + 1] ?? '';
    if ((c === 's' || c === 'S') && next !== 'h' && next !== 'H' && rng() < SLUR.sh.floor + SLUR.sh.add * k) out += c === 's' ? 'sh' : (shouted ? 'SH' : 'Sh');
    else out += c;
  }
  const letters = out.replace(/[^A-Za-z]/g, '');
  if (k > FEEL_FLOOR && /ing\b/.test(out) && rng() < SLUR.dropG * (k - FEEL_FLOOR) / (1 - FEEL_FLOOR)) out = out.replace(/ing\b/, "in'");
  else if (letters.length >= SLUR.dragMinLetters && rng() < SLUR.drag * k) {
    for (let i = out.length - 1; i >= 0; i--) if (VOWEL.test(out[i])) { out = out.slice(0, i + 1) + out[i].repeat(2) + out.slice(i + 1); break; }
  }
  return out;
}

/**
 * A line said at the drink `state` ({ band, share }, drunkFeel.js drunkStateOf): the line itself when sober, slurred
 * otherwise. The (( )) aside is kept as it was written.
 */
export function slurLine(text, state, rng = Math.random) {
  if (typeof text !== 'string' || !text || !state || state.band === 'sober') return text;
  const k = feelTarget(state);
  const most = SLUR.hic.most[state.band] ?? 1;
  let hics = 0;
  let words = 0;
  return text.split(/(\(\([\s\S]*?\)\))/).map((part, i) => {
    if (i % 2 === 1) return part;   // an aside, as written
    return part.split(/(\s+)/).map((tok) => {
      if (!tok || /^\s+$/.test(tok)) return tok;
      let w = slurWord(tok, k, rng);
      if (words > 0 && hics < most && rng() < SLUR.hic.floor + SLUR.hic.add * k) { w = `${SLUR.hicWord} ${w}`; hics++; }
      words++;
      return w;
    }).join('');
  }).join('');
}

/** The greeting with the NPC's word on the drink after it - the greeting itself when sober. */
export function greetingAt(greeting, state, rng = Math.random) {
  const list = state && GREETING_REACTIONS[state.band]?.();
  if (!list || typeof greeting !== 'string') return greeting;
  return greeting ? `${greeting} ${pick(list, rng)}` : pick(list, rng);
}

/** An answer, now and then with the NPC's word on the drink before it. The answer itself is never changed. */
export function answerAt(answer, state, rng = Math.random) {
  const list = state && ANSWER_REACTIONS[state.band]?.();
  if (!list || typeof answer !== 'string' || !answer) return answer;
  if (!(rng() < (ANSWER_REACTION_CHANCE[state.band] ?? 0))) return answer;
  return `${pick(list, rng)} ${answer}`;
}

/**
 * THE TALK WINDOW'S DRINK (talkDoor.js createTalkWindow): the greeting as said now, and the session's hooks with the
 * player-says lines slurred and the answers reacted to - each read as the drink stands when it is said. Every other
 * hook (the name, the topics, the tone, the close) reads through to the session's own object, unchanged.
 */
export function drunkTalk(greeting, hooks, { state = () => drunkFeel.state(), rng = Math.random } = {}) {
  if (!hooks || typeof hooks !== 'object') return { greeting, hooks };
  const wrapped = Object.create(hooks);
  const say = (name, fn) => {
    const own = hooks[name];
    if (typeof own === 'function') wrapped[name] = (...args) => fn(own.apply(hooks, args), state(), rng);
  };
  say('question', slurLine);
  say('workQuestion', slurLine);
  say('answer', answerAt);
  say('askWork', answerAt);
  return { greeting: greetingAt(greeting, state(), rng), hooks: wrapped };
}

/** THE LOCAL TAB'S DRINK: a line said aloud there, slurred as the drink stands; any other tab's line as it is. A slur
 *  that would run past the wire's line (net/wire.js CHAT_MAX, where the send cuts it) is not said slurred: the drink
 *  never costs the player the end of what they typed. */
export function chatSaid(tabId, text, { state = () => drunkFeel.state(), rng = Math.random } = {}) {
  if (tabId !== 'local') return text;
  const said = slurLine(text, state(), rng);
  return typeof said === 'string' && said.length > CHAT_MAX ? text : said;
}
