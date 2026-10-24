// BURNT-SAID (FIELD BUGS 2026-10-18b - bible/01-Overview/bugs/Field-Bugs-2026-10-18b.md; shaman, "Letter of Credit
// vanishing from wallet"). A death in the open zone drops every letter of credit (LETTERS-DROP), and a record the judge
// holds still loses its drop while the room is given none of it (Integrity-Arc, Lane 1's freeze: `burnt`, no order). The
// fallen's game took the drop out of the pack and said it as nothing at all - `dropped: d.order ? n : 0`, and the death
// screen prints no line for none. So a held character's letters left the wallet with no word. Now the screen says what
// was lost and why, and any death in the zone names the letters it took by their worth. Through the real account service:
// a held record and a clean one, each dying at another player's hand (PIN MOVED, FOE-KEEPS - bible/11-Multiplayer/Wild-Zone.md
// section 4: it was a foe's, whose death takes nothing now) with letters the shop's own sellProceeds pays; the fallen's game
// takes out what the service took (wildTakeTook) and its death screen reads the answer as world.js wildDropTaken hands it on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { seeded } from '../honestItems.mjs';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { letterOfCredit, LETTER_OF_CREDIT_TEMPLATE } from '../../src/systems/inventory.js';
import { sellProceeds } from '../../src/systems/tradeModes.js';
import '../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { wildTakeTook } from '../../src/systems/wild/wildDeath.js';
import { setWildDeath, wildDeathLines, wildLettersOf, WILD_TEXT } from '../../src/systems/wild/wildZone.js';
import { worldRoom } from '../../src/net/wire.js';
import { mintWildReceipt } from '../../src/net/wild/wildReceipt.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const CELL = worldRoom(520, 110);
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

/** A letter as a shop pays one - the sale too heavy to carry as coin (tradeModes.js sellProceeds). */
const paid = (amount) => { const r = sellProceeds(amount, { carriedWeightKg: 0, maxEncumbranceKg: 0 }); assert.equal(r.kind, 'letterOfCredit'); return letterOfCredit(r.amount); };
/** The fallen: a longsword in the bag, two letters from a run of sales; ids stamped as the realm checkpoint stamps them. */
function fallen() {
  const e = { name: 'Riadne', gender: 'female', level: 20, items: [createWeapon(120, 3, seeded(7)), paid(650_000), paid(700_000)], wagonItems: [], goldPieces: 0 };
  stampItemIds(e);
  return e;
}
/** A death at Borin's hand in the zone (no worn piece picked), through the service: the fallen's record, `held` its row's
 *  hold (null: none). */
async function dies(held) {
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
  const e = fallen();
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', JSON.parse(JSON.stringify(snapshotPlayer(e))));
  if (held) svc.env.DB._raw.prepare('UPDATE realm_characters SET held = ? WHERE id = ?').run(held, R.id);
  const receipt = await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789b0', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  const res = await quiet(() => svc.call('/v1/wild/fall', { room: CELL, receipt, realm: R.at() }, ria.secret));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  // the fallen's game, as world.js wildDropTaken: what the service took out of the pack, then the death screen's word
  const out = wildTakeTook(e, d.took, d.gold);
  const n = d.items.length;
  setWildDeath({ killer: 'Borin', dropped: d.order ? n : 0, claimed: null, held: false, burnt: d.burnt ? n : 0, letters: out });
  const lines = wildDeathLines();
  setWildDeath(null);
  return { d, e, out, lines };
}
const letters = (list) => list.filter((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);

test('BURNT-SAID THE HELD: a held record\'s death in the zone takes both letters and lays nothing - and the death screen says so: what was lost, why, and the letters by their worth (mutants: the burnt count unsaid; the letters unsaid)', async () => {
  const { d, e, out, lines } = await dies('law');
  assert.equal(d.burnt, true, 'the service burns a held record\'s drop');
  assert.equal(d.order, null, 'and gives the room nothing');
  assert.equal(letters(out).length, 2, 'both letters left the pack');
  assert.equal(letters(e.items).length, 0);
  assert.deepEqual(lines, [
    WILD_TEXT.deathPvp('Borin'),
    WILD_TEXT.deathBurnt(d.items.length),
    '2 letters of credit worth 1,350,000 gold left your wallet.',
    WILD_TEXT.deathHold,
  ]);
  assert.match(lines[1], /^3 things you carried were lost where you fell\. This character's trading is frozen, so nothing is left for anyone to take\.$/);
});

test('BURNT-SAID THE CLEAN: a record nobody holds lays its drop as ever - the screen says it lies where it fell, and now names the letters among it (mutants: the letters unsaid)', async () => {
  const { d, lines } = await dies(null);
  assert.equal(d.burnt, undefined);
  assert.ok(d.order, 'the room is given its order');
  assert.deepEqual(lines, [WILD_TEXT.deathPvp('Borin'), WILD_TEXT.deathDrop(d.items.length), '2 letters of credit worth 1,350,000 gold left your wallet.', WILD_TEXT.deathHold]);
});

test('BURNT-SAID THE WORDS AND THE HOST: one letter, none, a forged worth; world.js hands the answer\'s burnt count and the pieces taken out, and a fall that found me risen says the held case its own way (mutants: the host unwired; the risen line the old one)', () => {
  assert.deepEqual(wildLettersOf([letterOfCredit(650_000), createWeapon(120, 3, seeded(1))]), { n: 1, gold: 650_000 });
  assert.deepEqual(wildLettersOf(null), { n: 0, gold: 0 });
  assert.deepEqual(wildLettersOf([letterOfCredit(-5), letterOfCredit(1.5)]), { n: 2, gold: 0 }, 'only a whole worth counts');
  assert.equal(WILD_TEXT.deathLetters(1, 650_000), 'A letter of credit worth 650,000 gold left your wallet.');
  assert.equal(WILD_TEXT.deathLetters(0, 0), '');
  assert.equal(WILD_TEXT.deathBurnt(1), '1 thing you carried was lost where you fell. This character\'s trading is frozen, so nothing is left for anyone to take.');
  assert.equal(WILD_TEXT.deathBurnt(0), '');
  setWildDeath({ killer: 'Ria', dropped: 3 });
  assert.deepEqual(wildDeathLines(), ['Ria may claim one piece of your worn gear.', '3 things you carried lie where you fell, for ten minutes.', 'In the mountains the dead wait two minutes.'], 'a death with no letters reads as it did');
  setWildDeath(null);
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('if (dd) setWildDeath({ killer: dd.killer, kill: true, dropped: d.order ? n : 0, claimed, held, burnt: d.burnt ? n : 0, letters: out });'), 'the host hands the burnt count and the pieces taken out');   // PIN MOVED (AUDIT FOE-KEEPS H1): my take is a kill
  // PIN MOVED (AUDIT SEA VENTURES C7): in the words of the ground the fall was on (zoneWord - the mountains' are WILD_TEXT's)
  assert.ok(w.includes("townTalk.say(d.burnt ? zoneWord('burntLate', seaRoomOf(room) ? ETHER_KIND : null)() : zoneWord('dropLate', seaRoomOf(room) ? ETHER_KIND : null));"), 'risen: the held case said its own way');
  assert.match(WILD_TEXT.burntLate(), /trading is frozen, so it was lost\.$/);
});
