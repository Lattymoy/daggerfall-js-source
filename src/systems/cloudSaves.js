// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC2 — THE CLOUD SAVE, CLIENT SIDE.
//
// Mac: "Go in order. Take your time." Step 4 of the arc's build order,
// the half that runs in the browser.
//
// ═══ IT IS A THIRD DESTINATION FOR A CARRIER THAT ALREADY WORKS ════
//
// SP1 (`systems/saveTransfer.js`) was written because a player on
// Discord said "my saves its all gone" - they had installed the app
// after playing on the site and found empty slots. Nothing was lost;
// the saves were in the other store. That module defines what happens
// when a slot ARRIVES from elsewhere, and its law is the one that
// matters here:
//
//   a slot never overwrites another: it takes its own number when that
//   number is free, the first free one when it is not, and a slot the
//   store already holds (same character, same slot name, same game
//   minute) is skipped rather than doubled.
//
// A DOWNLOAD IS A SLOT ARRIVING FROM ELSEWHERE, so it goes through
// `importSlots` unchanged. There is no merge rule here, no timestamp
// comparison and no conflict resolution - writing one would be a SECOND
// answer to a question this repo has already answered, and ACC0 refused
// the design where the cloud is the truth for the reason that makes
// that dangerous: a sync bug over a backup is an inconvenience, and a
// sync bug over the truth is a lost game.
//
// ═══ A SLOT IS (character, save name), NOT THE LOCAL NUMBER ════════
//
// `saveSlots.js` files a slot under the first free integer - a fact
// about ONE store. Two devices that saved in a different order hold the
// same QuickSave under different numbers. What travels is the identity
// CHARID1 settled: the character's ID and the save's name.
//
// ═══ PURE, THE SAME WAY accountClient.js IS PURE ═══════════════════
//
// `fetch` and the storage are ARGUMENTS. No globals, no clock, no DOM.
// That is what lets the pins drive a whole push and pull in node
// against a fetch that answers the real service's shapes.
//
// ═══ NOTHING HERE HAPPENS BY ITSELF ════════════════════════════════
//
// ACC0's step 4 said "upload on save" and bible ACC2 D6 narrows it,
// with the reason written down rather than dropped: an upload inside
// the save path puts a NETWORK CALL in the one operation this game must
// never fail, and a backup that happens invisibly is a backup whose
// failure is also invisible. The trigger is a visible act, and it
// arrives with the surface that can show it failing.
// ═══════════════════════════════════════════════════════════════════

import {
  SAVE_DATA_PREFIX, SAVE_INFO_PREFIX, SAVE_SHOT_PREFIX, firstFreeKey,
} from './saveSlots.js';
import { importSlots } from './saveTransfer.js';
import { serviceBase, storedSession, forgetSession, accountRefusalText } from '../net/accountClient.js';

/** THE REFUSALS THIS SIDE OWNS, and only the ones the service cannot
 *  answer. Everything the SERVICE refuses with keeps its sentence in
 *  accountClient.js's one table - a second table for the same words is
 *  how a player meets two different sentences for one refusal. */
export const CLOUD_REFUSALS = Object.freeze({
  // CHARID1: a card written before characters had ids. It is adopted
  // the first time its character is loaded (`adoptLegacyCards`), so
  // this is a wait rather than a wall, and the sentence says so.
  // SHORT ON PURPOSE (AUDIT-312 F2). It now has a surface - the tile's
  // own cloud line - and Mac's rule for a tile is facts and no prose:
  // "there's uneeded text explaining what an account is". What a player
  // needs here is the ACT, not the history of CHARID1.
  'no-character': 'Load this save once, then it can be backed up.',
  'no-save': 'That save is not on this device.',
  // NOT `no-account`, which the SERVICE already uses for "that account
  // no longer exists". One word, one sentence: a table here that
  // shadowed a word the service can send would mean a player meets two
  // different sentences for one refusal, and a pin holds the two tables
  // disjoint.
  'signed-out': 'Sign in to back up your saves.',
  // The local store refused the write - quota, or a private window.
  // saveTransfer's importSlots leaves nothing half done when this
  // happens, which is why it is a message and not a broken slot.
  'no-room': 'There is no room on this device for that save.',
});

/** A sentence for anything either end can refuse with. */
export const cloudRefusalText = (error) => CLOUD_REFUSALS[error] ?? accountRefusalText(error);

/**
 * The service, as this device can reach it - or null when nobody is
 * signed in. `null` rather than a throw, because "not signed in" is the
 * ordinary state of most players and not an error.
 *
 * @param {{fetch: (url: string, init: object) => Promise<any>, storage: any}} io
 */
export function cloudIo({ fetch, storage }) {
  const session = storedSession(storage);
  if (!session) return null;
  return { fetch, base: serviceBase(storage), secret: session.secret, storage };
}

/** The slot path. BOTH SEGMENTS ENCODED: a save name is the player's
 *  own words and may hold a space, a slash or a hash, and the service's
 *  own matcher decodes exactly this (server-account/src/service.js
 *  savePathOf). */
