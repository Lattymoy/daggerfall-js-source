// SD15 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD15;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE ARENA READ (scenes/sdArenaRead.js, ui/sdTitleCard.js)
// - "in it", as the gate's WB13a: a blow of the Remnant's or an Echo's still to land on my feet (the Stomp's disc, the
// Hand's sweep unshaded by a pillar, a Volley's mark), the soonest, with the nearest way out as the screen turns it; the
// Stomp's ring rolling out at me, "jump!"; the Hour's own blows over the whole floor none; the burning brass felt on the
// same rim. And the fight's beats on the Hour's own card in brass (the Warden's WB13e card burns in Dagon's red): its
// wake, the Dragon Break, the Last Moment, the last minute, its fall - each once, live alone.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sdPerilAt, sdWayOut, sdGroundModel, createSdBeats, SD_JUMP_CALL_M, SD_BEAT_TEXT, SD_BEAT_LATE_MS, SD_BEAT_LAST_MS, SD_BURNING_GROUND, SD_PERIL_RIM_M,
} from '../src/scenes/sdArenaRead.js';
import { drawSdTitleCard, destroySdTitleCard, SD_TITLE_CSS, SD_TITLE_BRASS } from '../src/ui/sdTitleCard.js';
import { titleCardModel, TITLE_CARD_CSS, TITLE_IN_MS, TITLE_HOLD_MS, TITLE_OUT_MS } from '../src/ui/gateTitleCard.js';
import { SD_BLOWS, SD_PILLARS, windupFor, SD_BODY, stompFrontAt } from '../src/net/sdRemnant.js';
import { SD_ARENA } from '../src/net/sdBrain.js';
import { SD_BLOW_COLOR, createSdRemnantBlows } from '../src/scenes/sdRemnantBlows.js';
import { realmToDungeon } from '../src/net/sdBrain.js';
import { GROUND_VIEW_TEXT } from '../src/ui/gateGroundView.js';
import { TELEGRAPH_NOW_MS } from '../src/render/gateTelegraph.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const T = 1_800_000_000_000;
const fight = (over = {}) => ({ fi: 4, ph: 1, op: T - 60_000, ends: T + 600_000, ended: 0, lost: 0, fell: null, rem: { x: 0, z: 0, yw: 0, atk: null }, ec: null, ...over });
const atk = (A, at, o = {}) => ({ i: 9, a: A.id, at, x: 0, z: 0, yw: 0, tg: [], ...o });

test('SD15 IN IT - THE STOMP: standing in its disc as it winds up, its name, its wind-up\'s share, its last moment, its colour and the way out - straight out of the disc, as the screen turns it; out of the disc, nothing; once it has landed, its ring rolling at me within SD_JUMP_CALL_M - "jump!", no arrow; the ring past me, nothing (mutants: the disc unread; no way out; the ring never called; the ring called after it passed)', () => {
  const A = SD_BLOWS.stomp, w = windupFor(A, 1, SD_BODY.remnant);
  const s = fight({ rem: { x: 0, z: 0, yw: 0, atk: atk(A, T + w / 2) } });
  const p = sdPerilAt(s, T, 0, 3, 0);
  assert.equal(p.name, A.name); assert.ok(Math.abs(p.t - 0.5) < 1e-9); assert.equal(p.now, false); assert.deepEqual(p.color, SD_BLOW_COLOR.stomp); assert.equal(p.jump, false);
  assert.ok(p.way && Math.abs(p.way.dir[0]) < 1e-9 && p.way.dir[1] > 0.99, 'straight out, away from its centre');
  assert.ok(Math.abs(p.way.m - (A.r - 3)) <= 0.26, `out at its rim (${p.way.m})`);
  assert.ok(Math.abs(p.arrow) < 1e-9, 'ahead, for a camera looking along +z');
  assert.ok(Math.abs(sdPerilAt(s, T, 0, 3, Math.PI / 2).arrow + 90) < 1e-6, 'to the left, for one looking along +x');
  assert.equal(sdPerilAt(s, T, 0, 3).arrow, null, 'no camera, no arrow');
  assert.equal(sdPerilAt(s, T + w / 2 - TELEGRAPH_NOW_MS / 2, 0, 3, 0).now, true, 'its last moment');
  assert.equal(sdPerilAt(s, T, 0, A.r + 0.5, 0), null, 'out of its disc');
  // landed: its ring
  const t1 = T + w / 2 + 200, front = stompFrontAt(s.rem.atk, t1);
  const j = sdPerilAt(s, t1, 0, front + SD_JUMP_CALL_M - 0.2, 0);
  assert.equal(j.jump, true); assert.equal(j.arrow, null); assert.equal(j.name, A.name);
  assert.equal(sdPerilAt(s, t1, 0, front + SD_JUMP_CALL_M + 0.5, 0), null, 'far ahead of it');
  assert.equal(sdPerilAt(s, t1, 0, front - 0.3, 0), null, 'passed me');
  assert.equal(sdGroundModel({ now: t1, peril: j }).warn, `${A.name} - jump!`);
});

