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
import { hostText } from '../hostText.mjs';

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
async function dies(held, { collect = false } = {}) {
  const svc = await standService();
  const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
  const e = fallen();
  const R = await seatRealm(svc.env, ria.secret, 'Riadne', JSON.parse(JSON.stringify(snapshotPlayer(e))));
  if (held) svc.env.DB._raw.prepare('UPDATE realm_characters SET held = ? WHERE id = ?').run(held, R.id);
  const receipt = await mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789b0', w: -1 }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  const res = await quiet(() => svc.call('/v1/wild/fall', { room: CELL, receipt, realm: R.at(), letters: 1, ...(collect ? { collect: 1 } : {}) }, ria.secret));   // PIN MOVED (PVP-NO-TENTH): a room that signs collects - the last roll's   // PIN MOVED (PVP-REWARD): the bag drops nothing - the letters pay their tenth
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  // the fallen's game, as world.js wildDropTaken: what the service took out of the pack, then the death screen's word
  const out = wildTakeTook(e, d.took, d.gold);
  const n = d.items.length;
  const last = d.last ? d.gold.purse + (out.letters?.gold ?? 0) : 0;   // PIN MOVED (PVP-NO-TENTH): as scenes/wildDropHost.js
  setWildDeath({ killer: 'Borin', dropped: d.order ? n - (d.wi === 0 ? 1 : 0) : 0, claimed: null, held: false, burnt: d.burnt ? n : 0, letters: out, last });
  const lines = wildDeathLines();
  setWildDeath(null);
  return { d, e, out, lines };
}
const letters = (list) => list.filter((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE);

test('BURNT-SAID THE HELD - PIN MOVED (PVP-NO-TENTH): a held record\'s death in the zone takes nothing now - no last roll, no letter lowered, nothing for the room - and the screen says no loss (mutants: the burnt count unsaid; the letters unsaid)', async () => {
  const { d, e, out, lines } = await dies('law', { collect: true });
  assert.equal(d.burnt, true, 'the service names a held record');
  assert.equal(d.order, null, 'and gives the room nothing');
  assert.deepEqual([d.items, d.last, letters(out).length], [[], undefined, 0], 'nothing taken');
  assert.deepEqual(letters(e.items).map((it) => it.value), [650_000, 700_000], 'each letter whole');
  assert.deepEqual(lines, [WILD_TEXT.deathPvp('Borin'), WILD_TEXT.deathHold]);
});

test('BURNT-SAID THE CLEAN - PIN MOVED (PVP-NO-TENTH): no worn piece and no policy - the last roll, a tenth of her coin and letters together, her purse first (none) and the first letter paying the rest; the gold the killer\'s alone, and the screen says what was taken (mutants: the letters unsaid; the last roll unsaid)', async () => {
  const { d, e, lines } = await dies(null, { collect: true });
  assert.equal(d.burnt, undefined);
  assert.ok(d.order, 'the room is given its order');
  assert.deepEqual([d.wi, d.last, d.items.map((it) => [it.group, it.stackCount]), d.escrow], [0, true, [['Currency', 135_000]], undefined], 'the killer\'s gold alone, never hers to watch');
  assert.deepEqual(letters(e.items).map((it) => it.value), [515_000, 700_000], 'the first letter pays the whole tenth');
  assert.deepEqual(lines, [WILD_TEXT.deathPvp('Borin'), 'Borin took 135,000 gold, a tenth of your coin and letters of credit. You had no gear to take and no insurance.', WILD_TEXT.deathHold]);
});

test('BURNT-SAID THE WORDS AND THE HOST: one letter, none, a forged worth; world.js hands the answer\'s burnt count and the pieces taken out, and a fall that found me risen says the held case its own way (mutants: the host unwired; the risen line the old one)', () => {
  assert.deepEqual(wildLettersOf([letterOfCredit(650_000), createWeapon(120, 3, seeded(1))]), { n: 1, gold: 650_000 });
  assert.deepEqual(wildLettersOf(null), { n: 0, gold: 0 });
  assert.deepEqual(wildLettersOf([letterOfCredit(-5), letterOfCredit(1.5)]), { n: 2, gold: 0 }, 'only a whole worth counts');
  assert.equal(WILD_TEXT.deathLetters(1, 650_000), 'A letter of credit worth 650,000 gold left your wallet.');
  assert.equal(WILD_TEXT.deathLetters(0, 0), '');
  assert.equal(WILD_TEXT.deathBurnt(1), '1 thing you carried was lost where you fell. This character\'s trading is frozen, so nothing is left for anyone to take.');
  assert.equal(WILD_TEXT.deathBurnt(0), '');
  setWildDeath({ killer: 'Ria', dropped: 0, burnt: 2, letters: [letterOfCredit(650_000)] });   // PIN MOVED (PVP-NO-TENTH): a held fall taken before it, asked again
  assert.deepEqual(wildDeathLines(), ['Ria may take one uninsured worn piece of yours, or gold.', WILD_TEXT.deathBurnt(2), WILD_TEXT.deathLetters(1, 650_000), 'In Cyrodiil the dead wait two minutes.'], 'its loss and its letters said');   // PIN MOVED (PVP-WORDS): 'Ria may claim one piece of your worn gear.'
  setWildDeath({ killer: 'Ria', dropped: 3 });
  assert.deepEqual(wildDeathLines(), ['Ria may take one uninsured worn piece of yours, or gold.', '3 things you carried lie where you fell, for ten minutes.', 'In Cyrodiil the dead wait two minutes.'], 'a death with no letters reads as it did');   // PIN MOVED (WW-C2, bible/03-World/World-Wide.md WW-C): the zone is Cyrodiil   // PIN MOVED (PVP-WORDS): 'Ria may claim one piece of your worn gear.'
  setWildDeath(null);
  const w = hostText('src/scenes/world.js');   // PIN MOVED (HOST-SPLIT): my drop's answer in scenes/wildDropHost.js, read with its host
  assert.ok(w.includes('if (dd) setWildDeath({ killer: dd.killer, kill: true, dropped: d.order ? n - (d.wi === 0 ? 1 : 0) : 0, claimed, held, burnt: d.burnt ? n : 0, letters: out, insured, shield: d.shield === true, last });'), 'the host hands the burnt count and the pieces taken out');   // PIN MOVED (AUDIT FOE-KEEPS H1): my take is a kill; PIN MOVED (WILD-INSURE, REPEAT-SHIELD): and what kept
  // PIN MOVED (AUDIT SEA VENTURES C7): in the words of the ground the fall was on (zoneWord - the mountains' are WILD_TEXT's)
  assert.ok(w.includes("townTalk.say(d.burnt ? zoneWord('burntLate', seaRoomOf(room) ? ETHER_KIND : null)() : zoneWord('dropLate', seaRoomOf(room) ? ETHER_KIND : null));"), 'risen: the held case said its own way');
  assert.match(WILD_TEXT.burntLate(), /trading is frozen, so it was lost\.$/);
});