/** THE SLOT'S IDENTITY AS ONE STRING, for a caller that has to hold
 *  "which slot is this?" in a variable - the menu's busy latch and its
 *  refusal latch both do. It is the SAME pair the path is built from
 *  (ACC2 D2: a slot is (character, save name), never the local number),
 *  and it lives here rather than in the menu because AUDIT-312 F3 found
 *  the menu's own copy had dropped the character half - which makes
 *  every character's QuickSave one slot, so one backup's spinner and
 *  one backup's error land on all of them. */
export const slotKeyOf = (slot) => `${slot?.characterId ?? ''}|${slot?.saveName ?? ''}`;

export const slotPath = (characterId, saveName, part = null) =>
  `/v1/saves/${encodeURIComponent(characterId)}/${encodeURIComponent(saveName)}${part ? `/${part}` : ''}`;

/**
 * ONE DOOR, and it carries the credential in a header and nowhere else
 * - AUDIT-ACC F13, which this side does not get to reopen.
 *
 * `raw` is what separates this from accountClient's `call`: a save is
 * hundreds of kilobytes, so the blob routes send and receive TEXT
 * rather than JSON, and base64 in a JSON envelope would be a third more
 * bytes paid twice (once on the wire, once in the string the client
 * would have to hold whole).
 */
async function ask(io, path, { method = 'GET', json = null, raw = null } = {}) {
  if (!io) return { ok: false, error: 'signed-out' };
  const headers = { accept: 'application/json' };
  if (json) headers['content-type'] = 'application/json';
  if (raw != null) headers['content-type'] = 'application/octet-stream';
  headers.authorization = `Bearer ${io.secret}`;
  let res;
  try {
    res = await io.fetch(`${io.base}${path}`, {
      method, headers,
      body: json ? JSON.stringify(json) : (raw ?? undefined),
    });
  } catch {
    // ONCRASH1's law on this side too: a network failure is a refusal,
    // not a throw. Every arm of this function returns the same shape.
    return { ok: false, error: 'offline' };
  }
  const type = res.headers?.get?.('content-type') ?? '';
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    const error = typeof data?.error === 'string' ? data.error : 'server';
    // A SECRET THE SERVICE HAS STOPPED HONOURING IS NOT A SESSION -
    // accountClient.js's own law, and the same single exception: only
    // `auth`, because signing a player out over a 503 would make an
    // outage permanent.
    if (error === 'auth') forgetSession(io.storage);
    return { ok: false, error, status: res.status };
  }
  if (type.includes('json')) {
    try { return { ok: true, data: await res.json() }; } catch { return { ok: false, error: 'server' }; }
  }
  return { ok: true, text: await res.text() };
}

/** Every slot the cloud holds for this account, newest first. */
export const cloudList = async (io) => {
  const r = await ask(io, '/v1/saves');
  return r.ok ? { ok: true, saves: Array.isArray(r.data?.saves) ? r.data.saves : [] } : r;
};

/** One local slot, read the way saveTransfer reads them: the three
 *  stored strings, and a slot without both its data and a parseable
 *  card is not a slot (SAV4's law, kept here too). */
export function localSlot(storage, key) {
  if (!storage) return null;
  const data = storage.getItem(SAVE_DATA_PREFIX + key);
  const infoText = storage.getItem(SAVE_INFO_PREFIX + key);
  if (!data || !infoText) return null;
  let info;
  try { info = JSON.parse(infoText); } catch { return null; }
  if (!info || typeof info !== 'object') return null;
  return { key, data, infoText, info, shot: storage.getItem(SAVE_SHOT_PREFIX + key) ?? null };
}

/**
 * PUSH ONE SLOT.
 *
 * The card goes FIRST because the card is what creates the slot - the
 * service refuses a blob that no row names (server-account/src/saves.js
 * says why: it is SAV4's "a slot is only real WITH its SaveInfo", and
 * it is the only thing bounding R2). Then the data, then the shot; the
 * shot is optional and its failure does not fail the save, because a
 * backup without a thumbnail is a backup and a thumbnail without a
 * backup is nothing.
 *
 * THE SIZE BOUND IS NOT RESTATED HERE. The service owns it and answers
 * `too-large`; a copy of the number on this side would be a second home
 * for a fact, and the sentence a player needs is the same either way.
 */
