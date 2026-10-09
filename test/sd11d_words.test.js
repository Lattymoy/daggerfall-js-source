// SD11d (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD II): THE
// ARC'S SECOND AUDIT, WHAT THE PLAYER READS, HEARS AND SEES - each fix as it stands. The Hour's one voice (every line the
// arc says over the screen, standing for its length, never cut by a less urgent one, a thread's newer word in its older
// one's place); the kill read whole; the bar's one callout by what can be done about it, the Echo's clock and the
// Remnant's return; the Hearts heard and said; the fade counted inside the Hollow; the fight's lines near its arena; the
// Hour's own veil; the chart in brass and its Hearts; a Hollow's name small mid-sentence; WB13b's words over the arc; the
// End's wind-up its own pitch; no pow of a negative in the veil and the telegraphs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdVoice, SD_VOICE_RANK, SD_VOICE_WAIT_MS } from '../src/scenes/sdVoice.js';
import { courtSaySeconds } from '../src/scenes/gateCourt.js';
import { createSdFightLink, SD_FIGHT_TEXT, SD_HEARTS_KEY } from '../src/net/sdFightLink.js';
import { SD_BLOWS, SD_BODY, SD_ECHO_PAIR_MS, newRemnantFight, joinRemnant, remnantStateOf } from '../src/net/sdRemnant.js';
import { validSdOut } from '../src/net/wire.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { createSdRemnantBlows, SD_BLOWS_TEXT, SD_BLOW_CUES, SD_HEART_LATE_MS } from '../src/scenes/sdRemnantBlows.js';
import { arenaToDungeon } from '../src/scenes/sdRemnant.js';
import { BOSS_CUES, FIRE_CAST_ID } from '../src/world/gateBoss.js';
import { remnantBarModel, sdBarNear, SD_BAR_TEXT, SD_ECHO_RISE_NEAR_MS } from '../src/ui/sdRemnantBar.js';
import { damageChartModel, DAMAGE_CHART_TEXT, DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_CSS } from '../src/ui/gateDamageChart.js';
import { createGateVeil, VEIL_CUES, VEIL_BRASS_CUES, VEIL_THEMES, VEIL_OPEN_WAIT_TICKS } from '../src/ui/gateVeil.js';
import { GATE_VEIL_FS } from '../src/render/gateVeil.js';
import { TELEGRAPH_FS } from '../src/render/gateTelegraph.js';
import { SOUND } from '../src/systems/soundClips.js';
import { createSdHost, sdCollapseLine, sdFadeDue, sdFadeReadout, SD_FADE_WARN_MS } from '../src/scenes/sdHost.js';
import { sdFirst, sdRise, sdFind, sdFell, sdNameIn, sdFoundLine, sdFellLine, sdFadeLine, SD_CAST_OUT_LINE, SD_NO_CLOSED, SD_NO_FULL, SD_NO_RIFT, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { SD_HALL_TEXT, SD_HALL_SOUNDS } from '../src/scenes/sdHall.js';
import { SD_STEPS_TEXT } from '../src/scenes/sdSteps.js';
import { SD_REALM_TEXT } from '../src/world/sdRealm.js';
import { SD_HOME_TEXT } from '../src/scenes/sdEnd.js';
import { SD_SPOILS_TEXT } from '../src/systems/sdSpoils.js';
import { staticDoorName } from '../src/systems/worldTooltips.js';
import { sdCities, sdTemplates } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
/** A `const name = ` arrow of world.js's own, its text (its body closing `\n  };`). */
const constOf = (name) => { const at = W.indexOf(`\n  const ${name} = `); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  };\n', at) + 5); };
const evalIn = (expr, env) => new Function(...Object.keys(env), `return (${expr});`)(...Object.values(env));
const M = 60_000, H = 3_600_000, T0 = 1_800_000_000_000;

/** A voice on a clock the test turns: every line shown, with its seconds and when. */
function voice() {
  let t = 0;
  const shown = [];
  const v = createSdVoice({ show: (text, secs) => shown.push({ text, secs, at: t }), now: () => t });
  return { v, shown, set: (ms) => { t = ms; }, at: (ms) => { t = ms; v.frame(); }, across: (to, step = 16) => { for (let s = t + step; s <= to; s += step) { t = s; v.frame(); } }, last: () => shown[shown.length - 1]?.text ?? null };
}

// ── the voice ─────────────────────────────────────────────────────────

test('SD11d THE HOUR\'S VOICE: a line said with nothing standing shows at once for its length (WB13e\'s courtSaySeconds - it stood DFU\'s 1.5 s); one said while another stands waits its turn, never replacing it - the fight\'s turns first, then the floor\'s notes, then the readouts, each rank in the order said; a line more urgent cuts the one standing; a line that waited past its life is let go; the same line waits once; leaving lets go what waits (mutants: a line its 1.5 s; each line replacing the last; waiting in the order said whatever its rank; never let go; the same line twice; the leave keeping what waits)', () => {
  const a = 'The Dragon Break! Strike down the Gold and Silver Echoes together.';
  const r = voice();
  r.v.say(a);
  assert.deepEqual(r.shown, [{ text: a, secs: courtSaySeconds(a), at: 0 }], 'at once, its length');
  assert.ok(courtSaySeconds(a) > 3, 'a long order stands longer than DFU\'s 1.5 s');
  r.set(100); r.v.say('Your spoils spill across the arena floor.', SD_VOICE_RANK.note);
  r.set(200); r.v.say('The Hour collapses in 3:00.', SD_VOICE_RANK.readout);
  r.set(300); r.v.say('The spoils of the Last Moment are in your pack.', SD_VOICE_RANK.note);
  assert.equal(r.shown.length, 1, 'none replaced the order');
  assert.deepEqual(r.v.waiting(), ['Your spoils spill across the arena floor.', 'The spoils of the Last Moment are in your pack.', 'The Hour collapses in 3:00.'], 'the notes before the readout, each rank in its order');
  r.across(courtSaySeconds(a) * 1000 + 20);
  assert.equal(r.last(), 'Your spoils spill across the arena floor.', 'the next in its turn, once the first has stood');
  // a turn cuts a note standing
  r.set(r.shown[1].at + 200); r.v.say('The Last Moment! The Remnant returns.');
  assert.equal(r.last(), 'The Last Moment! The Remnant returns.', 'more urgent: at once');
  // the readout waited past its life: let go, and the note behind the turn shown
  r.across(30_000);
  assert.deepEqual(r.shown.map((x) => x.text), [a, 'Your spoils spill across the arena floor.', 'The Last Moment! The Remnant returns.', 'The spoils of the Last Moment are in your pack.'], `a readout ${SD_VOICE_WAIT_MS[SD_VOICE_RANK.readout]} ms stale is let go`);
  // the same line waits once
  const q = voice();
  q.v.say(a); q.v.say('The Hour casts you back.'); q.v.say('The Hour casts you back.');
  assert.deepEqual(q.v.waiting(), ['The Hour casts you back.']);
  // the leave: what waits let go, what stands stands
  q.v.clear();
  assert.deepEqual(q.v.waiting(), []);
  q.across(10_000);
  assert.equal(q.shown.length, 1, 'nothing said after the leave');
  // junk says nothing; a rank out of the table is a turn
  const j = voice();
  j.v.say(42); j.v.say('');
  assert.equal(j.shown.length, 0);
  j.v.say('A note.', SD_VOICE_RANK.note); j.v.say('A word.', 9);
  assert.equal(j.last(), 'A word.', 'an unknown rank is a turn: it cuts the note');
  assert.deepEqual(Object.values(SD_VOICE_RANK), [0, 1, 2]);
  assert.equal(SD_VOICE_WAIT_MS.length, 3);
});

test('SD11d A THREAD SAYS ITSELF ANEW: a line of a thread (`key` - the Reset\'s Hearts) takes the place of its thread\'s line standing (cut at once) or waiting (its place, the newer word), never queued behind it; a line of no thread waits behind it (mutants: the thread queued; the waiting line kept; its place lost)', () => {
  const r = voice();
  r.v.say('The Reset! Break all 5 Hearts!', SD_VOICE_RANK.turn, SD_HEARTS_KEY);
  r.set(300); r.v.say('Ann breaks a Heart. 4 remain.', SD_VOICE_RANK.turn, SD_HEARTS_KEY);
  assert.equal(r.last(), 'Ann breaks a Heart. 4 remain.', 'its thread\'s standing line cut at once');
  r.set(400); r.v.say('The Hour Ends.');
  assert.deepEqual(r.v.waiting(), ['The Hour Ends.'], 'a line of no thread waits');
  r.set(500); r.v.say('Bran breaks a Heart. 3 remain.', SD_VOICE_RANK.turn, SD_HEARTS_KEY);
  assert.equal(r.last(), 'Bran breaks a Heart. 3 remain.');
  assert.deepEqual(r.v.waiting(), ['The Hour Ends.'], 'still waiting, unpassed by the thread');
  // the thread waiting behind another: its place, the newer word
  const w = voice();
  w.v.say('The Hour Ends.');
  w.set(100); w.v.say('Ann breaks a Heart. 2 remain.', SD_VOICE_RANK.turn, SD_HEARTS_KEY);
  w.set(150); w.v.say('The Echo stirs.');
  w.set(200); w.v.say('Bran breaks a Heart. 1 remains.', SD_VOICE_RANK.turn, SD_HEARTS_KEY);
  assert.deepEqual(w.v.waiting(), ['Bran breaks a Heart. 1 remains.', 'The Echo stirs.'], 'the newer count in the older\'s place');
});

// ── the kill (L6 F2, F3, F13) ──────────────────────────────────────────

test('SD11d THE KILL READ WHOLE (L6 F2): the fall, the collapse\'s first readout and the spoils, said within 1.2 s, are read in turn, each its whole length - the fall, then the floor\'s word, then the readout (they replaced each other within 1.2 s and the fall stood 144 ms); with the hub\'s word 600 ms behind, the same; an Echo\'s fall and the Last Moment 250 ms apart (L6 F13) both read whole (mutants: a line its 1.5 s; the readout before the floor\'s word; each replacing the last)', () => {
  const fell = SD_BLOWS_TEXT.fell, readout = sdCollapseLine(SD_COLLAPSE_MS, { hour: true, first: true }), spilled = SD_SPOILS_TEXT.spilled;
  for (const hub of [152, 600]) {
    const r = voice();
    r.set(8); r.v.say(fell);
    r.across(hub); r.v.say(readout, SD_VOICE_RANK.readout);
    r.across(1208); r.v.say(spilled, SD_VOICE_RANK.note);
    r.across(12_000);
    assert.deepEqual(r.shown.map((x) => x.text), [fell, spilled, readout], `hub ${hub} ms: every line, in turn`);
    for (let k = 1; k < r.shown.length; k++) {
      const prev = r.shown[k - 1], gap = r.shown[k].at - (prev.at + prev.secs * 1000);
      assert.ok(gap >= 0 && gap <= 20, `${prev.text} stood its ${prev.secs.toFixed(2)} s (next ${gap} ms after)`);
    }
  }
  assert.equal(readout, 'The Hour collapses in 3:00. The way home opens where the Remnant fell.', 'it OPENS where it fell (it said "stands" before it rose), no dash aside');
  const e = voice();
  e.v.say(SD_FIGHT_TEXT.echoFell('Mara', 0));
  e.set(250); e.v.say(SD_FIGHT_TEXT.lastMoment);
  e.across(6000);
  assert.deepEqual(e.shown.map((x) => x.text), ['Mara fells the Gold Echo.', SD_FIGHT_TEXT.lastMoment]);
  assert.ok(e.shown[1].at >= 1500 && e.shown[1].at <= 1520, `the fall stands its 1.5 s, then the Last Moment (${e.shown[1].at} ms - it stood 250)`);
});

test('SD11d THE HOSTS SAY THROUGH THE VOICE, from the world host\'s own text: its one voice on the label\'s door at each line\'s length; the readouts a readout, the floor\'s words a note, the fight\'s a turn with its thread; the Hall\'s and the Rift\'s through the mode machine\'s door; a frame of the voice each frame of the arc; what waits let go as the Hour is left, once (mutants: the readouts a turn; the voice unframed; the leave never letting go; the hall around it)', () => {
  assert.match(W, /const sdVoice = createSdVoice\(\{ show: \(t, secs\) => setMidScreenText\(t, secs\), now: \(\) => performance\.now\(\) \}\);/);
  assert.match(W, /const sdSay = \(t, rank = SD_VOICE_RANK\.turn, key = null\) => \{ sdVoice\.say\(t, rank, key\); return true; \};/);
  assert.match(W, /warn: \(text\) => sdSay\(text, SD_VOICE_RANK\.readout\),/, 'the collapse\'s and the fade\'s readouts');
  assert.match(W, /const sdSpoilsBurst = sdFightLink \? createSdSpoils\(\{[\s\S]{0,700}?say: \(t\) => sdSay\(t, SD_VOICE_RANK\.note\),/, 'the floor\'s word');
  assert.match(W, /const sdFrame = \(\) => \{[^\n]*sdFightFrame\(\); sdVoiceFrame\(\); \};/, 'framed with the arc');
  assert.match(W, /sdSay: \(t, rank\) => sdSay\(t, rank\),/, 'handed to the mode machine');
  const WM = read('src/scenes/worldModes.js'), D = read('src/scenes/dungeonContext.js');
  assert.match(WM, /sdSay: \(t, rank\) => host\.sdSay\?\.\(t, rank\) \?\? false,/);
  assert.match(D, /say: \(t\) => \{ if \(!opts\.sdSay\?\.\(t\)\) setMidScreenText\(t\); \}/, 'the hall\'s lines, the label\'s own where no voice answers');
  assert.match(D, /if \(!opts\.sdSay\?\.\(word \?\? SD_NO_RIFT\)\) setMidScreenText\(word \?\? SD_NO_RIFT\);/, 'the Rift\'s word');
  // the voice's frame, run from its own text: in the Hour it frames; leaving lets go what waits, once
  const log = [];
  let slot = 3;
  const frame = new Function('modes', 'sdVoice', `let _sdVoiceIn = false;\n${constOf('sdVoiceFrame')}\nreturn sdVoiceFrame;`)({ sdRealmSlot: () => slot }, { leave: () => log.push('leave'), frame: () => log.push('frame') });
  frame(); frame();
  assert.deepEqual(log, ['frame', 'frame'], 'in the Hour: framed');
  slot = null; frame(); frame();
  assert.deepEqual(log, ['frame', 'frame', 'leave', 'frame', 'frame'], 'out: let go once');   // AUDIT SD III (H5, PIN MOVED): what waits for the Hour let go - its turns still said (scenes/sdVoice.js leave)
});

// ── the bar (L6 F1, F6, F10) ───────────────────────────────────────────

const NOW = T0 + 10 * M;
const fight = (o = {}) => ({ fi: 1, ph: 1, h: 900, m: 1000, op: 0, ou: 0, su: 0, rem: { atk: null }, ec: null, cx: null, clk: null, ends: NOW + 10 * M, ended: null, n: 3, rk: 0, fell: null, lost: null, ...o });
const atk = (A, at, i = 7) => ({ i, a: A.id, at, x: 0, z: 0, yw: 0, tg: [] });

test('SD11d THE BAR\'S ONE CALLOUT, BY WHAT CAN BE DONE ABOUT IT (L6 F1): the Reset\'s Hearts and its seconds over the Pulse winding up (the Pulse took the callout in 38% of Resets); a body\'s blow winding up over the Pulse (92 of 1,373 Stomps were never named); the Pulse once the blow has landed; the stun under the Pulse (mutants: the Pulse first again; a landed blow over the Pulse)', () => {
  const pulse = atk(SD_BLOWS.pulse, NOW + 1000, 8);
  const hearts = { i: 7, m: 500, c: [[0, 10, 500], [10, 0, 0], [0, -10, 500], [-10, 0, 0], [7, 7, 500]] };
  const reset = remnantBarModel(fight({ ph: 3, rem: { atk: atk(SD_BLOWS.reset, NOW + 5000) }, cx: hearts, clk: pulse }), NOW);
  assert.equal(reset.callout.text, SD_BAR_TEXT.reset(3, 5, 5), 'the Reset\'s countdown stands');
  const stomp = remnantBarModel(fight({ rem: { atk: atk(SD_BLOWS.stomp, NOW + 900) }, clk: pulse }), NOW);
  assert.equal(stomp.callout.text, SD_BLOWS.stomp.name, 'the Stomp winding up is named');
  const landed = remnantBarModel(fight({ rem: { atk: atk(SD_BLOWS.hand, NOW - 500) }, clk: pulse }), NOW);
  assert.equal(landed.callout.text, SD_BLOWS.pulse.name, 'a blow landed and sweeping: the Pulse winding up is the one to name');
  const stun = remnantBarModel(fight({ ph: 3, su: NOW + 6000, clk: pulse }), NOW);
  assert.equal(stun.callout.text, SD_BLOWS.pulse.name);
  assert.equal(remnantBarModel(fight({ ph: 3, su: NOW + 6000 }), NOW).callout.text, SD_BAR_TEXT.stunned(6), 'the stun alone');
});

test('SD11d THE ECHO\'S CLOCK AND THE RETURN (L6 F6, F10): a fallen Echo counts to its rising - the callout "Gold rises in 12s", its chip the same, pulsing its last five seconds (it said "fallen" and no time); "Outside time" while both stand; for the Last Moment\'s 2.5 s return "It returns - Ns" (it said "strike the Echoes" with none there); the gate bar pulses the host\'s chip as it does the Wrath\'s (mutants: no clock; no pulse; the return outside time)', () => {
  const ec = (dn) => [{ h: 0, m: 5000, up: 0, dn, atk: null, x: 0, z: 0 }, { h: 2250, m: 5000, up: 0, dn: 0, atk: null, x: 0, z: 0 }];
  const a = remnantBarModel(fight({ ph: 2, ec: ec(NOW - 3000) }), NOW);
  assert.equal(a.callout.text, SD_BAR_TEXT.rises(0, 12));
  assert.equal(a.callout.text, 'Gold rises - 12s');   // AUDIT SD III (T5, PIN MOVED): its count after the dash, as every countdown the bar calls - the callout came in afresh each second
  assert.equal(a.host, 'Gold rises in 12s - Silver 45%');
  assert.equal(a.hostNear, false);
  const b = remnantBarModel(fight({ ph: 2, ec: ec(NOW - SD_ECHO_PAIR_MS + SD_ECHO_RISE_NEAR_MS - 1) }), NOW);
  assert.equal(b.hostNear, true, 'its last five seconds');
  const both = remnantBarModel(fight({ ph: 2, ec: [{ h: 4000, m: 5000, up: 0, dn: 0, atk: null, x: 0, z: 0 }, { h: 2250, m: 5000, up: 0, dn: 0, atk: null, x: 0, z: 0 }] }), NOW);
  assert.equal(both.callout.text, SD_BAR_TEXT.outside);
  assert.equal(both.host, 'Gold 80% - Silver 45%');
  const back = remnantBarModel(fight({ ph: 3, ou: NOW + 2400 }), NOW);
  assert.equal(back.callout.text, 'It returns - 3s', 'the Remnant rising, the Echoes gone');
  const bar = read('src/ui/gateBossBar.js');
  assert.match(bar, /const hostNear = !!model\.host && !!model\.hostNear && !model\.fallen;/);
  assert.match(bar, /parts\.tags\[1\]\.className = hostNear \? 'wb-boss-tag wb-boss-host near' : 'wb-boss-tag wb-boss-host';/);
  assert.match(bar, /\.wb-boss-host\.near \{[^}]*animation: wb-wrath-near/);
  assert.match(bar, /\.wb-boss-bar\.brass \.wb-boss-host\.near \{ animation-name: wb-brass-near; \}/, 'in the Hour\'s brass');
});

// ── the Hearts (L6 F7) ────────────────────────────────────────────────

/** A fight heard by a real link on a clock the test turns, the arena's blows over it, every sound and line. */
function hearts() {
  let clock = T0 + 20_000;
  const said = [];
  const L = createSdFightLink({ now: () => clock, say: (t, key) => said.push([t, key ?? null]) });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  const sounds = [], lines = [];
  const B = createSdRemnantBlows({
    link: L, audio: { play3d: (clip, p, vol, o) => sounds.push({ clip, p, pitch: o.pitch }) },
    feet: () => arenaToDungeon(0, -6), grounded: () => true, player: () => ({ health: 200, maxHealth: 200 }),
    say: (t, everyone, key) => lines.push([t, key ?? null]),
  });
  return { L, B, said, sounds, lines, word: (w) => { const v = validSdOut(w); assert.ok(v, `${w.k} valid`); L.word(v); }, to: (t) => { clock = t; B.frame(); }, now: () => clock };
}
const SPOTS = [[0, 10], [10, 0], [0, -10], [-10, 0], [7, 7]];
const at = (q) => realmToDungeon(SD_ARENA.x + q[0], 1.2, SD_ARENA.z + q[1]);

test('SD11d THE HEARTS HEARD AND SAID (L6 F7): the Reset\'s call counts its Hearts, on their thread; each Heart rises with the gate\'s crystal\'s rise where it stands (heard live alone), takes a blow with its hit, breaks with its shatter and the ring after - the last too, broken in the stun\'s own word; each broken said by whom and how many stand, on their thread, the last its own words, then the stun\'s order; they rose, took blows and broke in silence (mutants: no count; no rise; a stale rise; no hit; no break; the last unheard; no line; the line off its thread)', () => {
  const r = hearts();
  const A0 = r.now() + SD_BLOWS.reset.windup - 1000, I = 9;   // called a second ago - heard live
  r.word({ k: 'atk', b: SD_BODY.remnant, i: I, a: SD_BLOWS.reset.id, at: A0, x: 0, z: 0, yw: 0, tg: [] });
  r.word({ k: 'cx', i: I, m: 500, c: SPOTS });
  r.to(r.now() + 16);
  assert.deepEqual(r.lines, [[SD_BLOWS_TEXT.reset(5), SD_HEARTS_KEY]], 'the call, its count, its thread');
  assert.equal(SD_BLOWS_TEXT.reset(5), 'The Reset! Break all 5 Hearts!');
  const rise = r.sounds.filter((x) => x.clip === BOSS_CUES.crystalRise.clip && x.pitch === BOSS_CUES.crystalRise.pitch);
  assert.deepEqual(rise.map((x) => x.p), SPOTS.map(at), 'each rising where it stands');
  r.sounds.length = 0;
  r.word({ k: 'cxh', i: I, h: [300, 500, 500, 500, 500] });
  r.to(r.now() + 16);
  assert.deepEqual(r.sounds.map((x) => [x.clip, x.pitch, x.p]), [[BOSS_CUES.crystalHit.clip, BOSS_CUES.crystalHit.pitch, at(SPOTS[0])]], 'a blow on one: its hit, there');
  r.sounds.length = 0;
  for (let k = 0; k < 4; k++) r.word({ k: 'cxb', i: I, c: k, n: ['Ann', 'Bran', 'Cara', 'Dov'][k], at: r.now() });
  r.to(r.now() + 16);
  const brk = (q) => [[BOSS_CUES.crystalBreak.clip, BOSS_CUES.crystalBreak.pitch, at(q)], [BOSS_CUES.crystalRing.clip, BOSS_CUES.crystalRing.pitch, at(q)]];
  assert.deepEqual(r.sounds.map((x) => [x.clip, x.pitch, x.p]), [0, 1, 2, 3].flatMap((k) => brk(SPOTS[k])), 'each broken: its shatter, its ring');
  assert.deepEqual(r.said.slice(-4), [['Ann breaks a Heart. 4 remain.', SD_HEARTS_KEY], ['Bran breaks a Heart. 3 remain.', SD_HEARTS_KEY], ['Cara breaks a Heart. 2 remain.', SD_HEARTS_KEY], ['Dov breaks a Heart. 1 remains.', SD_HEARTS_KEY]]);
  const n = r.said.length;
  r.word({ k: 'cxb', i: I, c: 0, n: 'Ann', at: r.now() });   // a Heart already broken, said again by the realm
  assert.equal(r.said.length, n, 'a broken Heart is said once');
  // the last Heart and the stun, one fan
  r.sounds.length = 0;
  r.word({ k: 'cxb', i: I, c: 4, n: 'Ann', at: r.now() });
  r.word({ k: 'stun', until: r.now() + 8000, at: r.now() });
  r.to(r.now() + 16);
  assert.deepEqual(r.sounds.map((x) => [x.clip, x.pitch, x.p]), brk(SPOTS[4]), 'the last broken in the stun\'s own word, heard');
  assert.deepEqual(r.said.slice(-2), [['Ann breaks the last Heart!', SD_HEARTS_KEY], [SD_FIGHT_TEXT.stunned, null]], 'the last, then the stun\'s order off the thread (it waits its turn)');
  // the stun's word heard after the stun ran out (a hidden tab): no shatter, so late
  const gone = hearts();
  const A3 = gone.now() + SD_BLOWS.reset.windup - 1000;
  gone.word({ k: 'atk', b: SD_BODY.remnant, i: I, a: SD_BLOWS.reset.id, at: A3, x: 0, z: 0, yw: 0, tg: [] });
  gone.word({ k: 'cx', i: I, m: 500, c: SPOTS });
  gone.to(gone.now() + 16);
  gone.sounds.length = 0;
  gone.word({ k: 'stun', until: gone.now() + 8000, at: gone.now() });
  gone.to(gone.now() + 9000);
  assert.equal(gone.sounds.filter((x) => x.clip === BOSS_CUES.crystalBreak.clip).length, 0, 'the stun over before this screen looked: nothing shatters late');
  // a Reset first heard late (a hello mid-wind-up): no rise
  const late = hearts();
  const A1 = late.now() + SD_BLOWS.reset.windup - SD_HEART_LATE_MS - 500;
  late.word({ k: 'atk', b: SD_BODY.remnant, i: I, a: SD_BLOWS.reset.id, at: A1, x: 0, z: 0, yw: 0, tg: [] });
  late.word({ k: 'cx', i: I, m: 500, c: SPOTS });
  late.to(late.now() + 16);
  assert.equal(late.sounds.filter((x) => x.clip === BOSS_CUES.crystalRise.clip && x.pitch === BOSS_CUES.crystalRise.pitch).length, 0, 'stale: not heard rising');
  // a Reset that LANDS takes its Hearts with no stun: nothing shatters
  const land = hearts();
  const A2 = land.now() + 1000;
  land.word({ k: 'atk', b: SD_BODY.remnant, i: I, a: SD_BLOWS.reset.id, at: A2, x: 0, z: 0, yw: 0, tg: [] });
  land.word({ k: 'cx', i: I, m: 500, c: SPOTS });
  land.to(land.now() + 16);
  land.sounds.length = 0;
  for (let t = A2; t <= A2 + 3000; t += 100) land.to(t);
  assert.equal(land.sounds.filter((x) => x.clip === BOSS_CUES.crystalBreak.clip).length, 0, 'a landed Reset breaks no Heart');
});

test('SD11d FIVE HEARTS IN A SECOND, READ AS THEY FALL: through the voice each count takes the last one\'s place, and the stun\'s "Strike now!" stands as soon as the last Heart\'s line has stood - well inside the stun (queued, five counts stood 8.6 s and the order came as the stun ran out) (mutants: the Hearts off their thread)', () => {
  const r = voice();
  const link = createSdFightLink({ now: () => T0 + 20_000, say: (t, key) => r.v.say(t, SD_VOICE_RANK.turn, key) });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  link.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  link.word(validSdOut({ k: 'cx', i: 9, m: 500, c: SPOTS }));
  for (let k = 0; k < 5; k++) { r.set(k * 300); link.word(validSdOut({ k: 'cxb', i: 9, c: k, n: 'Ann', at: T0 })); }
  link.word(validSdOut({ k: 'stun', until: T0 + 28_000, at: T0 + 20_000 }));
  r.across(10_000);
  const strike = r.shown.find((x) => x.text === SD_FIGHT_TEXT.stunned);
  assert.ok(strike, 'the order said');
  assert.ok(strike.at <= 1200 + courtSaySeconds('Ann breaks the last Heart!') * 1000 + 20, `"Strike now!" at ${strike.at} ms`);
  assert.deepEqual(r.shown.map((x) => x.text), ['Ann breaks a Heart. 4 remain.', 'Ann breaks a Heart. 3 remain.', 'Ann breaks a Heart. 2 remain.', 'Ann breaks a Heart. 1 remains.', 'Ann breaks the last Heart!', SD_FIGHT_TEXT.stunned]);
});

// ── the fade (L6 F5) ──────────────────────────────────────────────────

const LT = LOCATION_TYPES;
const place = (region, index, px, py, type, { name = `P${region}.${index}`, w = 1, h = 1, buildings = 0, blocks = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: blocks > 0,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
  ...(blocks ? { dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `${i % 3 ? 'N' : 'B'}0000${i}.RDB`, x: i, z: 0, isStartingBlock: !i })), recordElement: { header: { locationId: py * 1000 + px } } } } : {}),
});
function world(places) {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  for (const p of places) { regions[p.regionIndex].mapTable[p.locationIndex] = { mapId: p.mapTableData.mapId, locationType: p.mapTableData.locationType }; regions[p.regionIndex].mapNames[p.locationIndex] = p.name; }
  return { regionCount: 2, getRegion: (r) => regions[r], getClimateIndex: (x) => (x < 100 ? CLIMATES.Ocean : 231), getPoliticIndex: (x) => (x < 100 ? 0 : 128 + (x < 500 ? 0 : 1)), getRegionIndexAt: (x) => (x < 500 ? 0 : 1) };
}
const CITY = place(0, 0, 300, 200, LT.TownCity, { name: 'Copperham', w: 3, h: 3, buildings: 80 });
const LAB = place(0, 1, 450, 400, LT.DungeonLabyrinth, { name: 'The Old Maze', blocks: 14 });
const SCAN = scanGatePixels(world([CITY, LAB]), { heightAt: () => 90 });
function host() {
  const s = { clock: T0, index: new Map(), inside: false, hour: false, warned: [] };
  const h = createSdHost({
    now: () => s.clock, scan: () => SCAN, cities: (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' }), templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }), stand: (key, loc) => s.index.set(key, loc), unstand: (key) => s.index.delete(key),
    inside: () => s.inside, door: () => null, feet: () => null, sendFound: () => true, say: () => {}, castOut: () => true, warn: (t) => s.warned.push(t), inHour: () => s.hour,
  });
  return { s, h };
}

test('SD11d THE FADE COUNTED (L6 F5): a Hollow unbeaten closes at its `until` and casts out whoever stands in it or its Hour, mid-blow - whoever stands there is told as it nears, at five minutes, one, thirty seconds and ten, each once (the first with what is left whenever they are first inside), in the Hour\'s words or the Hollow\'s; never to one outside, never past it, never for a Hollow fallen (its collapse counts) (mutants: no readout; every frame; outside told; a fallen Hollow counted twice)', () => {
  assert.deepEqual([...SD_FADE_WARN_MS], [300_000, 60_000, 30_000, 10_000]);
  assert.equal(sdFadeDue(300_000), 300_000);
  assert.equal(sdFadeDue(300_001), null, 'not before its first mark');
  assert.equal(sdFadeDue(200_000), 300_000, 'first inside at 3:20: the first mark, with what is left');
  assert.equal(sdFadeDue(200_000, 300_000), null);
  assert.equal(sdFadeDue(60_000, 300_000), 60_000);
  assert.equal(sdFadeDue(9000, 30_000), 10_000, 'a frame late: the mark reached, once');
  assert.equal(sdFadeDue(0), null);
  assert.equal(sdFadeReadout(60_000, { hour: true }), 'The Hour closes in 1:00.');
  assert.equal(sdFadeReadout(30_000), 'The Abyss Dungeon fades in 0:30.');   // AUDIT SD III (T15, PIN MOVED): the player's word for it, and the word its banner, ring and Timers say of its end
  const x = host();
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  x.h.heard({ k: 'ev', ...r }); x.h.frame();
  const f = sdFind(r, T0, 'Mara');
  x.h.heard({ k: 'ev', ...f }); x.h.frame();
  x.s.inside = true;
  x.s.clock = f.until - 5 * M; x.h.frame(); x.h.frame();
  assert.deepEqual(x.s.warned, ['The Abyss Dungeon fades in 5:00.'], 'once at its mark');
  x.s.clock = f.until - 2 * M; x.h.frame();
  assert.equal(x.s.warned.length, 1, 'nothing between the marks');
  x.s.hour = true;
  x.s.clock = f.until - M; x.h.frame();
  x.s.clock = f.until - 30_000; x.h.frame();
  x.s.clock = f.until - 10_000; x.h.frame();
  assert.deepEqual(x.s.warned.slice(1), ['The Hour closes in 1:00.', 'The Hour closes in 0:30.', 'The Hour closes in 0:10.'], 'in the Hour, its words');
  // outside, nothing
  const o = host();
  o.h.heard({ k: 'ev', ...r }); o.h.frame(); o.h.heard({ k: 'ev', ...f }); o.h.frame();
  o.s.clock = f.until - M; o.h.frame();
  assert.deepEqual(o.s.warned, [], 'outside: never told');
  // a fallen Hollow: the collapse's readouts alone
  const k = host();
  k.h.heard({ k: 'ev', ...r }); k.h.frame(); k.h.heard({ k: 'ev', ...f }); k.h.frame();
  k.s.inside = true;
  const fl = sdFell(f, f.until - 2 * M, { top: 'Mara', n: 2 });   // fallen inside the fade's last five minutes
  k.s.clock = fl.fellAt; k.h.heard({ k: 'ev', ...fl }); k.h.frame();
  k.s.clock = fl.fellAt + 30_000; k.h.frame();
  assert.deepEqual(k.s.warned, [sdCollapseLine(SD_COLLAPSE_MS, { first: true })], 'the collapse\'s first, no fade');
});

// ── near the arena (L6 F15) ───────────────────────────────────────────

test('SD11d THE FIGHT\'S LINES NEAR ITS ARENA (L6 F15), run from the world host\'s own text: the fight\'s turns and its blows\' lines are said to whoever stands where its bar stands - in the Hour, within the bar\'s reach of the arena - and its fall to the whole Hour; a body on the Steps heard the Dragon Break and the End, which never touch it (mutants: said everywhere; the fall held to the arena; the thread dropped)', () => {
  const said = [];
  let slot = 3, pos = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z - SD_ARENA.r - 5);
  const env = { modes: { sdRealmSlot: () => slot }, sdDungeonToRealm: (x, y, z) => [x - realmToDungeon(0, 0, 0)[0], y - realmToDungeon(0, 0, 0)[1], z - realmToDungeon(0, 0, 0)[2]], player: { get pos() { return pos; } }, sdBarNear };
  const near = new Function(...Object.keys(env), `${constOf('sdNearArena')}\nreturn sdNearArena;`)(...Object.values(env));
  assert.equal(near(), true, 'at the arena\'s edge');
  const linkSay = /createSdFightLink\(\{ now: \(\) => Date\.now\(\) \+ _sharedOffsetMs, say: (\(t, key\) => \{ if \(sdNearArena\(\)\) sdSay\(t, SD_VOICE_RANK\.turn, key\); \}) \}\)/.exec(W)?.[1];
  const blowsSay = /\n {4}say: (\(t, everyone = false, key = null\) => \{ if \(everyone \|\| sdNearArena\(\)\) sdSay\(t, SD_VOICE_RANK\.turn, key\); \}),/.exec(W)?.[1];
  assert.ok(linkSay && blowsSay, 'the two doors');
  const e2 = { sdNearArena: near, sdSay: (t, rank, key) => said.push([t, rank, key]), SD_VOICE_RANK };
  const L = evalIn(linkSay, e2), B = evalIn(blowsSay, e2);
  const db = SD_FIGHT_TEXT.dragonBreak(SD_ECHO_PAIR_MS);   // AUDIT SD III (T14, PIN MOVED): its window in its words
  L(db); B(SD_BLOWS_TEXT.reset(5), false, SD_HEARTS_KEY);
  assert.deepEqual(said, [[db, 0, undefined], [SD_BLOWS_TEXT.reset(5), 0, SD_HEARTS_KEY]]);
  pos = realmToDungeon(0, 4.6, 190);   // the Crumble
  assert.equal(near(), false, 'on the Steps');
  L(db); B(SD_BLOWS_TEXT.end);
  assert.equal(said.length, 2, 'not heard on the Steps');
  B(SD_BLOWS_TEXT.fell, true);
  assert.deepEqual(said[2], [SD_BLOWS_TEXT.fell, 0, null], 'its fall: to the whole Hour');
  slot = null; pos = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z);
  assert.equal(near(), false, 'out of the Hour: no arena');
  assert.match(read('src/scenes/sdRemnantBlows.js'), /say\(SD_BLOWS_TEXT\.fell, true\);/, 'the fall says itself to everyone');
});

