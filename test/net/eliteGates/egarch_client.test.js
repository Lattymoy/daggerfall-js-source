// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections
// 5, 6.3, 6.4 and 23): THE ARCH AND THE CALL ON THE CLIENT - the start window (ui/eliteGates/egStartWindow.js: its choices and
// ticks, the one question, the Wager, the Rehearsal), the call's prompt, horn and portal (scenes/eliteGates/egCall.js), the arch
// pool (scenes/eliteGates/egArch.js: the company's arch from the call, a stranger's from the cell - verified, capped, one an opener -
// its door, its plaque, its marks), and the client played against the relay's real Room (scenes/eliteGates/egClient.js): the key's
// refusals over the host's facts, the preflight and the window, the open carrying its start and Wager, the hub's SIGNED
// call, the prompt answered into a portal at my feet and the step through it, the opener's landing, the late line; and
// the relay's half: a breach that starts deeper, the room keeping the arch's site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, EG_KEY, validEgOut, validEgIn, EG_BRAIN_V } from '../../../src/net/wire.js';
import { egRoomKey, EG_SEALED_MS, EG_ADMIT_MAX_MS, EG_TEXT, egFirstHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder, importPublicKeyB64 } from '../../../src/net/identityToken.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { egBreachNew, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egStartRows, egWagerRows, egWagerToggle, openEgStartWindow, egStartName, egNamesText } from '../../../src/ui/eliteGates/egStartWindow.js';
import { egCallPromptModel, buildEgHorn, soundEgHorn, createEgCallPortal, createEgCallPrompt, EG_HORN_KEY, EG_HORN_RATE, EG_HORN_SECONDS, EG_HORN_RMS, EG_CALL_KEYS } from '../../../src/scenes/eliteGates/egCall.js';
import { createEgArchPool, egArchKey, egArchBucket, EG_ARCH_SCALE, EG_ARCH_PER_CELL, EG_ARCH_PEER_M, EG_ARCH_SAY_M, egArchLandingFor } from '../../../src/scenes/eliteGates/egArch.js';
import { signEgCall, verifyEgCall } from '../../../src/net/eliteGates/egCallSig.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { PORTAL_OPEN_MS, PORTAL_AHEAD } from '../../../src/systems/portalStone.js';
import { GATE_COLLAPSE_MS } from '../../../src/net/gate/gateLaw.js';
import { createPortalGates } from '../../../src/scenes/portalGates.js';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
const B = '0123456789abcdef';
const ME = 'acct-mac';
const SITE = { px: 300, py: 200, x: 409.6, y: 0, z: 380, yaw: 0 };
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };
const tick = () => new Promise((r) => setImmediate(r));
/** A relay key pair as the relay and the service hold it: the private half pkcs8 base64 (GATE_SIGNING_KEY), the public half raw base64url (GATE_PUBLIC_KEY). */
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { kp, pkcs8: Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), pub: Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url') };
}