export async function pushSlot(io, storage, key) {
  if (!io) return { ok: false, error: 'signed-out' };
  const slot = localSlot(storage, key);
  if (!slot) return { ok: false, error: 'no-save' };
  const characterId = typeof slot.info.characterId === 'string' ? slot.info.characterId : '';
  if (!characterId) return { ok: false, error: 'no-character' };
  const saveName = typeof slot.info.saveName === 'string' && slot.info.saveName ? slot.info.saveName : '';
  if (!saveName) return { ok: false, error: 'no-save' };

  const card = await ask(io, slotPath(characterId, saveName), {
    method: 'PUT',
    json: {
      characterName: slot.info.characterName ?? null,
      gameTime: slot.info.dateAndTime?.gameTime ?? null,
      realTime: slot.info.dateAndTime?.realTime ?? null,
      dfuVersion: slot.info.dfuVersion ?? null,
      saveVersion: slot.info.saveVersion ?? null,
    },
  });
  if (!card.ok) return card;

  const data = await ask(io, slotPath(characterId, saveName, 'data'), { method: 'PUT', raw: slot.data });
  if (!data.ok) return data;

  let shot = { ok: true };
  if (slot.shot) shot = await ask(io, slotPath(characterId, saveName, 'shot'), { method: 'PUT', raw: slot.shot });

  return { ok: true, characterId, saveName, bytes: data.data?.bytes ?? 0, shot: shot.ok };
}

/**
 * PULL ONE SLOT INTO THIS DEVICE'S STORE.
 *
 * The card the service hands back is not the store's SaveInfo - the
 * store's is the JSON `saveSlots.js` wrote and reads, and rebuilding it
 * from the cloud's columns would be a SECOND writer of that shape. What
 * travels is the SaveData blob and the SaveInfo the device that saved
 * it wrote... except the service does not hold that string.
 *
 * So the card IS rebuilt here, from the columns, in the one shape
 * `saveSlots.js` documents (its `SaveInfo` typedef) - and every field is
 * optional there precisely because a card can come from an older build
 * or another device. A pin holds this against that typedef.
 *
 * Then SP1's law does the rest: `importSlots` decides the number, skips
 * a save the store already holds, and writes the card LAST so a quota
 * failure leaves nothing half done.
 */
export async function pullSlot(io, storage, cloudCard) {
  if (!io) return { ok: false, error: 'signed-out' };
  const characterId = cloudCard?.characterId;
  const saveName = cloudCard?.saveName;
  if (!characterId || !saveName) return { ok: false, error: 'no-slot' };

  const data = await ask(io, slotPath(characterId, saveName, 'data'));
  if (!data.ok) return data;
  const shot = await ask(io, slotPath(characterId, saveName, 'shot'));

  const info = {
    saveVersion: cloudCard.saveVersion ?? undefined,
    saveName,
    characterName: cloudCard.characterName ?? '',
    dateAndTime: { gameTime: cloudCard.gameTime ?? 0, realTime: cloudCard.realTime ?? 0 },
    dfuVersion: cloudCard.dfuVersion ?? '',
    characterId,
  };
  const r = importSlots(
    [{ n: firstFreeKey(storage), data: data.text, info: JSON.stringify(info), shot: shot.ok ? shot.text : null }],
    storage,
  );
  if (r.imported.length) return { ok: true, key: r.imported[0] };
  // SKIPPED IS NOT A FAILURE. SP1's law skips a save the store already
  // holds, and a player who presses Restore on a save they already have
  // has lost nothing - saying "already here" is the truth and an error
  // is not.
  if (r.skipped) return { ok: true, key: null, skipped: true };
  return { ok: false, error: 'no-room' };
}

/**
 * ACC2c — THE CARDS THIS DEVICE HAS NO SAVE FOR.
 *
 * ACC2 built the backup and nothing could ever read one back: `pullSlot`
 * was written, pinned end to end against the real service, and had ZERO
 * CALLERS, because a cloud card only ever reached a player through the
 * cloud LINE on a local tile - and a card with no local tile has no line
 * to appear on. So a player who cleared their browser, or sat down at a
 * second device, saw an empty save list with their games sitting in R2
 * three feet away and nothing on screen admitting they existed.
 *
 * THE ANSWER IS A SET DIFFERENCE AND IT LIVES HERE, not in the menu:
 * AUDIT-312 F3's finding was that `ui/enhancedMenu.js` is DOM and a
 * boot, so arithmetic written there is arithmetic no pin can drive -
 * three mutants of exactly that kind went through the whole suite
 * untouched. The key is `slotKeyOf`'s, so this asks the question the
 * same way the cloud LINE asks it and the two cannot drift: a card that
 * matches a local slot gets a line on that slot's tile, and a card that
 * matches none gets a tile of its own.
 *
 * @param {Array<any>|null|undefined} cards the service's listing
 * @param {Array<any>|null|undefined} saves this device's slots, in the
 *        shape the panes list them (`characterId` and `saveName`)
 */
export function cloudOnly(cards, saves) {
  const here = new Set((saves ?? []).map((s) => slotKeyOf(s)));
  return (cards ?? []).filter((c) => c?.characterId && c?.saveName && !here.has(slotKeyOf(c)));
}

/** THE PLAYER'S OWN DELETE, and the only thing on this side that
 *  removes a cloud slot. It never touches the local store: the cloud is
 *  the copy, so deleting the copy is not deleting the save. */
export const removeCloudSlot = (io, { characterId, saveName }) =>
  ask(io, slotPath(characterId, saveName), { method: 'DELETE' });
