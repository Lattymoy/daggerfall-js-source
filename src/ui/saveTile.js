// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TILE1 — THE SAVE TILE.
//
// Mac (2026-09-22): "I want [the Online pane] reserved for a detailed
// tile based design for your saves which will translate to the load
// character pane also. Basically showing your portrait and character
// information."
//
// ═══ ONE TILE, THREE PANES ═════════════════════════════════════════
//
// Online, Load Game and Save Game all list the same slots and all drew
// their own `card slot` - the same four lines three times, which is
// how three panes come to disagree about what a save IS. This is that
// card, made detailed and given a face, and the panes hand it their
// own ACTIONS. Nothing about a pane is known here.
//
// ═══ WHAT IS ON IT, AND WHAT IS DELIBERATELY NOT ═══════════════════
//
// Mac, on the account card two hours earlier: "Nothing is centered,
// there's uneeded text explaining what an account is". So a tile
// carries FACTS ABOUT A CHARACTER and no prose at all:
//
//   the face        who this is, before any word is read
//   the name        and under it race, class and level
//   the moment      the in-game date and hour the save was taken at
//   the slot        its name, as a quiet tag
//   two numbers     health and gold, the pair every card already had
//   the cloud       one line, and only when there is an account
//   the actions     the pane's own, and a Delete where it belongs
//
// ═══ THE FACE IS AN ARGUMENT, NOT AN IMPORT ════════════════════════
//
// `ui/facePortrait.js` needs the player's Daggerfall files and a
// browser canvas, and neither exists in a node test. So the tile takes
// the face as a value - a canvas, a Promise of one, or null - which is
// the same seam `enhancedChargen.js` uses for the same art and the
// reason the whole tile can be driven in node.
//
// A TILE WITH NO FACE IS AN ORDINARY TILE. No CIF, no data source, a
// save from before faces were stored: the well draws the character's
// initial and the tile is otherwise unchanged. The chargen wizard's own
// law ("NEVER TRAPS"), on a surface a player reaches far more often.
// ═══════════════════════════════════════════════════════════════════

/** The cloud states a tile can be in. `off` draws no cloud line at all
 *  - ACC0's wall is at cloud saves, and a player with no account is not
 *  nagged on every tile about a feature they have not asked for.
 *
 *  `wait` is AUDIT-312 F2's: a card written before CHARID1 has no
 *  character id, so it cannot be filed in the cloud YET - it is adopted
 *  the first time its character loads. That is a sentence to read, not
 *  a failure and not a button. */
export const CLOUD_STATES = Object.freeze(['off', 'none', 'saved', 'busy', 'bad', 'wait']);

/**
 * ═══ THE CLOUD LINE'S STATE, DECIDED WHERE NODE CAN REACH IT ═══════
 *
 * AUDIT-312 F3: this decision lived inside `ui/enhancedMenu.js`, which
 * is DOM and a boot and which no node pin can drive - so three mutants
 * that change what a player is told about their own backup all
 * SURVIVED the whole suite (an unfinished upload reading as a finished
 * one, a listing that is never re-asked after a push, and every
 * character's QuickSave sharing one slot key). The menu keeps the
 * effects; the decision is here, pure, beside the states it names.
 *
 * IT RETURNS A REFUSAL WORD AND NOT A SENTENCE. `accountClient.js` owns
 * the sentences - one word, one sentence - and this file owns no words
 * about the cloud at all.
 *
 * @param {object} [q]
 * @param {boolean} [q.signedIn]     there is an account on this device
 * @param {string|null} [q.characterId]  CHARID1's id, or null on a legacy card
 * @param {{bytes?: number, updatedAt?: number}|null} [q.card]  the service's own row for this slot
 * @param {boolean} [q.busy]         a push is in flight for THIS slot
 * @param {string|null} [q.error]    the refusal the last push for THIS slot ended in
 * @param {number} [q.nowS]          seconds, as the card's `updatedAt` is
 * @returns {{state: string, when: string|null, error: string|null}}
 */