test('EG-F THE START WINDOW: the stake, the warning, Hall 1 and every Redoubt the opener may start at deepest first named with its band, a tick or a cross for each member; a start some member cannot make asks once "Go without Mara?"; the Wager three decrees of three families; the Rehearsal; the choice made once (mutants: the ticks off another member\'s starts; the question never asked; a choice made twice; the Wager\'s family law unasked)', () => {
  assert.equal(egStartName(0), 'Hall 1');
  assert.equal(egStartName(12), 'Redoubt 12 - the Shade Perilous', 'Redoubt 12 begins Hall 61, in the Shade');
  assert.equal(egStartName(7), 'Redoubt 7 - the Soul Cairn');
  assert.equal(egStartName(2), 'Redoubt 2 - the Broken Galleries');
  assert.equal(egNamesText(['Mara']), 'Mara');
  assert.equal(egNamesText(['Mara', 'Ann', 'Tor']), 'Mara, Ann and Tor');
  const members = [{ sub: ME, name: 'Mac' }, { sub: 'acct-mara', name: 'Mara' }, { sub: 'acct-ann', name: 'Ann' }];
  const starts = { [ME]: [12, 7, 0], 'acct-mara': [7, 0], 'acct-ann': null };
  const rows = egStartRows({ keys: 3, me: ME, members, starts, rehearsal: true, questDue: true, wager: [0, 4] });
  assert.deepEqual(rows.map((r) => r.label), [
    'Weir Keys: 3. One will be staked.',
    'A quest falls due before the breach can close.',
    'Redoubt 12 - the Shade Perilous [+xx]',
    'Redoubt 7 - the Soul Cairn [++x]',
    'Hall 1 [++x]',
    'The Wager: Chained Blows, Hunting Pack',
    'Rehearse: Halls 1-5, no key',
  ]);
  assert.deepEqual(rows[2].missing, ['Mara', 'Ann'], 'a guest member makes no start at all');
  assert.deepEqual(egStartRows({ keys: 0, me: ME, members: [members[0]], starts, rehearsal: true }).map((r) => r.label), [EG_TEXT.noKeys, EG_TEXT.rehearsal], 'no key: the Rehearsal alone');
  assert.deepEqual(egStartRows({ keys: 1, me: ME, members: [members[0]], starts: { [ME]: [3, 0] } }).map((r) => r.label).slice(1, 3), ['Redoubt 3 - the Broken Galleries', 'Hall 1'], 'alone: no marks');
  // the Wager's own list and toggle
  assert.equal(egWagerRows([0]).length, 21);   // PIN MOVED (AUDIT EG V, a1: L2-10's The Fraying the twentieth decree - twenty and Done)
  assert.equal(egWagerRows([0])[0].label, '* Chained Blows - the blows');
  assert.equal(egWagerRows([0]).at(-1).label, 'Done');
  assert.deepEqual(egWagerToggle([0], 1), { wager: [0], why: EG_TEXT.wagerFamily });
  assert.deepEqual(egWagerToggle([0, 4, 9], 13), { wager: [0, 4, 9], why: EG_TEXT.wagerFull });
  assert.deepEqual(egWagerToggle([0, 4], 4), { wager: [0], why: null }, 'a held decree dropped');
  // the flow, over fake doors
  const run = (o = {}) => {
    const log = [], lists = [], said = [];
    let asked = null;
    const w = openEgStartWindow({ keys: 3, me: ME, members, starts, rehearsal: true, questDue: false, say: (t) => said.push(t), ...o,
      openList: (labels, onPick, onCancel) => { const h = { labels, onPick, onCancel, open: true }; lists.push(h); return h; },
      closeList: (h) => { h.open = false; log.push('close'); },
      ask: (lines, yes, no) => { asked = { lines, yes, no }; },
      onChoose: (c) => log.push(['choose', c]), onCancel: () => log.push('cancel') });
    const top = () => lists.at(-1);
    return { w, log, lists, said, top, asked: () => asked };
  };
  let R = run();
  const pick = (label) => R.top().onPick(R.top().labels.indexOf(label));
  pick('Hall 1 [++x]');
  assert.deepEqual(R.asked().lines, ['Go without Ann?'], 'asked once - the list closed first');
  assert.equal(R.lists[0].open, false);
  R.asked().no();
  assert.equal(R.lists.length, 2, 'No: the window again');
  pick('Redoubt 7 - the Soul Cairn [++x]');
  R.asked().yes();
  assert.deepEqual(R.log.filter((x) => x !== 'close'), [['choose', { ew: 7, wg: [], rh: false }]]);
  R.asked().yes();
  assert.equal(R.log.filter((x) => x !== 'close').length, 1, 'chosen once, however many doors call it');
  // the Wager, then a start everyone can make
  R = run({ starts: { [ME]: [12, 7, 0], 'acct-mara': [7, 0], 'acct-ann': [0] } });
  pick('The Wager: none');
  assert.equal(R.top().labels.at(-1), 'Done');
  pick('Chained Blows - the blows'); pick('Twin Charge - the blows');
  assert.deepEqual(R.said, [EG_TEXT.wagerFamily], 'two of a family refused, and said');
  pick('Hunting Pack - the legion'); pick('Ashfall - the ground'); pick("The Covenant's Press - the Covenant");
  assert.deepEqual(R.w.state().wager, [0, 4, 9], 'three at most');
  assert.equal(R.said.at(-1), EG_TEXT.wagerFull);
  pick('Done');
  assert.equal(R.top().labels[R.top().labels.length - 2], 'The Wager: Chained Blows, Hunting Pack, Ashfall');
  pick('Hall 1 [+++]');
  assert.deepEqual(R.log.at(-1), ['choose', { ew: 0, wg: [0, 4, 9], rh: false }]);
  R = run();
  pick('Rehearse: Halls 1-5, no key');
  assert.deepEqual(R.log.at(-1), ['choose', { ew: 0, wg: [], rh: true }]);
  R = run();
  pick('Weir Keys: 3. One will be staked.');
  // PIN MOVED (FIELD BUGS 2026-10-18c STAKE-ROW): the port's picker closes itself on any pick (ui/listPicker.js _pick; DFU's
  // leaves the close to its owner), so the stake picked asks the list again - the old list closed, a new one open
  // (test/ui/eliteGates/fb1018c_stakerow.test.js drives the real picker on the real slot)
  assert.equal(R.lists.length, 2, 'the stake is words, not a choice: the list again');
  assert.equal(R.lists[0].open, false);
  assert.equal(R.top().open, true);
  R.top().onCancel();
  assert.deepEqual(R.log, ['close', 'close', 'cancel']);
});