test('SD15 IN IT - THE HAND AND THE VOLLEY, AND THE ECHOES\': in the Hand\'s sweep as it winds up, and while its beam is still to reach me; behind a pillar from it, nothing; its beam past me, nothing; a Volley\'s mark under me; an Echo\'s blow as its own; the soonest of two; the Hour\'s own blows over the whole floor never; a fallen, lost or ended fight, nothing (mutants: the shade ignored; the beam\'s past read; the Echoes unread; the latest of two; the Pulse "in it")', () => {
  const H = SD_BLOWS.hand, w = windupFor(H, 1, SD_BODY.remnant);
  const hand = atk(H, T + 500, { yw: 0, sw: 1 });
  const s = fight({ rem: { x: 0, z: 0, yw: 0, atk: hand } });
  assert.equal(sdPerilAt(s, T, 0, 10, 0)?.name, H.name, 'in its sweep');
  const [px, pz] = SD_PILLARS[0], shade = [px * 1.6, pz * 1.6];
  assert.equal(sdPerilAt(fight({ rem: { x: 0, z: 0, yw: Math.atan2(px, pz), atk: { ...hand, yw: Math.atan2(px, pz) } } }), T, shade[0], shade[1], 0), null, 'behind a pillar from it');
  // the beam swept past: from its start (-arc/2 from yw) toward +arc/2 - a body at its start is passed early
  const start = -H.arc / 2 + 0.05, at = [Math.sin(start) * 10, Math.cos(start) * 10];
  assert.ok(sdPerilAt(s, T + 600, at[0], at[1], 0), 'its beam still to reach me... ');
  assert.equal(sdPerilAt(s, T + 500 + H.active * 0.4, at[0], at[1], 0), null, '...and past me');
  assert.ok(T + 500 - w < T, 'in its wind-up');
  // a Volley's mark
  const V = SD_BLOWS.volley;
  const sv = fight({ rem: { x: 0, z: 0, yw: 0, atk: atk(V, T + 400, { tg: [[5, 5], [-8, 2]] }) } });
  assert.equal(sdPerilAt(sv, T, -8.5, 2.3, 0)?.name, V.name);
  assert.equal(sdPerilAt(sv, T, 0, -10, 0), null);
  // an Echo's, and the soonest of two
  const echo = { h: 50, m: 100, x: 5, z: 0, yw: 0, atk: atk(SD_BLOWS.stomp, T + 300, { i: 12, x: 5, z: 0 }) };
  const se = fight({ ph: 2, rem: { x: 0, z: 0, yw: 0, atk: atk(V, T + 900, { tg: [[5, 1]] }) }, ec: [echo, { h: 0, m: 100, x: -5, z: 0, atk: null }] });
  const pe = sdPerilAt(se, T, 5, 1, 0);
  assert.equal(pe.name, SD_BLOWS.stomp.name, 'the Echo\'s, landing first');
  assert.equal(sdPerilAt({ ...se, ec: [{ ...echo, h: 0 }, se.ec[1]] }, T, 5, 1, 0)?.name, V.name, 'a fallen Echo strikes nothing');
  // the Hour's own over the whole floor: never "in it"
  assert.equal(sdPerilAt(fight({ rem: { x: 0, z: 0, yw: 0, atk: atk(SD_BLOWS.pulse, T + 500) } }), T, 1, 1, 0), null);
  assert.equal(sdPerilAt(fight({ rem: { x: 0, z: 0, yw: 0, atk: atk(SD_BLOWS.end, T + 500) } }), T, 1, 1, 0), null);
  for (const over of [{ fell: { at: T } }, { lost: T }, { ended: T }]) assert.equal(sdPerilAt({ ...s, ...over }, T, 0, 10, 0), null);
  assert.equal(sdPerilAt(null, T, 0, 0, 0), null);
});

