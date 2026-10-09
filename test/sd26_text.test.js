// AUDIT SD IV, SD26 (2026-10-08, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD IV"): WHAT
// THE PLAYER READS, AUDITED A FOURTH TIME - the text lens's findings, each reproduced and pinned here: the fight's turns
// on the card where its bar stands (T1).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdBeats, SD_BEAT_TEXT, SD_BEAT_LAST_MS } from '../src/scenes/sdArenaRead.js';
import { titleCardModel } from '../src/ui/gateTitleCard.js';
import { sdBarNear } from '../src/ui/sdRemnantBar.js';
import { SD_ARENA } from '../src/net/sdBrain.js';
import { createSdVoice, SD_VOICE_RANK, SD_VOICE_READ_MS } from '../src/scenes/sdVoice.js';
import { SD_BLOWS_TEXT } from '../src/scenes/sdRemnantBlows.js';
import { sdCollapseLine } from '../src/scenes/sdHost.js';
import { SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { SD_SPOILS_TEXT } from '../src/systems/sdSpoils.js';
import { SD_HOME_TEXT } from '../src/scenes/sdEnd.js';
import { SD_REM_SINK_MS } from '../src/scenes/sdRemnant.js';
import { SD_RECEIPT_WAIT_MS } from '../src/scenes/sdSpoils.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const T0 = 1_800_000_000_000;

/** world.js's own sdFightFrame over a fight, a player and a card the test holds. */
function fightHost() {
  const at = W.indexOf('\n  const sdFightFrame = () => {');
  const text = W.slice(at + 1, W.indexOf('\n  };\n', at) + 5);
  const st = { t: T0, x: SD_ARENA.x, z: SD_ARENA.z, s: { fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: null, ec: null, clk: null, cx: null, fell: null, lost: 0, ends: T0 + 9e6 } };
  const cards = [];
  const env = {
    modes: { sdRealmSlot: () => 3 }, sdFightLink: { leave() {}, state: () => st.s, now: () => st.t }, _sdReceipts: new Map(), sdReceiptsLeft() {},
    sdSpoilsBurst: { leave() {}, frame() {} }, sdBlows: { leave() {}, frame() {} }, sdFx: { leave() {}, frame() {} }, saveSoon: { changed() {} },
    player: { pos: [0, 0, 0] }, playerEntity: { health: 10, maxHealth: 10 }, sdDungeonToRealm: () => [st.x, 0, st.z], sdBarNear,
    remnantBarModel: () => ({ bar: true }), drawGateBossBar() {}, gamePaused: () => false, townTalk: { hudHidden: false },
    sdRemVoice: { leave() {}, frame() {} }, cam: { yaw: 0 }, SD_ARENA, sdPerilAt: () => null, sdGroundModel: () => null,
    sdBeats: createSdBeats(), titleCardModel, drawGateGround() {}, drawSdTitleCard: (m) => cards.push(m ? m : null),
    sdMarksCardModel: () => null, sdMarksOf: () => null, drawGateMarksCard() {}, performance: { now: () => 0 }, gateVeil: { busy: false },
  };
  const frame = new Function(...Object.keys(env), `let _sdHall = null, _sdFightHeld = false, _sdBarUp = false, _sdGroundUp = false, _sdCardUp = false, _sdMarksSince = null, _sdMarksUp = false, _sdPassesWarm = true;\n${text}\nreturn sdFightFrame;`)(...Object.values(env));
  return { st, cards, step: (ms = 16) => { st.t += ms; frame(); }, shown: () => cards.filter(Boolean).map((m) => m.main) };
}

test('SD26 THE FIGHT\'S TURNS ON THE CARD WHERE ITS BAR STANDS (T1): AUDIT SD II L6 F15 says the fight\'s turns only to whoever stands where its bar stands, its fall to the whole Hour - and SD15\'s title card took every turn to the whole realm: a fighter\'s friend mid-jump on the Crumble had "The Dragon Break - Fell Gold and Silver within 15 seconds of each other" over the platforming, the voice having just kept it from them. The wake, the Break and the Last Moment are drawn near the arena alone; the last minute (AUDIT SD III A10) and the fall stand for the whole Hour; the beats still follow the fight far off, so a turn passed there is never drawn late on reaching it (mutants: the turns to the whole Hour; the last minute withheld; the fall withheld)', () => {
  // on the Crumble: the Dragon Break turns - nothing drawn
  const h = fightHost();
  h.st.x = 0; h.st.z = 190;
  assert.equal(sdBarNear(h.st.x, h.st.z), false, 'the Crumble is past the bar\'s reach');
  h.step(); h.step();
  h.st.s = { ...h.st.s, ph: 2 }; h.step();
  for (let i = 0; i < 40; i++) h.step(100);
  assert.deepEqual(h.shown(), [], 'the Break is the arena\'s');
  // walking in after its card's span: the turn passed far off is not drawn late
  h.st.x = SD_ARENA.x; h.st.z = SD_ARENA.z; h.step();
  assert.deepEqual(h.shown(), [], 'a turn passed far off, never drawn late');
  // at the arena: the Last Moment drawn
  h.st.s = { ...h.st.s, ph: 3 }; h.step();
  assert.deepEqual(h.shown(), [SD_BEAT_TEXT.moment.main], 'the Last Moment, at its arena');
  // the last minute and the fall: the whole Hour's, in the hall
  const w = fightHost();
  w.st.x = 0; w.st.z = 42;
  w.step(); w.step();
  w.st.s = { ...w.st.s, ends: w.st.t + SD_BEAT_LAST_MS - 100 }; w.step();
  assert.equal(w.shown().at(-1), SD_BEAT_TEXT.last.main, 'the last minute');
  for (let i = 0; i < 40; i++) w.step(100);
  w.st.s = { ...w.st.s, fell: { at: w.st.t, top: [], n: 1 } }; w.step();
  assert.equal(w.shown().at(-1), SD_BEAT_TEXT.fell.main, 'its fall');
});

test('SD26 THE KILL READ WHOLE, THE WAY HOME WITH IT (T2): L6 F2 read the fall, the floor\'s word and the collapse\'s first readout each whole - and the way home\'s rising, said SD_REM_SINK_MS after the fall, cut the readout 0.5 s into its 3.7 (its count, and where the way home is, the next count a minute off); for one who earned nothing the no-spoils note, due the same instant, cut the readout and was cut by the rising in the same frame, never drawn. A line cut goes back to the head of its rank, its wait begun anew; one cut with under SD_VOICE_READ_MS left was read. Replayed in world.js\'s frame order (the spoils before the way home), the fall word heard 16 ms to 1.2 s late: every line stands its whole length once, the readout within its life (mutants: a cut line lost; a cut line queued behind its rank; a line nearly read said again; the thread\'s replaced word back)', () => {
  const fell = SD_BLOWS_TEXT.fell, readout = sdCollapseLine(SD_COLLAPSE_MS, { hour: true, first: true });
  const whole = (shown, text) => shown.some((x, k) => x.text === text && (k === shown.length - 1 || shown[k + 1].at > x.at + x.secs * 1000 - SD_VOICE_READ_MS));
  const kill = (L, earned) => {
    let t = 0;
    const shown = [];
    const v = createSdVoice({ show: (text, secs) => shown.push({ text, secs, at: t }), now: () => t });
    const events = [[L, () => v.say(fell)], [L + 152, () => v.say(readout, SD_VOICE_RANK.readout)]];
    if (earned) events.push([Math.max(L, 1200), () => v.say(SD_SPOILS_TEXT.spilled, SD_VOICE_RANK.note)]);
    else events.push([SD_RECEIPT_WAIT_MS, () => v.say(SD_SPOILS_TEXT.none, SD_VOICE_RANK.note)]);
    events.push([SD_REM_SINK_MS, () => v.say(SD_HOME_TEXT.rises)]);   // modes.frame, after the fight's frame
    for (; t <= 20_000; t += 16) { for (const [at, say] of events) if (at > t - 16 && at <= t) say(); v.frame(); }
    return shown;
  };
  for (const L of [16, 250, 900]) {
    const shown = kill(L, true);
    for (const text of [fell, SD_SPOILS_TEXT.spilled, readout, SD_HOME_TEXT.rises]) assert.ok(whole(shown, text), `L ${L} ms: "${text}" read whole - ${JSON.stringify(shown.map((x) => [x.text.slice(0, 16), x.at]))}`);
  }
  for (const L of [16, 250]) {
    const shown = kill(L, false);
    for (const text of [fell, readout, SD_SPOILS_TEXT.none, SD_HOME_TEXT.rises]) assert.ok(whole(shown, text), `no spoils, L ${L} ms: "${text}" read whole - ${JSON.stringify(shown.map((x) => [x.text.slice(0, 16), x.at]))}`);
  }
  assert.equal(SD_REM_SINK_MS, SD_RECEIPT_WAIT_MS, 'the two due the same instant - the case the voice must hold');
  // a line nearly read is not said again; a thread's line its newer word replaced is not put back
  const r = [];
  let t = 0;
  const v = createSdVoice({ show: (text) => r.push(text), now: () => t, seconds: () => 2 });
  v.say('A note.', SD_VOICE_RANK.note);
  t = 2000 - SD_VOICE_READ_MS + 50; v.say('A turn.');
  t = 2000 - SD_VOICE_READ_MS + 60; v.say('A count.', SD_VOICE_RANK.note, 'k');
  t = 2000 - SD_VOICE_READ_MS + 70; v.frame();
  for (t = 5000; t < 20_000; t += 16) v.frame();
  assert.deepEqual(r, ['A note.', 'A turn.', 'A count.'], 'the note had under a second left: read');
  const h = [];
  const w = createSdVoice({ show: (text) => h.push(text), now: () => t, seconds: () => 2 });
  t = 0; w.say('Ann breaks a Heart. 4 remain.', SD_VOICE_RANK.note, 'hearts');
  t = 100; w.say('A turn.');
  t = 200; w.say('Bran breaks a Heart. 3 remain.', SD_VOICE_RANK.note, 'hearts');
  for (t = 300; t < 20_000; t += 16) w.frame();
  assert.deepEqual(h, ['Ann breaks a Heart. 4 remain.', 'A turn.', 'Bran breaks a Heart. 3 remain.'], 'the thread said anew, its cut word never back');
  const u = [];
  const x = createSdVoice({ show: (text) => u.push(text), now: () => t, seconds: () => 2 });
  t = 0; x.say('Ann breaks a Heart. 4 remain.', SD_VOICE_RANK.note, 'hearts');
  t = 100; x.say('The Reset lands!', SD_VOICE_RANK.turn, 'hearts');
  for (t = 200; t < 20_000; t += 16) x.frame();
  assert.deepEqual(u, ['Ann breaks a Heart. 4 remain.', 'The Reset lands!'], 'its own thread\'s more urgent word: the older never back');
  // the cut line at the HEAD of its rank - said before the one of its rank that waited behind it
  const o = [];
  const y = createSdVoice({ show: (text) => o.push(text), now: () => t, seconds: () => 2 });
  t = 0; y.say('First note.', SD_VOICE_RANK.note);
  t = 100; y.say('Second note.', SD_VOICE_RANK.note);
  t = 200; y.say('A turn.');
  for (t = 300; t < 20_000; t += 16) y.frame();
  assert.deepEqual(o, ['First note.', 'A turn.', 'First note.', 'Second note.']);
});