test('EG-F THE CALL\'S PROMPT, HORN AND PORTAL: "The breach opens in 4:12" while sealed; "Answer the call - 4:12" while open (Enter, the pad\'s A); "Answer from open ground." indoors; gone under a window and back when it closes; gone once answered or the window ends; the horn a war horn made in code; the portal opened ahead of my feet, the first step in my admission (mutants: answerable while sealed; the prompt over a window; the horn never registered; the step taken in a hold)', async () => {
  const call = { b: B, o: 'Ann', os: 'acct-ann', op: T0, co: [[ME, 'Mac', 1], ['acct-ann', 'Ann', 2]] };
  const at = (now, o = {}) => egCallPromptModel({ call, me: ME, now, ...o });
  assert.deepEqual(at(T0 + 48_000), { text: 'The breach opens in 4:12.', answerable: false, left: EG_SEALED_MS - 48_000 });
  assert.deepEqual(at(T0 + EG_SEALED_MS + 48_000), { text: 'Answer the call - 4:12', answerable: true, left: EG_ADMIT_MAX_MS - 48_000 });
  assert.equal(at(T0 + EG_SEALED_MS + 48_000, { exterior: false }).text, EG_TEXT.indoors);
  assert.equal(at(T0 + EG_SEALED_MS + 48_000, { exterior: false }).answerable, false);
  assert.equal(at(T0 + EG_SEALED_MS, { windowUp: true }), null, 'under a window');
  assert.ok(at(T0 + EG_SEALED_MS), 'and back when it closes');
  assert.equal(at(T0 + EG_SEALED_MS, { answered: true }), null);
  assert.equal(at(T0 + EG_SEALED_MS, { inSpire: true }), null);
  assert.equal(at(T0 + EG_SEALED_MS + EG_ADMIT_MAX_MS), null, 'the window over');
  assert.equal(at(T0 + EG_SEALED_MS + 1, { wk: T0 + EG_SEALED_MS }), null, 'the first hall woke');
  assert.equal(egCallPromptModel({ call, me: 'acct-stranger', now: T0 }), null, 'a stranger is called by nobody');
  assert.deepEqual([...EG_CALL_KEYS], ['Enter', 'NumpadEnter', 'JoystickButton0']);
  // the horn
  const h = buildEgHorn();
  assert.equal(h.length, Math.round(EG_HORN_RATE * EG_HORN_SECONDS));
  const rms = Math.sqrt(h.reduce((s, v) => s + v * v, 0) / h.length);
  assert.ok(Math.abs(rms - EG_HORN_RMS) < 1e-3, 'at its level');
  assert.deepEqual(Array.from(buildEgHorn().slice(5000, 5010)), Array.from(h.slice(5000, 5010)), 'every screen sounds the same call');
  const audio = { reg: [], plays: [], registerSamples(k, s, r) { this.reg.push([k, s.length, r]); return true; }, playOneShot(k, v) { this.plays.push([k, v]); } };
  assert.equal(soundEgHorn(audio), true);
  assert.equal(soundEgHorn(audio), true);
  assert.deepEqual(audio.reg, [[EG_HORN_KEY, h.length, EG_HORN_RATE]], 'made once');
  assert.deepEqual(audio.plays, [[EG_HORN_KEY, 1], [EG_HORN_KEY, 1]]);
  assert.equal(soundEgHorn(null), false);
  // the strip
  const doc = fakeDoc();
  let answered = 0;
  const strip = createEgCallPrompt({ onAnswer: () => answered++, doc });
  strip.draw(at(T0 + EG_SEALED_MS + 48_000));
  assert.equal(strip.root.dataset.up, '1');
  assert.equal(strip.root.children[0].textContent, 'Answer the call - 4:12');
  assert.equal(strip.root.children[1].hidden, false);
  strip.root.children[1].fire('click');
  assert.equal(answered, 1, 'a tap answers');
  strip.draw(at(T0 + 48_000));
  assert.equal(strip.root.children[1].hidden, true, 'sealed: nothing to press');
  strip.draw(null);
  assert.equal(strip.root.dataset.up, '0');
  // the portal
  let clock = 0, entered = 0, refused = [], hold = null;
  const portal = createEgCallPortal({ now: () => clock, onEnter: () => entered++, onRefused: (w) => refused.push(w), hold: () => hold });
  const opened = portal.open([0, 0, 0], 0, { ground: (o) => o[1], wall: () => null });
  assert.deepEqual(opened.at, [0, 0, PORTAL_AHEAD], 'ahead of my feet');
  assert.equal(portal.life, PORTAL_OPEN_MS);
  assert.equal(portal.standing(), true);
  // a step is a walk, not a jump (scenes/portalGates.js forgets a step across one): from just outside its reach to inside
  portal.tick([0, 0, PORTAL_AHEAD - 1]); clock += 16;
  hold = 'enemies';
  portal.tick([0, 0, PORTAL_AHEAD - 0.4]); clock += 16;
  assert.deepEqual([entered, refused], [0, ['enemies']], 'a hold keeps it shut');
  hold = null;
  portal.tick([0, 0, PORTAL_AHEAD - 1]); clock += 16;
  portal.tick([0, 0, PORTAL_AHEAD - 0.4]); clock += 16;
  assert.equal(entered, 1, 'the step in');
  clock += PORTAL_OPEN_MS;
  portal.tick(null);
  assert.equal(portal.standing(), false, 'and it closes after PORTAL_OPEN_MS');
  assert.deepEqual(portal.open([0, 0, 0], 0, { ground: () => null, wall: () => null }), { refused: 'ground' });
  // drawn with the Portal Stone's portals, on their own line in the host's frame (scenes/portalGates.js drawAlso)
  const stone = createPortalGates({ now: () => clock });
  const none = stone.batches();
  stone.drawAlso(() => ['the call\'s']);
  assert.deepEqual(stone.batches(), [...none, 'the call\'s'], 'the call\'s portal drawn with the Stone\'s');
  stone.drawAlso(() => []);
  assert.equal(stone.batches(), none, 'and nothing made a frame while it stands none');
});