// ── the veil (L6 F8) ──────────────────────────────────────────────────

function fakePage() {
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, COLOR_BUFFER_BIT: 5, VERTEX_SHADER: 6, FRAGMENT_SHADER: 7 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const doc = { body: { appendChild: (c) => { c.inPage = true; } }, createElement: (tag) => ({ tag, style: {}, width: 0, height: 0, setAttribute() {}, remove() {}, getContext: () => gl }) };
  let frames = [], t = 1000;
  const sounds = [];
  const engine = { soundIndexForId: (id) => (id === FIRE_CAST_ID ? 77 : -1), playOneShot: (...a) => sounds.push(a) };
  const step = (ms = 16) => { t += ms; const f = frames; frames = []; for (const g of f) g(); };
  return { doc, raf: (f) => frames.push(f), now: () => t, engine, win: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 }, calls, sounds, step };
}
const themes = (p) => [...new Set(p.calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uTheme').map((c) => c[2]))];

test('SD11d THE HOUR\'S OWN VEIL (L6 F8; Mac, of the Hour: "not oblivion, something different"): every step into and out of the Hour was Dagon\'s fire and its roar - now the same whirl in brass, the Mantella\'s green its eye, closing on the Orrery\'s toll over the deep wind and opening on a gear\'s clunk and the Concord\'s chime; the fire\'s stays the default and the gate\'s; a step under way keeps its own look; every way through the Hour asks it (mutants: the brass never drawn; the fire\'s cues; a look changed mid-step; a way left in fire)', () => {
  const p = fakePage();
  const veil = createGateVeil(p);
  veil.cover('brass');
  assert.deepEqual(p.sounds, VEIL_BRASS_CUES.close.map((c) => [c.clip, c.volume, c.pitch]), 'the toll and the deep wind');
  for (let i = 0; i < 90; i++) p.step();
  assert.deepEqual(themes(p), [VEIL_THEMES.brass], 'drawn in brass');
  veil.cover('fire');   // asked again while it stands: the step keeps its own look
  p.sounds.length = 0;
  veil.reveal();
  for (let i = 0; i < VEIL_OPEN_WAIT_TICKS + 2; i++) p.step();
  assert.deepEqual(p.sounds.map((s) => s[0]), VEIL_BRASS_CUES.open.map((c) => c.clip), 'the clunk and the chime');
  for (let i = 0; i < 120 && veil.phase !== 'idle'; i++) p.step();
  // the next step, the fire's
  p.sounds.length = 0; p.calls.length = 0;
  veil.cover();
  assert.deepEqual(p.sounds, [[77, VEIL_CUES.close[0].volume, VEIL_CUES.close[0].pitch], [VEIL_CUES.close[1].clip, VEIL_CUES.close[1].volume, VEIL_CUES.close[1].pitch]], 'the fire\'s, as ever');
  for (let i = 0; i < 10; i++) p.step();
  assert.deepEqual(themes(p), [VEIL_THEMES.fire]);
  // a flash takes its look at once
  const q = fakePage();
  const v2 = createGateVeil(q);
  v2.flash('brass'); q.step();
  assert.deepEqual(themes(q), [VEIL_THEMES.brass]);
  // its sounds are the Orrery's own
  assert.deepEqual([VEIL_BRASS_CUES.close[0].clip, VEIL_BRASS_CUES.close[1].clip, VEIL_BRASS_CUES.open[0].clip, VEIL_BRASS_CUES.open[1].clip], [SD_HALL_SOUNDS.toll, SOUND.AmbientWindMoanDeep, SD_HALL_SOUNDS.clunk, SD_HALL_SOUNDS.chime]);
  // the shader: one uniform, the fire's palette where it is 0
  assert.match(GATE_VEIL_FS, /uniform float uTheme;/);
  assert.match(GATE_VEIL_FS, /float th = clamp\(uTheme, 0\.0, 1\.0\);/);
  for (const fire of ['vec3(0.98, 0.3, 0.03)', 'vec3(1.0, 0.72, 0.34)', 'vec3(1.0, 0.84, 0.56)', 'vec3(1.0, 0.76, 0.38)']) assert.ok(GATE_VEIL_FS.includes(`mix(${fire}, `), `the fire's ${fire} first, the brass mixed over it`);
  // every way through the Hour asks it
  const WM = read('src/scenes/worldModes.js');
  // PIN MOVED (SD-LOOK S5, Super-Dungeons-Look.md section 3): the Hour's own veil (render/sdVeil.js) - in through its
  // blades closing on the Rift, back in silver, home mended, forced out shattered; the brass whirl stays a theme
  assert.match(WM, /async function stepThroughFire\(go, look = 'fire', opts = undefined\) \{[\s\S]{0,200}if \(veil\) await veil\.cover\(look, opts\);/);
  assert.equal((W.match(/\}, 'hourIn'\);/g) ?? []).length, 1, 'the Rift\'s step in');
  assert.equal((W.match(/\}, 'hourBack'\);/g) ?? []).length, 1, 'the way back');
  assert.equal((W.match(/gateVeil\?\.flash\('hourCast'\)/g) ?? []).length, 3, 'a death, the cast-out, the Hour\'s eject');
  assert.equal((W.match(/gateVeil\?\.flash\('hourHome'\)/g) ?? []).length, 1, 'the way home');
  assert.match(W, /if \(hour\) gateVeil\?\.flash\('hourCast'\);[^\n]*\n\s*sdSay\(SD_CAST_OUT_LINE\);/, 'the cast-out from the Hour, never from the Hollow');
});