export function cloudStateOf({ signedIn = false, characterId = null, card = null, busy = false, error = null, nowS = 0 } = {}) {
  if (!signedIn) return { state: 'off', when: null, error: null };
  // A LEGACY CARD IS A WAIT, NOT A WALL, and the refusal table has
  // always had the sentence for it - before this it had no surface that
  // could ever show it, because the tile fell straight to `off`.
  if (!characterId) return { state: 'wait', when: null, error: 'no-character' };
  if (busy) return { state: 'busy', when: null, error: null };
  if (error) return { state: 'bad', when: null, error };
  // `bytes` STAYS 0 UNTIL THE DATA LANDS (server-account/src/saves.js).
  // A card alone is an upload that died between the row and the blob,
  // and the service keeps that visible on purpose - reading it as a
  // backup is how a player trusts a restore that cannot happen.
  if (card && (card.bytes ?? 0) > 0) return { state: 'saved', when: agoText(card.updatedAt, nowS), error: null };
  return { state: 'none', when: null, error: null };
}

/** How long ago, in words a player reads at a glance. Seconds in,
 *  because that is what the service's card carries (`updatedAt`). */
export function agoText(thenS, nowS) {
  if (!Number.isFinite(thenS) || !Number.isFinite(nowS)) return '';
  const d = Math.max(0, Math.floor(nowS - thenS));
  if (d < 90) return 'just now';
  // FLOOR, NOT ROUND, and the reason is that rounding made the singular
  // unreachable: past the 90-second threshold `Math.round(d / 60)` is
  // never 1, so "1 minute ago" was a branch nothing could reach. It is
  // also the more honest direction - an hour and fifty minutes reading
  // as "1 hour ago" overstates nothing, and "2 hours ago" would.
  const m = Math.floor(d / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(d / 3600);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(d / 86400);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** The line under the name: what a player would say about a character.
 *  Empty parts drop out rather than leaving a dangling separator. */
export const tileLine = (save) => [
  save?.race ?? null,
  save?.career ?? null,
  save?.level ? `level ${save.level}` : null,
].filter(Boolean).join(' · ');

/** ...and the line under THAT: when, in the world's own calendar. */
export const tileWhen = (save) => [save?.when ?? null, save?.hour ?? null].filter(Boolean).join(' · ');

/** A character's initial, for the well when there is no portrait. Not
 *  a silhouette and not a question mark: a letter reads as "this is
 *  somebody" rather than as a broken image. */
export const initialOf = (save) => (String(save?.name ?? '').trim()[0] ?? '?').toUpperCase();

/**
 * @param {Document} doc
 * @param {{name?: string, race?: string, career?: string, level?: number, health?: number,
 *          maxHealth?: number, gold?: number|null, when?: string|null, hour?: string|null,
 *          saveName?: string}} save  one row of the pane's own save list - every field
 *        optional, because a card can come from an older build (saveSlots.js's
 *        `SaveInfo` typedef says the same about its own, for the same reason)
 * @param {object} [opts]
 * @param {Array<{label: string, primary?: boolean, disabled?: boolean, onClick?: Function|null}>} [opts.actions]
 * @param {{state?: string, when?: string|null, why?: string|null, actions?: Array<any>}|null} [opts.cloud]
 * @param {HTMLCanvasElement|Promise<HTMLCanvasElement|null>|null} [opts.face]
 * @param {boolean} [opts.current]  this is the slot the pane is ABOUT (the most recent, the one being overwritten)
 */
export function saveTile(doc, save, { actions = [], cloud = null, face = null, current = false } = {}) {
  const el = (t, cls, txt) => {
    const n = doc.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  const root = el('div', `svtile${current ? ' sv-current' : ''}`);

  // ── THE FACE ────────────────────────────────────────────────────
  const well = el('div', 'svface');
  const fallback = el('span', 'svinitial', initialOf(save));
  well.append(fallback);
  const waited = /** @type {Promise<HTMLCanvasElement|null>|null} */ (
    face && typeof (/** @type {any} */ (face).then) === 'function' ? face : null);
  if (waited) {
    // NOT AWAITED. The tile has to be on screen before the art is: a
    // list that waits for ten CIF reads is a menu that opens late, and
    // the well already draws something.
    waited.then((art) => { if (art) { fallback.remove(); well.append(art); } }).catch(() => {});
  } else if (face) {
    fallback.remove();
    well.append(/** @type {HTMLCanvasElement} */ (face));
  }
  root.append(well);

  // ── WHO, AND WHEN ───────────────────────────────────────────────
  const who = el('div', 'svwho');
  // THE NAME AND THE SLOT SHARE ONE ROW, and they share it by FLEX
  // rather than by one of them being absolutely positioned over the
  // other. The first cut pinned the slot to the tile's corner and
  // "Mithriil Stormaire" / "a very long slot name indeed" ran into each
  // other - measured, not eyeballed. Sharing a row means the slot
  // simply gives way to a long name and ellipsises, which is the right
  // order of precedence: the character is who you are looking for.
  const top = el('div', 'svtop');
  top.append(el('h3', null, save?.name || 'Unnamed'));
  if (save?.saveName) top.append(el('span', 'svslot', save.saveName));
  who.append(top);
  const line = tileLine(save);
  if (line) who.append(el('p', 'svsub', line));
  const when = tileWhen(save);
  if (when) who.append(el('p', 'svwhen', when));

  const dl = el('dl', 'stats');
  const row = (k, v) => { if (v != null) dl.append(el('dt', null, k), el('dd', null, String(v))); };
  row('Health', save?.maxHealth ? `${save.health} / ${save.maxHealth}` : save?.health);
  row('Gold', Number.isFinite(save?.gold) ? save.gold.toLocaleString() : null);
  if (dl.childNodes.length) who.append(dl);
  root.append(who);

  // ── THE FOOT ────────────────────────────────────────────────────
  // The cloud line and the actions live in one box so the grid can
  // push them to the BOTTOM of the tile. Without it every tile's
  // buttons sit wherever its own text happened to end, and a row of
  // tiles of equal height has its buttons at four different heights -
  // measured, and it reads as four misaligned cards rather than a row.
  const foot = el('div', 'svfoot');

  // ── THE CLOUD, ONE LINE ─────────────────────────────────────────
  if (cloud && cloud.state && cloud.state !== 'off') {
    const state = CLOUD_STATES.includes(cloud.state) ? cloud.state : 'none';
    const bar = el('div', `svcloud is-${state}`);
    const said = {
      none: 'Not backed up',
      saved: cloud.when ? `Backed up · ${cloud.when}` : 'Backed up',
      busy: 'Backing up…',
      // A REFUSAL IS THE SERVICE'S OWN SENTENCE, handed in - this file
      // owns no words about why a backup failed.
      bad: cloud.why || 'Could not back up',
      // ...and the same for a WAIT. AUDIT-312 F2: the sentence for a
      // pre-CHARID1 card has existed since ACC2b and had no surface
      // that could show it, because the tile fell straight to `off`.
      wait: cloud.why || 'Not backed up yet',
    }[state];
    bar.append(el('span', 'svsay', said));
    for (const a of cloud.actions ?? []) bar.append(actionButton(el, a));
    foot.append(bar);
  }

  // ── THE PANE'S OWN ACTIONS ──────────────────────────────────────
  if (actions.length) {
    const row2 = el('div', 'acts');
    for (const a of actions) row2.append(actionButton(el, a));
    foot.append(row2);
  }
  if (foot.childNodes.length) root.append(foot);
  return root;
}

function actionButton(el, a) {
  const b = el('button', `act${a.primary ? ' primary' : ''}`, a.label);
  b.type = 'button';
  if (a.disabled) b.disabled = true;
  if (a.onClick && !a.disabled) b.onclick = a.onClick;
  return b;
}