/** A document enough for a strip: elements with children, classes, datasets and click listeners. */
function fakeDoc() {
  const mk = (tag) => {
    const n = { tag, children: [], dataset: {}, className: '', textContent: '', hidden: false, listeners: {}, style: {},
      append(...c) { this.children.push(...c); }, addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }, fire(t) { for (const f of this.listeners[t] ?? []) f({ stopPropagation() {} }); }, remove() {} };
    return n;
  };
  const body = mk('body'), head = mk('head');
  return { body, head, createElement: mk, getElementById: () => null };
}

test('EG-F THE ARCH POOL: the company\'s arch from the call - placed, risen, collided, drawn at its scale with its gold beacon; a stranger\'s from the cell only when the hub\'s signature verifies (a forged one refused), only near its opener\'s feet, one an opener, two a cell; its plaque names the company to a stranger; a stranger\'s touch told whose it is; the company\'s step through its open fire answers; its compass, its map mark, its sight line, its clearing, its cell word (mutants: an unverified arch stood; a third stood; the step taken while sealed; the plaque\'s company sub to the company)', async () => {
  const { kp } = await relayPair();
  let clock = T0;
  const said = [], steps = [], col = { adds: [], removes: [] };
  const draws = [];
  const pool = createEgArchPool({
    renderer: { createMesh: (m) => ({ m }), uploadTexture() {}, uploadEmissionTexture() {}, drawMesh: (mesh, M) => draws.push(M) },
    collider: () => ({ addMesh: (k, p, i, m) => col.adds.push([k, m]), removeBucket: (k) => col.removes.push(k) }),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 0, now: () => clock, feet: () => feetAt, me: () => ME,
    say: (t) => said.push(t), onStep: (b) => steps.push(b), verifyKey: async () => { verified++; return kp.publicKey; },
  });
  let verified = 0;
  let feetAt = [409.6, 0, 360];
  const call = { b: B, o: 'Mac', os: ME, op: T0, ew: 0, site: SITE, co: [[ME, 'Mac', 1]], sg: await signEgCall({ b: B, o: 'Mac', os: ME, op: T0, ew: 0, site: SITE }, kp.privateKey, { subtle }) };
  pool.call(call);
  clock = T0 + 30_000;
  pool.frame(0.016);
  const a = pool.arches.get(B);
  assert.equal(a.place.phase, 'sealed');
  assert.deepEqual(a.place.origin, [409.6, 0, 380]);
  assert.equal(pool.stands(), true);
  const [d] = pool.passDraws();
  assert.deepEqual([d.scale, d.beacon.height - d.beacon.below], [EG_ARCH_SCALE, 400], 'at its scale, its beacon 400 m over its foot');
  assert.equal(col.adds.length, 1, 'its stone stands to walk into');
  assert.equal(col.adds[0][0], egArchBucket(B));
  assert.equal(pool.draw(), 1);
  assert.ok(Math.abs(draws[0][0] - EG_ARCH_SCALE) < 1e-6, 'the stone at 0.62');
  assert.deepEqual(pool.compass(), [409.6, 380]);
  const mark = pool.mapMark();
  assert.deepEqual([mark.cx, mark.cy, mark.label, mark.tip.lines[0]], [300.5, 200 + 1 - 380 / 819.2, 'Elite Breach', "Mac's company"]);
  assert.deepEqual(pool.clears(), [{ b: B, px: 300, py: 200, x: 409.6, z: 380 }]);
  assert.equal(pool.clears(), pool.clears(), 'one list while the set stands');
  assert.deepEqual(pool.word([409.6, 0, 370]), { b: B, o: 'Mac', os: ME, op: T0, ew: 0, site: SITE, sg: call.sg }, 'my arch for my cell, while I stand near');
  assert.equal(pool.word([409.6, 0, 380 - EG_ARCH_SAY_M - 5]), null, 'not from afar');
  assert.equal(pool.near([409.6, 0, 300]), true);
  assert.deepEqual(pool.hoverName(egArchKey(B)).subs.slice(0, 1), ['The Battlespire']);
  assert.equal(pool.hoverName(egArchKey(B)).subs.length, 2, 'the company is not told its own name');
  // the step through: sealed, a walk through its ember is nothing at all, a press told when; open, the answer
  said.length = 0;
  feetAt = [409.6, 0, 381]; pool.frame(0.016);
  feetAt = [409.6, 0, 379]; pool.frame(0.016);
  assert.deepEqual([steps, said], [[], []], 'sealed: walked through, nothing');
  feetAt = [409.6, 0, 360]; pool.frame(0.016);
  pool.activate(egArchKey(B));
  assert.match(said.at(-1), /^The breach opens in /);
  clock = T0 + EG_SEALED_MS + 1000;
  feetAt = [409.6, 0, 381];
  pool.frame(0.016);
  feetAt = [409.6, 0, 379];
  pool.frame(0.016);
  assert.deepEqual(steps, [B], 'the company\'s step through its open fire answers');
  // strangers
  const sg2 = await signEgCall({ b: 'fedcba9876543210', o: 'Ann', os: 'acct-ann', op: T0, ew: 0, site: { ...SITE, x: 100 } }, kp.privateKey, { subtle });
  const word2 = { b: 'fedcba9876543210', o: 'Ann', os: 'acct-ann', op: T0, ew: 0, site: { ...SITE, x: 100 }, sg: sg2 };
  const forged = await signEgCall({ b: 'aaaaaaaaaaaaaaaa', o: 'Tor', os: 'acct-tor', op: T0, ew: 0, site: SITE }, (await relayPair()).kp.privateKey, { subtle });
  assert.equal(await pool.heard('peer-tor', { b: 'aaaaaaaaaaaaaaaa', o: 'Tor', os: 'acct-tor', op: T0, ew: 0, site: SITE, sg: forged }, [409.6, 0, 380]), false, 'a forged call stands no arch');
  assert.equal(await pool.heard('peer-ann', word2, [100 + EG_ARCH_PEER_M + 5, 0, 380]), false, 'not near its opener\'s feet');
  assert.equal(await pool.heard('peer-ann', word2, [100, 0, 375]), true);
  assert.equal(pool.arches.get('fedcba9876543210').mine, false);
  const third = async (b, peer) => pool.heard(peer, { b, o: 'X', os: `acct-${peer}`, op: T0, ew: 0, site: SITE, sg: await signEgCall({ b, o: 'X', os: `acct-${peer}`, op: T0, ew: 0, site: SITE }, kp.privateKey, { subtle }) }, [409.6, 0, 380]);
  const before = verified;
  assert.equal(await third('bbbbbbbbbbbbbbbb', 'peer-ann'), false, 'one an opener');
  assert.equal(verified, before, 'refused before any signature is asked');
  assert.equal(await third('cccccccccccccccc', 'peer-cy'), true);
  assert.equal(EG_ARCH_PER_CELL, 2);
  assert.equal(await third('dddddddddddddddd', 'peer-dee'), false, 'two strangers\' a cell at most');
  pool.frame(0.016);
  assert.deepEqual(pool.hoverName(egArchKey('fedcba9876543210')).subs.slice(0, 2), ['The Battlespire', "Ann's company"], 'a stranger is told whose');
  said.length = 0;
  pool.activate(egArchKey('fedcba9876543210'));
  assert.deepEqual(said, ["The breach answers only to Ann's company."]);
  const lines = pool.sights([409.6, 0, 300]);
  assert.deepEqual(lines, ['You see an Elite Breach 320 meters to the West!', 'You see an Elite Breach 80 meters to the North!'], 'once an arch, never my own');
  assert.deepEqual(pool.sights([409.6, 0, 300]), []);
  // its end: the call gone (its window over, forgotten), the arch sinks from now, and is gone once it has
  pool.call(null);
  pool.frame(0.016);
  assert.equal(pool.arches.get(B).place.phase, 'sinking', 'the call gone: the company\'s arch sinks');
  clock += GATE_COLLAPSE_MS / 2;
  pool.call(null);
  pool.frame(0.016);
  assert.equal(pool.arches.get(B).place.fade, 0.5, 'its sink once begun runs its course, never begun again');
  clock += GATE_COLLAPSE_MS / 2;
  pool.frame(0.016);
  assert.equal(pool.arches.has(B), false, 'and gone');
  assert.ok(col.removes.includes(egArchBucket(B)));
  pool.call(call);
  assert.equal(pool.arches.has(B), false, 'a call past its arch\'s life stands nothing again');
  pool.clear();
  assert.equal(pool.arches.size, 0);
});