// ── the chart (L6 F11) ────────────────────────────────────────────────

test('SD11d THE CHART IN BRASS (L6 F11): the Remnant\'s damage chart heads its crystals\' column "Hearts" and wears the Hour\'s brass; the gate\'s keeps its words and fire; a look of junk is none (mutants: "Crystals" again; the brass dropped; the head ignored by the redraw\'s key)', () => {
  const fell = { dm: [{ n: 'Ann', l: 30, d: 900, x: 10, h: 5, b: 120, f: 0 }, { n: 'Bran', l: 28, d: 500, x: 6, h: 2, b: 90, f: 1 }], n: 2 };
  const when = { since: 0, now: DAMAGE_CHART_DELAY_MS + 500 };
  const gate = damageChartModel(fell, when);
  const hour = damageChartModel(fell, { ...when, boss: SD_BLOWS_TEXT.boss, crystals: SD_BLOWS_TEXT.hearts, theme: 'brass' });
  assert.equal(gate.head, DAMAGE_CHART_TEXT.head, 'the gate\'s, unchanged');
  assert.equal(gate.theme, null);
  assert.equal(hour.head[6], 'Hearts');
  assert.deepEqual(hour.head.filter((_, i) => i !== 6), DAMAGE_CHART_TEXT.head.filter((_, i) => i !== 6));
  assert.equal(hour.theme, 'brass');
  assert.notEqual(hour.key, gate.key, 'the head redraws');
  assert.equal(damageChartModel(fell, { ...when, theme: 'brass" onclick' }).theme, null);
  assert.match(DAMAGE_CHART_CSS, /\.wb-dmg-chart\.wb-dmg-brass \{/);
  assert.match(read('src/ui/gateDamageChart.js'), /\$\{model\.theme \? ` wb-dmg-\$\{model\.theme\}` : ''\}/);
  assert.match(read('src/scenes/sdRemnantBlows.js'), /damageChartModel\(chartFell, \{ boss: SD_BLOWS_TEXT\.boss, me: me\(\), since: chartAt, now: t, crystals: SD_BLOWS_TEXT\.hearts, theme: 'brass' \}\)/);
});

// ── the words (L6 F20, F21) ────────────────────────────────────────────

test('SD11d A HOLLOW\'S NAME SMALL MID-SENTENCE (L6 F20): "broke the Hour in the Brass Hollow", "The Hour closes over the Stopped Bell", "To the Brass Hollow" - the arc\'s names all begin "The" (it read "in The Brass Hollow"); another dungeon\'s plaque is its own (mutants: the article kept; every plaque\'s small)', () => {
  assert.equal(sdNameIn('The Brass Hollow'), 'the Brass Hollow');
  assert.equal(sdNameIn('an Abyss Dungeon'), 'an Abyss Dungeon');
  assert.equal(sdNameIn(null), '');
  assert.equal(sdFellLine({ top: 'Mara', n: 3, name: 'The Brass Hollow' }), 'Mara and 2 others broke the Hour in the Brass Hollow. It collapses.');
  assert.equal(sdFadeLine({ name: 'The Stopped Bell' }), 'The Hour closes over the Stopped Bell, unbroken.');
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'The Brass Hollow', tier: 'super', size: 'Large' }), { title: 'Abyss Dungeon', subs: ['To the Brass Hollow', 'Large'] });
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'The Old Maze', tier: 'elite', size: 'Small' }), { title: 'Elite Dungeon', subs: ['To The Old Maze', 'Small'] }, 'the mod\'s own, as DFU writes it');
});