test('SD15 THE WAY OUT: over the arena\'s floor alone, kept SD_PERIL_RIM_M inside its rim; none in reach, none; the ground view in the Hour - the burning brass under my feet, a blow on them over it (mutants: a way out past the rim; the brass unfelt)', () => {
  const R = SD_ARENA.r - SD_PERIL_RIM_M;
  const out = sdWayOut((x, z) => Math.hypot(x - (R - 2), z) <= 3, R - 2, 0);
  const end = [R - 2 + out.dir[0] * out.m, out.dir[1] * out.m];
  assert.ok(Math.hypot(...end) <= R + 1e-9, 'never past the rim');
  assert.equal(sdWayOut(() => true, 0, 0), null, 'none in reach');
  assert.equal(sdWayOut((x, z) => Math.hypot(x, z) < R + 2, R - 2, 0), null, 'its only way out past the rim: none');
  const burn = sdGroundModel({ burning: true, now: 1000 });
  assert.equal(burn.warn, GROUND_VIEW_TEXT.warn(SD_BURNING_GROUND));
  assert.equal(sdGroundModel({ burning: false, now: 1000 }), null);
  const s = fight({ rem: { x: 0, z: 0, yw: 0, atk: atk(SD_BLOWS.stomp, T + 900) } });
  const both = sdGroundModel({ burning: true, now: T, peril: sdPerilAt(s, T, 0, 2, 0) });
  assert.equal(both.warn, GROUND_VIEW_TEXT.peril(SD_BLOWS.stomp.name), 'the blow over the brass');
  assert.ok(both.arrow !== null);
});

test('SD15 THE BEATS: a fight first seen taken as it stands; its wake (live alone), the Dragon Break, the Last Moment, the Hour\'s last minute and its fall (live alone) each once, standing in, held and out as the Warden\'s card does; forgotten as the Hour is left (mutants: a late join\'s beats; the wake late; a beat twice; no last minute; the fall late)', () => {
  const b = createSdBeats();
  const s = fight({ op: T + 500, ph: 1 });
  assert.equal(b.frame(s, T), null, 'first seen');
  const wake = b.frame(s, T + 600);
  assert.deepEqual([wake.kind, wake.main, wake.kicker, wake.sub], ['wake', SD_BEAT_TEXT.wake.main, SD_BEAT_TEXT.wake.kicker, SD_BEAT_TEXT.wake.sub]);
  assert.equal(wake.at, T + 500); assert.equal(wake.until, T + 500 + TITLE_IN_MS + TITLE_HOLD_MS + TITLE_OUT_MS);
  assert.equal(titleCardModel(wake, T + 600).main, SD_BEAT_TEXT.wake.main);
  assert.equal(b.frame(s, wake.until), null, 'gone at its end');
  s.ph = 2; assert.equal(b.frame(s, T + 10_000).kind, 'break');
  assert.match(SD_BEAT_TEXT.break.sub, /15 seconds/);
  b.frame(s, T + 10_100);
  s.ph = 3; assert.equal(b.frame(s, T + 20_000).kind, 'moment');
  assert.equal(b.frame(s, T + 20_000 + 5000), null);
  s.ends = T + 30_000 + SD_BEAT_LAST_MS - 1;
  assert.equal(b.frame(s, T + 30_000).kind, 'last');
  b.frame(s, T + 40_000);
  assert.equal(b.frame(s, T + 41_000), null, 'once');
  const ends = s.ends; s.ends = NaN; b.frame(s, T + 41_100); s.ends = ends;
  assert.equal(b.frame(s, T + 41_200), null, 'once, though a word lacked its end');
  s.fell = { at: T + 50_000 }; assert.equal(b.frame(s, T + 50_100).kind, 'fell');
  assert.equal(SD_BEAT_TEXT.fell.main, 'Undone');
  // late
  const late = createSdBeats(), l = fight({ op: T + 100 });
  late.frame(l, T); assert.equal(late.frame(l, T + 100 + SD_BEAT_LATE_MS + 1), null, 'its wake seen too late');
  const f2 = createSdBeats(), f = fight();
  f2.frame(f, T); f.fell = { at: T - SD_BEAT_LATE_MS - 1 }; assert.equal(f2.frame(f, T + 10), null, 'a fall seen too late');
  const ph = createSdBeats(), p3 = fight({ ph: 3 });
  assert.equal(ph.frame(p3, T), null, 'a late join in the Last Moment');
  assert.equal(ph.frame(p3, T + 16), null, 'and the frame after');
  b.leave(); assert.equal(b.frame(s, T + 60_000), null, 'left: taken as it stands');
});