/**
 * THE CLIENT ON THE RELAY, THE ARCH'S WAY: a hub and a breach room on the real Room (the hub signing with a relay key),
 * the client between them with the host's seams as fakes that record - the key's facts, the start window, the arch pool,
 * the call's portal and its prompt.
 */
async function withArch(fn, { facts = null } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  const eg = world.room(egRoomKey(B));
  const pair = await relayPair();
  hub.env.GATE_SIGNING_KEY = pair.pkcs8;
  const pending = [], said = [], asked = { open: [], admit: [], starts: [], enter: [], windows: [] }, prompts = [], horns = [];
  const entity = { level: 20, health: 60, maxHealth: 100, items: [] };
  const player = { pos: realmToDungeon(SITE.x, 0, SITE.z) };
  let mode = 'exterior', hall = null, macHub = null, feet = [409.6, 0, 360];
  const modes = {
    get mode() { return mode; }, get stepping() { return false; },
    egHallBreach: () => (mode === 'dungeon' && hall ? hall.b : null), egHallCircle: () => (mode === 'dungeon' && hall ? hall.c : null),
    stepThroughFire: async (go) => go(),
    enterEgHall: (r) => { if (mode !== 'exterior') return false; asked.enter.push(r); mode = 'dungeon'; hall = r; return true; },
    egLeave: () => { mode = 'exterior'; hall = null; return true; }, egHallReturn: () => null, get dungeonCtx() { return null; },
  };
  const send = (room, sock, w) => { pending.push(room.raw(sock, JSON.stringify({ t: 'eg', ...w }))); return true; };
  const hubLink = { get egOk() { return true; }, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); return w && macHub ? send(hub, macHub, w) : false; } };
  const presence = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => !!validEgIn({ ...f, k, ...(k === 'in' ? { bv: EG_BRAIN_V } : {}) }) };
  let inflight = 0;
  const track = (f) => async (...a) => { inflight++; try { return await f(...a); } finally { inflight--; } };
  const account = {
    me: () => ME, guest: () => false,
    keys: track(async () => ({ ok: true, data: { keys: 2, rk: pair.pub } })),
    starts: track(async (subs) => { asked.starts.push(subs); return { ok: true, data: { starts: { [ME]: [0], 'acct-ann': [0] }, keys: 2, rehearsal: true, rk: pair.pub } }; }),
    open: track(async (rq, rh, more) => { asked.open.push({ rq, rh, ...more }); return { ok: true, data: { order: await mintEgOrder({ o: 'egopen', s: ME, eb: B, ez: 'z'.repeat(20), ew: more?.ew ?? 0, ...(rh ? { rh: 1 } : {}), ewg: more?.wg?.length ? more.wg : undefined }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) }), b: B, ez: 'z'.repeat(20), keys: 1, until: 0, rh: rh ? 1 : 0 } }; }),
    admit: track(async (b) => { asked.admit.push(b); return { ok: true, data: { order: await mintEgOrder({ o: 'egadmit', s: ME, eb: b, ez: 'a'.repeat(20) }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) }), b } }; }),
    claim: track(async () => ({ ok: true, data: { recorded: true } })),
  };
  const arches = createEgArchPool({ pixelTranslation: () => [0, 0, 0], heightAt: () => 0, now: () => clock, feet: () => feet, me: () => ME, say: (t) => said.push(t),
    onStep: (b) => client.archStep(b), verifyKey: () => client.relayKey() });
  const portal = createEgCallPortal({ now: () => clock, onEnter: () => client.portalEntered() });
  const audio = { registerSamples: () => true, playOneShot: (k) => horns.push(k) };
  let choice = { ew: 0, wg: [0, 4] };
  const client = createEgClient({
    modes: () => modes, online: () => presence, hub: () => hubLink, account, now: () => clock, entity, player, cam: { pos: player.pos, yaw: 0 }, audio,
    say: (t) => said.push(t), site: () => ({ climateBase: 2, season: 0 }), wire: () => SITE, landAt: () => true, hurt: () => {},
    keyFacts: () => (facts ? facts() : { site: SITE }), party: () => [{ sub: ME, name: 'Mac' }, { sub: 'acct-ann', name: 'Ann' }],
    startWindow: (o) => { asked.windows.push(o); queueMicrotask(() => o.onChoose(choice)); return { close() {} }; },
    arches, callPortal: portal, prompt: { draw: (m) => prompts.push(m) }, feet: () => feet, probes: () => ({ ground: (o) => o[1], wall: () => null }),
  });
  const seen = new Map();
  const pump = () => { const s = macHub; if (!s) return; let i = seen.get(s) ?? 0; for (; i < s.sent.length; i++) { const m = s.sent[i]; if (m.t === 'eg') client.word(validEgOut(m), SOCIAL_ROOM); } seen.set(s, i); };
  const settle = async () => { for (let q = 0, k = 0; k < 3000 && q < 3; k++) { await tick(); const busy = inflight > 0 || pending.length > 0; await Promise.all(pending.splice(0)); pump(); q = busy ? 0 : q + 1; } };
  try {
    await quiet(async () => {
      macHub = hub.connect(); await hub.hello(macHub, 'peer-mac', null, { name: 'Mac', acct: ME, asecret: 'secret-of-acct-mac', kind: 'linked' });
      await fn({ client, said, asked, prompts, horns, settle, arches, portal, pair, eg, hub, step: (ms) => { clock += ms; }, now: () => clock, setFeet: (f) => { feet = f; }, setChoice: (c) => { choice = c; }, setMode: (m) => { mode = m; } });
    });
  } finally { Date.now = realNow; }
}

