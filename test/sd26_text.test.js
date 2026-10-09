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