/** Every line the arc says - over the screen, in the chat, on its plaques. */
function arcLines() {
  const out = [];
  const add = (w, v) => { if (typeof v === 'string') out.push([w, v]); };
  const walk = (pre, o) => { for (const [k, v] of Object.entries(o)) { if (typeof v === 'string') add(`${pre}.${k}`, v); else if (typeof v === 'function') add(`${pre}.${k}`, v('Mara', 2)); else if (v && typeof v === 'object') walk(`${pre}.${k}`, v); } };
  walk('fight', SD_FIGHT_TEXT); walk('blows', SD_BLOWS_TEXT); walk('hall', SD_HALL_TEXT); walk('steps', SD_STEPS_TEXT);
  walk('realm', SD_REALM_TEXT); walk('home', SD_HOME_TEXT); walk('spoils', SD_SPOILS_TEXT); walk('bar', SD_BAR_TEXT);
  add('blows.reset0', SD_BLOWS_TEXT.reset(0)); add('heart.last', SD_FIGHT_TEXT.heartBroken('Ann', 0)); add('heart.one', SD_FIGHT_TEXT.heartBroken('Ann', 1));
  for (const [k, v] of Object.entries({ SD_CAST_OUT_LINE, SD_NO_CLOSED, SD_NO_FULL, SD_NO_RIFT })) add(k, v);
  add('found', sdFoundLine({ who: 'Mara', near: 'Copperham' })); add('fell', sdFellLine({ top: 'Mara', n: 3, name: 'The Brass Hollow' })); add('fade', sdFadeLine({ name: 'The Brass Hollow' }));
  for (const hour of [true, false]) for (const first of [true, false]) add(`collapse.${hour}.${first}`, sdCollapseLine(SD_COLLAPSE_MS, { hour, first }));
  add('fadeR', sdFadeReadout(60_000, { hour: true }));
  add('fight.dragonBreak.15', SD_FIGHT_TEXT.dragonBreak(SD_ECHO_PAIR_MS)); add('fight.dragonBreak.10', SD_FIGHT_TEXT.dragonBreak(10_000));   // AUDIT SD III (T14): its window's words, read
  return out;
}