test('EG-F THE CLIENT ON THE RELAY: the key\'s refusals over the host\'s facts; the preflight asks my party\'s starts and the window opens on it; its choice is the open, carrying its start and its Wager to the room; the hub\'s call is SIGNED (a stranger verifies it), sounds the horn once and stands my arch; the prompt says when it opens, then answers - Enter opens the portal at my feet, the step into it steps me in with my landing before the arch (mutants: the window skipped; the Wager dropped at the hub; the call unsigned; the portal skipped; the landing lost)', async () => {
  let facts = () => ({ within: 'Daggerfall', site: SITE });
  await withArch(async (P) => {
    const { client, said, asked, prompts, horns, settle, arches, portal, pair, eg, step, setFeet } = P;
    assert.equal(client.useKey(), 'You cannot open a breach within Daggerfall.');
    facts = () => ({ nearGate: true, site: SITE });
    assert.equal(client.useKey(), EG_TEXT.near);
    facts = () => ({ hold: 'duel', site: SITE });
    assert.equal(client.useKey(), EG_TEXT.holds.duel);
    facts = () => ({ site: null });
    assert.equal(client.useKey(), EG_TEXT.room, 'no room for the arch');
    facts = () => ({ site: SITE });
    assert.equal(client.useKey(), '', 'the start window asks first - nothing staked yet');
    await settle();
    assert.deepEqual(asked.starts, [[ME, 'acct-ann']], 'the preflight asks for my party');
    assert.deepEqual([asked.windows[0].keys, asked.windows[0].members.map((m) => m.name), asked.windows[0].rehearsal], [2, ['Mac', 'Ann'], true]);
    assert.equal(asked.open.length, 1);
    assert.deepEqual([asked.open[0].ew, asked.open[0].wg, asked.open[0].rh], [0, [0, 4], false], 'the window\'s choice is the open');
    assert.ok(said.includes(EG_TEXT.opening));
    const rec = eg.room._eg ?? eg.store.get(EG_KEY);
    assert.deepEqual(rec.wg, [0, 4], 'the Wager reached the room (EG-PLAY departure 8 closed)');
    assert.deepEqual(rec.site, SITE, 'the room keeps the arch\'s site');
    const call = client.state().call;
    assert.deepEqual([call.b, call.os, call.ew, call.wg], [B, ME, 0, [0, 4]]);
    assert.match(call.sg, /^[A-Za-z0-9_-]{86}$/, 'the hub signed it');
    const pub = await importPublicKeyB64(pair.pub, { subtle });
    assert.equal(await verifyEgCall(call, pub, { subtle }), true, 'a stranger verifies it with the relay\'s public half');
    assert.deepEqual(horns, ['eg:horn'], 'the horn, once');
    // the frame: the arch stands, the prompt says when it opens
    step(1000);
    client.frame();
    await settle();
    assert.ok(arches.arches.get(B)?.mine, 'my company\'s arch stands');
    assert.match(prompts.at(-1).text, /^The breach opens in /);
    assert.equal(client.key({ code: 'Enter' }), false, 'nothing to answer while sealed');
    step(EG_SEALED_MS);
    client.frame();
    assert.equal(prompts.at(-1).text, `Answer the call - ${'4:59'}`);
    assert.equal(client.key({ code: 'Enter' }), true, 'Enter answers');
    await settle();
    assert.deepEqual(asked.admit, [B]);
    assert.equal(portal.standing(), true, 'the portal at my feet');
    assert.equal(asked.enter.length, 0, 'not in until I step into it');
    client.frame();
    assert.equal(prompts.at(-1), null, 'the prompt goes once answered');
    // the step in
    setFeet([409.6, 0, 361]); step(16); client.frame();
    setFeet([409.6, 0, 361.6]); step(16); client.frame();
    await settle();
    assert.equal(asked.enter.length, 1, 'stepping into it is the admission');
    const r = asked.enter[0];
    assert.deepEqual([r.b, r.c], [B, 1]);
    assert.deepEqual(r.landing, egArchLandingFor(SITE, { pixelTranslation: () => [0, 0, 0], heightAt: () => 0 }), 'the opener lands before the arch');
  }, { facts: () => facts() });
});