test('SD15 THE HOUR\'S CARD - in brass, never Dagon\'s red: one node made on the first beat and updated, hidden with the HUD and when there is nothing; the world host feeds it the beats and the gate\'s ground view its peril and the burning brass, on the fight\'s clock, and puts both away with the bar (mutants: the card in red; the ground never drawn; never put away)', () => {
  assert.ok(SD_TITLE_CSS.includes(SD_TITLE_BRASS) && !SD_TITLE_CSS.includes('255,70,30'), 'brass');
  assert.ok(TITLE_CARD_CSS.includes('255,70,30'), 'the Warden\'s burns red');
  const made = [];
  const node = () => { const n = { style: {}, className: '', textContent: '', children: [], append: (...c) => n.children.push(...c), setAttribute: () => {}, remove: () => {} }; made.push(n); return n; };
  const doc = { createElement: () => node(), getElementById: () => null, head: { append: () => {} }, body: { append: () => {} } };
  const beat = { kind: 'wake', at: 0, until: 4000, ...SD_BEAT_TEXT.wake, color: null };
  drawSdTitleCard(titleCardModel(beat, 100), { doc });
  const n = made.length;
  drawSdTitleCard(titleCardModel(beat, 1500), { doc });
  assert.equal(made.length, n, 'updated, never rebuilt');
  const root = made.find((x) => x.className.startsWith('sd-title-card'));
  assert.equal(root.children[1].textContent, SD_BEAT_TEXT.wake.main);
  drawSdTitleCard(titleCardModel(beat, 1500), { doc, hidden: true });
  assert.equal(root.style.display, 'none', 'hidden with the HUD');
  destroySdTitleCard();
  assert.match(W, /const peril = playerEntity\.health > 0 \? sdPerilAt\(s, now, x - SD_ARENA\.x, z - SD_ARENA\.z, cam\.yaw, !!sdBlows\?\.over\?\.\(\)\) : null;/);   // AUDIT SD III (F8, PIN MOVED): the read told whether I stand over a pillar's top
  assert.match(W, /ground = sdGroundModel\(\{ burning: !!sdBlows\?\.burning\?\.\(\), el: sdBlows\?\.burningEl\?\.\(\) \?\? null, now, peril \}\);/);   // SD18b (PIN MOVED): in its element
  // PIN MOVED (AUDIT SD IV T1): the fight's turns on the card where its bar stands, its last minute and its fall the whole Hour's (sd26_text)
  assert.match(W, /const beat = sdBeats\.frame\(s, now\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*card = beat && \(near \|\| beat\.kind === 'last' \|\| beat\.kind === 'fell'\) \? titleCardModel\(beat, now\) : null;\n\s*\} else sdBeats\.leave\(\);/);
  assert.match(W, /if \(ground \|\| _sdGroundUp\) \{ drawGateGround\(ground, \{ hidden \}\); _sdGroundUp = !!ground; \}/);
  assert.match(W, /if \(card \|\| _sdCardUp\) \{ drawSdTitleCard\(card, \{ hidden \}\); _sdCardUp = !!card; \}/);
  assert.match(W, /if \(_sdGroundUp\) \{ drawGateGround\(null\); _sdGroundUp = false; \}[^\n]*\n\s*if \(_sdCardUp\) \{ drawSdTitleCard\(null\); _sdCardUp = false; \}/);
});

test('SD15 THE BURNING BRASS FELT: the blows say whether my feet stand in a Volley\'s burning brass - after it lands, at its mark - and not out of it (mutants: the brass never read)', () => {
  let t = T;
  const V = SD_BLOWS.volley;
  const s = fight({ rem: { x: 0, z: 0, yw: 0, atk: atk(V, T + 100, { tg: [[3, 4]] }) } });
  let feet = realmToDungeon(SD_ARENA.x + 3, 0, SD_ARENA.z + 4);
  const blows = createSdRemnantBlows({ link: { state: () => s, now: () => t, counted: () => true }, feet: () => feet, player: () => ({ health: 100, maxHealth: 100 }), strike: () => {} });   // AUDIT SD III (F4): a page the realm counted - a fighter
  blows.frame(); t += 150; blows.frame(); t += 50; blows.frame();
  assert.equal(blows.burning(), true, 'in it');
  feet = realmToDungeon(SD_ARENA.x - 9, 0, SD_ARENA.z - 9); t += 50; blows.frame();
  assert.equal(blows.burning(), false, 'out of it');
});