test('SD11d WB13B\'S WORDS OVER THE ARC (L6 F21): no dash aside in a line (" - " stands between a label and its value on the bar alone), no colon gloss, no "X, not Y", no shouted name; the event, then what to do - the Dragon Break\'s order, the Reset\'s count, the stun\'s order, the Concord\'s bridge, the collapse\'s first word (mutants: each old line back)', () => {
  const all = arcLines();
  assert.ok(all.length > 60, `${all.length} lines read`);
  const bad = [];
  for (const [where, s] of all) {
    if (where.startsWith('bar.')) continue;   // the bar's label - value
    if (/\S - \S/.test(s)) bad.push(`${where}: a dash aside - ${s}`);
    if (/[a-z]: [a-z]/i.test(s.replace(/\b\d{1,2}:\d{2}\b/g, ''))) bad.push(`${where}: a colon gloss - ${s}`);
    if (/, not \w/.test(s)) bad.push(`${where}: "X, not Y" - ${s}`);
    if (/\b[A-Z]{3,}\b/.test(s)) bad.push(`${where}: shouted - ${s}`);
  }
  assert.deepEqual(bad, []);
  assert.equal(SD_FIGHT_TEXT.dragonBreak(SD_ECHO_PAIR_MS), 'The Dragon Break! Fell Gold and Silver within 15 seconds of each other.');   // AUDIT SD III (T14, PIN MOVED): the window said, by the fight's own - "together" said none
  assert.equal(SD_FIGHT_TEXT.stunned, 'The Reset breaks! Strike now!');
  assert.equal(SD_BLOWS_TEXT.reset(5), 'The Reset! Break all 5 Hearts!');
  assert.equal(SD_HALL_TEXT.concord, 'The Concord! A bridge of light opens.');
  assert.equal(sdCollapseLine(SD_COLLAPSE_MS, { first: true }), 'The Hour is broken. The Abyss Dungeon collapses in 3:00.');   // AUDIT SD III (T15, PIN MOVED): the player's word for it, Abyss Dungeon
});