test('EG-F THE LATE LINE AND A MEMBER\'S ANSWER: a member\'s call is one line, "<opener> opens an Elite Breach."; answered after the window, "The breach has closed behind <opener>\'s company."; refused by the room after the first hall woke, the same; a portal closed unused leaves the prompt to stand again (mutants: the late line never said; the prompt gone for good after an unused portal)', async () => {
  await withArch(async (P) => {
    const { client, said, prompts, step, settle, portal } = P;
    const call = { k: 'call', b: B, o: 'Ann', os: 'acct-ann', seed: 7, op: T0, rh: 0, co: [[ME, 'Mac', 1], ['acct-ann', 'Ann', 2]], site: SITE, ew: 0, wg: [], sg: '' };
    client.word(validEgOut(call));
    assert.equal(said.at(-1), "Ann opens an Elite Breach.", 'one line - the prompt says the rest');
    step(EG_SEALED_MS + 1000);
    client.command('');
    await settle();
    assert.equal(portal.standing(), true);
    client.frame();
    assert.equal(prompts.at(-1), null);
    step(PORTAL_OPEN_MS + 1000);
    client.frame();
    client.frame();
    assert.equal(portal.standing(), false);
    assert.equal(prompts.at(-1)?.answerable, true, 'the portal closed unused: the prompt stands again');
    // answered again, and the room says the breach took no more (its first hall woke): the late line
    client.command('');
    await settle();
    assert.equal(portal.standing(), true);
    said.length = 0;
    client.link.word({ k: 'no', m: 'the breach is closed' });
    assert.equal(said.at(-1), "The breach has closed behind Ann's company.");
    // and an answer after the window ends says it too
    said.length = 0;
    step(EG_ADMIT_MAX_MS);
    client.command('');
    await settle();
    assert.equal(said.at(-1), "The breach has closed behind Ann's company.");
  });
});

test('EG-F THE RELAY\'S HALF: a breach that starts at Redoubt w begins at the next circle\'s first hall; the room\'s whole state keeps the arch\'s site and the wire carries it; the call\'s start, Wager and signature are read and bounded (mutants: a deeper start begun at Hall 1; the site dropped from `st`)', () => {
  const co = [['acct-mac', 'Mac', 1]];
  const B12 = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-mac', o: 'Mac', ew: 12, rh: 0, seed: 7, op: T0, co, site: SITE, wg: [0, 4] });
  egStep(B12, T0 + EG_SEALED_MS, [], Math.random);
  assert.equal(B12.h, egFirstHallOf(13));
  assert.equal(B12.h, 61);
  const B0 = egBreachNew({ b: B, ez: 'z'.repeat(20), s: 'acct-mac', o: 'Mac', ew: 0, rh: 0, seed: 7, op: T0, co, site: SITE });
  egStep(B0, T0 + EG_SEALED_MS, [], Math.random);
  assert.equal(B0.h, 1);
  const st = egStateOf(B12, T0 + EG_SEALED_MS);
  assert.deepEqual(st.site, SITE);
  assert.deepEqual(st.wg, [0, 4]);
  assert.deepEqual(validEgOut(st).site, SITE, 'the wire keeps it');
  const call = validEgOut({ k: 'call', b: B, o: 'Mac', os: 'acct-mac', seed: 7, op: T0, rh: 0, co, site: SITE, ew: 12, wg: [0, 4], sg: 'A'.repeat(86) });
  assert.deepEqual([call.ew, call.wg, call.sg], [12, [0, 4], 'A'.repeat(86)]);
  const old = validEgOut({ k: 'call', b: B, o: 'Mac', os: 'acct-mac', seed: 7, op: T0, rh: 0, co, site: SITE });
  assert.deepEqual([old.ew, old.wg, old.sg], [0, [], ''], 'EG-PLAY\'s call reads as Hall 1, no Wager, unsigned');
  assert.equal(validEgOut({ k: 'call', b: B, o: 'Mac', os: 'acct-mac', seed: 7, op: T0, rh: 0, co, site: SITE, sg: 'not a signature' }).sg, '');
});

test('EG-F THE HOSTS BY SOURCE: the world host builds the arch pool and hands it to the gate\'s pool (its frame, its world pass, its foreign pass, its presses), the key its facts and the start window over DFU\'s list picker and YesNo box, the call its portal (drawn on the flats\' axis) and its prompt; carries my arch on my foes frame and hands a peer\'s to the pool; the Timers row, the held map and the compass their arch; the clearing its set; the mode machine lands the opener before the arch; the street\'s pool hands a peer\'s arch word over - and nothing joins the host\'s frame (THE FOUR HOSTS: world.js and worldModes.js WIRED; dungeonContext.js and exterior.js FLAGGED in the record) (mutants: the pool never handed to the gate\'s; the arch never on the cell; the landing dropped)', () => {
  const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const WM = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const XF = readFileSync(new URL('../../../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
  for (const needle of [
    'const egArchPool = params.has(\'online\') ? createEgArchPool({',
    '    arches: egArchPool,   // EG-F: the Elite Breaches\' arches, stood, drawn and pressed beside the gate',
    '    keyFacts: egKeyFacts, startWindow: egStartWindow, arches: egArchPool, callPortal: _egCallPortal, prompt: egCallPrompt, feet: egFeet, probes: egProbes,   // EG-F',
    '    ...egStartListDoors({ ready: listPickerArtLoaded, slot: egWindowSlot, makeList: (items, onPick, onCancel) => new ListPickerWindow({ items, backdrop: \'none\', onPick: (i) => onPick(i), onCancel: () => onCancel() }) }),',   // PIN MOVED (AUDIT STAKE-ROW): the list's doors are the window's own (egStartListDoors), run over the real slot by test/ui/eliteGates/fb1018c_stakerow.test.js
    'ask: egStartAsk((w) => townTalk.showOverlay(w), (o) => new YesNoBoxWindow(o)),',   // PIN MOVED (AUDIT EG III lane4 #12): DFU's YesNo box through the question's door (ui/eliteGates/egStartWindow.js egStartAsk - test/scenes/eliteGates/egaudit3_client.test.js)
    'if (ea) frame.ea = ea;',
    'exteriorFoes.setOnEgArch((from, r) => { const p = online?.peers?.get(from); egClient?.archHeard(from, r, p?.shown ? onlineToScene(p.shown) : null); });',
    'elite: egClient?.timers() ?? null,',
    'arch: () => egClient?.archMapMark() ?? null,',
    'arch: egClient?.archCompass() ?? null,',
    'if (_egCallPortal) portalGates.drawAlso(() => _egCallPortal.batches());',
    'return _gateClearSetOf(_gateClearOf.clear, egClient?.archClears() ?? null, starfall?.starClears() ?? null);',   // PIN MOVED (STAR-CLEAR): the set's memo is world/gate/gateClearance.js gateClearMemo, the stars' clearings beside the arches'
  ]) assert.ok(W.includes(needle), `world.js: ${needle.slice(0, 80)}`);
  assert.ok(WM.includes('if (hit.egFrom) dungeonReturn.from = hit.egFrom;'), 'the opener\'s landing kept as the way out\'s');
  assert.ok(WM.includes('egFrom: r.landing?.pos ? r.landing : null'));
  assert.ok(XF.includes('if (data.ea !== undefined) _onEgArch?.(from, data.ea);'));
  // nothing added to the host's frame: the arches ride the gate pool's own doors there, the call the online frame's egFrame
  const at = W.indexOf('\n  function frame(now) {\n'), end = W.indexOf('\n  }\n', at);
  assert.ok(at > 0 && end > at);
  assert.doesNotMatch(W.slice(at, end), /egArchPool|callFrame|_egCallPortal\?\.tick|archClears/, 'no statement of the arch\'s in the host frame');
});