// ── the sounds and the shaders (L6 F23; the veil's and the telegraphs' pows) ──

test('SD11d THE END\'S WIND-UP ITS OWN PITCH (L6 F23, WB13d\'s law): wind-up cues on the same clip stand at least four semitones apart - the End under the Reset (they were 3.2 apart); and no pow of a negative in the veil\'s or the telegraphs\' shaders, which draw the Hour\'s steps and the Remnant\'s blows (undefined in GLSL ES, NaN on D3D - the veil\'s throat, the telegraph\'s lip and wave) (mutants: the End at 0.25; the throat a pow)', () => {
  const byClip = new Map();
  for (const [k, c] of Object.entries(SD_BLOW_CUES.windup)) (byClip.get(c.clip) ?? byClip.set(c.clip, []).get(c.clip)).push([k, c.pitch]);
  for (const [clip, cues] of byClip) {
    for (let i = 0; i < cues.length; i++) for (let j = i + 1; j < cues.length; j++) {
      const st = Math.abs(12 * Math.log2(cues[i][1] / cues[j][1]));
      assert.ok(st >= 4, `${cues[i][0]} and ${cues[j][0]} on clip ${clip}: ${st.toFixed(2)} semitones`);
    }
  }
  assert.equal(SD_BLOW_CUES.windup.end.pitch, 0.236);
  assert.doesNotMatch(GATE_VEIL_FS, /\bpow\(/, 'the veil takes no pow');
  assert.doesNotMatch(TELEGRAPH_FS, /\bpow\(/, 'the telegraphs take no pow');
  assert.match(GATE_VEIL_FS, /exp\(-\(r - 0\.3\) \* \(r - 0\.3\) \* 30\.25\)/, 'the throat squared - 5.5 squared');
});
