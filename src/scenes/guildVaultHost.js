// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD-PANE (2026-10-23, Travis: "we should be able to view items in the guild storage similar to the wagon, guild
// stores should be shared in a similar manner to a players own stores so people can easily add and remove items they
// want to share with the guild") - THE GUILD VAULT AS THE PACK'S PANE SEES IT (bible/11-Multiplayer/Guild-Overhaul.md
// GUILD-PANE).
//
// The vault is the guild's shelf on the account service, read through the guild book (net/guild/guildBook.js
// readVault / vaultNow) and moved by its vaultPut / vaultTake - the Social page's own hands. The pack's pane (ui/enhanced/
// enhancedInventory.js, remoteModel's `vault`) is a second face on the SAME book: this module is the door between them, a
// host module the host wires (HOST-SPLIT: the hosts do not grow - scenes/fishHost.js is the shape), so the pane reads a
// vault as it reads a wagon - a list of items - and never learns of the book.
//
// THE ROWS ARE VIEWS. Each row the service answers (its record, its count, who put it in, when) becomes an item the pane
// can draw - `setItemFields` over a copy of the record - kept in a Map by `slot|at|count`, so a row keeps ONE object
// between repaints (the pack keys its pick, its virtual rows and its cards by item identity). These objects are never
// pushed into a save's list and never moved by the transfer ladder: the vault's pieces move through the book alone.
//
// Not a DFU member (Ledger A: the guild vault is the port's own). Pure but for the book it is handed: no DOM, no clock.
import { setItemFields } from '../systems/item/itemTemplates.js';
import { accountRefusalText } from '../net/accountClient.js';
import { vaultMayPut, vaultMayTake } from '../net/guild/guildVaultLaw.js';
import { vaultPutRefusal } from '../net/guild/guildVaultPut.js';
import { t } from '../systems/textManager.js';

/** @typedef {{ shown: () => boolean, warm: () => Promise<any>, read: (o?: { again?: boolean }) => Promise<any>, view: () => any, error: () => (string|null), errorText: () => string,
 *   version: () => number, items: () => any[], slotOf: (item: any) => (number|null), slots: () => { used: number, max: number }, reach: () => boolean,
 *   busy: () => boolean, standing: () => any, mine: (item: any) => boolean, mayPut: () => boolean, mayTake: (item: any) => boolean,
 *   putRefusal: (item: any) => (string|null), reachText: () => string, take: (item: any, count?: (number|null)) => Promise<{ ok: boolean, error?: string, text?: string }>,
 *   put: (item: any, count?: (number|null)) => Promise<{ ok: boolean, error?: string, text?: string }>,
 *   takeGate: (item: any, count?: (number|null)) => ({ ok: boolean, error: string, text: string }|null),
 *   putGate: (item: any, count?: (number|null)) => ({ ok: boolean, error: string, text: string }|null) }} GuildVaultDoor */

/** The Social page's reach note (ui/socialPanel.js GUILD_VAULT_REACH_TEXT - one sentence, one key, two faces). */
const VAULT_REACH_TEXT = 'You can use the vault in any town or a guild caravan. View it here; put items in and take them out in town or in a guild caravan.';
/** The words of the two gates the door keeps itself; every other refusal is the account's (net/accountClient.js). */
const gateWords = (error) => (error === 'vault-reach' ? t('social.vault.reach', VAULT_REACH_TEXT)
  : error === 'vault-busy' ? t('inventory.vault.busy', 'A moment.') : accountRefusalText(error));
/** A piece's stack: its count, or one. */
const stackOf = (item) => (Number.isSafeInteger(item?.stackCount) && item.stackCount >= 1 ? item.stackCount : 1);
const refused = (error, text = null) => ({ ok: false, error, text: text ?? gateWords(error) });

/** A row's key: the slot, when its piece was put there, how many, and the piece itself - a slot emptied and filled again is
 *  another row. REVIEW R2-2: the record too (AUDIT GUILD2 G1's law on the service): a slot emptied and filled in the same
 *  second with a stack of the same count kept the old piece's view, drawn under the old name, its take the new piece. */
const rowKey = (row) => `${row.slot}|${row.at}|${row.count}|${JSON.stringify(row.rec ?? null)}`;

/**
 * THE DOOR: `book` the guild book (or a function answering it - the host's book is made late), whose vault the pane shows.
 * Every method is total: a book that is gone, a guild that is gone or a character that moved answers nothing to show.
 * @param {{ book: any }} opts
 * @returns {GuildVaultDoor}
 */
export function createGuildVaultDoor({ book }) {
  const bookNow = () => (typeof book === 'function' ? book() : book) ?? null;
  /** @type {Map<string, any>} the views kept by row key - the last view's alone */
  let kept = new Map();
  const slotsOf = new WeakMap();
  /** @type {WeakMap<object, any>} the row (as the service answered it) each view stands for */
  const rowsOf = new WeakMap();
  /** @type {any} the view the items were last made from, and the items */
  let madeFrom = null;
  /** @type {any[]} */
  let made = [];
  /** @type {Promise<any>|null} */
  let reading = null;

  const door = {
    /** A vault to show: a guild, a realm character playing, online (the book is only made online) - the pane's button is drawn for this alone. */
    shown() {
      const b = bookNow();
      return !!(b && b.realm && b.pack && b.guild?.id && (b.character?.() ?? null));
    },
    /** The guild looked at again when the last look is old - once a mount, so a pack opened before the guild was known still finds it. */
    warm() {
      const b = bookNow();
      return b && b.stale?.() ? Promise.resolve(b.refresh()).catch(() => {}) : Promise.resolve();
    },
    /** The vault read. A read already out is the one answered unless `again` (Try again asks again); the book keeps the last asked (K14). */
    read({ again = false } = {}) {
      const b = bookNow();
      if (!b || !door.shown()) return Promise.resolve({ ok: false, error: 'guild-character' });
      if (reading && !again) return reading;
      const mine = Promise.resolve(b.readVault()).catch(() => ({ ok: false, error: 'server' }));
      reading = mine;
      mine.then(() => { if (reading === mine) reading = null; });
      return mine;
    },
    /** The view as the last read said it - this character's and this guild's alone (the book's M3), else null: reading, or failed. */
    view() {
      const b = bookNow();
      return b && door.shown() ? b.vaultNow() ?? null : null;
    },
    /** The last read's refusal while no view stands, and only the one that was this character's and this guild's. */
    error() {
      const b = bookNow();
      if (!b || !door.shown() || b.vaultNow()) return null;
      return b.vaultFor === `${b.character?.() ?? null}|${b.guild?.id ?? ''}` ? b.vaultError ?? null : null;
    },
    /** The refusal in words (the account's sentences, net/accountClient.js). */
    errorText() {
      const e = door.error();
      return e ? accountRefusalText(e) : '';
    },
    /** The book's version: it moves with every act and read, and the pane repaints when it does. */
    version: () => bookNow()?.version ?? 0,
    /** The view's rows as items the pane draws, one object a row between repaints (above). */
    items() {
      const v = door.view();
      if (!v) { madeFrom = null; made = []; kept = new Map(); return made; }
      if (v === madeFrom) return made;
      const next = new Map();
      const out = [];
      for (const row of Array.isArray(v.items) ? v.items : []) {
        const key = rowKey(row);
        let item = kept.get(key);
        if (!item) {
          if (!row.rec || typeof row.rec !== 'object' || Array.isArray(row.rec)) continue;   // a record that cannot be an item has no row to draw
          try {
            item = setItemFields({ ...row.rec, ...(row.count > 1 ? { stackCount: row.count } : {}) });
          } catch (e) { console.warn('[guild] a vault piece could not be drawn', e?.message ?? e); continue; }
          slotsOf.set(item, row.slot);
          rowsOf.set(item, row);
        }
        next.set(key, item);
        out.push(item);
      }
      kept = next; madeFrom = v; made = out;
      return out;
    },
    /** The slot a pane item stands for, or null for anything that is not one of this door's rows. */
    slotOf: (item) => (slotsOf.has(item) ? slotsOf.get(item) : null),
    /** The shelves: how many are used and how many there are (fifty, a hall's fifty more). */
    slots() {
      const v = door.view();
      return { used: Array.isArray(v?.items) ? v.items.length : 0, max: Number.isSafeInteger(v?.max) ? v.max : 0 };
    },
    /** Whether the vault is reached here: a town, a guild caravan (the host's pack.reach); a pack that says nothing reaches it, as the Social page reads it. */
    reach() {
      const b = bookNow();
      return !!b?.pack && b.pack.reach?.() !== false;
    },
    busy: () => !!bookNow()?.busy,
    /** This member's standing at the vault, as the last read said it (`{ level, limit, granted, taken }`), or null. */
    standing: () => door.view()?.me ?? null,
    /** Whether a row is this character's own deposit (the service says so - `mine`; an older service says nothing: not mine). */
    mine: (item) => rowsOf.get(item)?.mine === true,
    /** Whether this member's standing puts in. */
    mayPut: () => vaultMayPut(door.standing()),
    /** Whether this member may take the row: its own deposit at any standing, else the rank and the day's limit. */
    mayTake(item) {
      const st = door.standing();
      return door.mine(item) || vaultMayTake(st, Number(st?.taken ?? 0));
    },
    /** Why this piece of the pack can never go in (the one law, net/guild/guildVaultPut.js), in words - or null. */
    putRefusal: (item) => vaultPutRefusal(item, bookNow()?.pack ?? null),
    reachText: () => gateWords('vault-reach'),
    /**
     * A ROW TAKEN OUT: `count` of its stack (all of it where absent). The gates the Social page keeps, once, here: the
     * reach, a book that is busy (one act at a time), the standing (the rank, the day's limit - neither asked of the member's
     * own deposit, which comes back at any standing), the count. Then the book's vaultTake: the piece is in the pack on the
     * service's answer, whether or not a pane is still up to hear it. `{ ok, error?, text? }`.
     */
    async take(item, count = null) {
      const b = bookNow();
      const no = door.takeGate(item, count);
      if (no || !b) return no ?? refused('guild-vault-empty');
      const stack = stackOf(item);
      const r = await b.vaultTake(door.slotOf(item), (count ?? stack) === stack ? null : count);
      return r?.ok ? { ok: true } : refused(r?.error ?? 'server');
    },
    /** The gates a take passes before the book is asked, as a refusal `{ ok: false, error, text }` - or null: it may go. Synchronous, so a press is answered in the frame it is made. */
    takeGate(item, count = null) {
      if (!door.view() || door.slotOf(item) == null) return refused('guild-vault-empty');
      // REVIEW R2-1: and still the shelf's - a row drawn before a read (the poll's gap) or a card left open keeps its slot, and
      // the book takes by the slot as the CURRENT view holds it: a slot emptied and filled again is another piece, never this one
      if (!door.items().includes(item)) return refused('guild-vault-moved');
      if (!door.reach()) return refused('vault-reach');
      if (door.busy()) return refused('vault-busy');
      if (!door.mine(item)) {
        const st = door.standing();
        if (st?.level !== 'withdraw') return refused('guild-vault-rank');
        if (!vaultMayTake(st, Number(st.taken ?? 0))) return refused('guild-vault-limit');
      }
      const n = count ?? stackOf(item);
      return !Number.isSafeInteger(n) || n < 1 || n > stackOf(item) ? refused('bad-vault-count') : null;
    },
    /**
     * A PIECE OF THE PACK PUT IN: `count` of its stack (all of it where absent). The reach, busy, the standing (a member
     * who puts in), the law of the piece (vaultPutRefusal), a free slot - in that order - then the book's vaultPut, which takes
     * the piece out of the pack at once and puts it back on a refusal. `{ ok, error?, text? }`.
     */
    async put(item, count = null) {
      const b = bookNow();
      const no = door.putGate(item, count);
      if (no || !b) return no ?? refused('guild-vault-empty');
      const stack = stackOf(item);
      const r = await b.vaultPut(item, (count ?? stack) === stack ? null : count);
      return r?.ok ? { ok: true } : refused(r?.error ?? 'server');
    },
    /** The gates a put passes (take's twin): reach, busy, a shelf read, the standing, the piece's law, a free slot, the count. */
    putGate(item, count = null) {
      if (!bookNow() || !door.shown()) return refused('guild-vault-empty');
      if (!door.reach()) return refused('vault-reach');
      if (door.busy()) return refused('vault-busy');
      if (!door.view()) return refused('guild-vault-empty');
      if (!door.mayPut()) return refused('guild-vault-rank');
      const why = door.putRefusal(item);
      if (why) return refused('vault-goods', why);
      if (door.slots().used >= door.slots().max) return refused('guild-vault-full');
      const n = count ?? stackOf(item);
      return !Number.isSafeInteger(n) || n < 1 || n > stackOf(item) ? refused('bad-vault-count') : null;
    },
  };
  return door;
}

/** The door for a book, made once - the host hands the book it holds now and the door is the same object each time. */
const _doors = new WeakMap();
export function guildVaultDoorFor(book) {
  if (!book || typeof book !== 'object') return null;
  let door = _doors.get(book);
  if (!door) _doors.set(book, (door = createGuildVaultDoor({ book })));
  return door;
}

/** The book the world host holds (scenes/world.js makes one, online) and its door - the pack of every mode that has a
 *  guild vault to show reads them from here, so the hosts hand nothing down (HOST-SPLIT: the hosts do not grow). */
let _held = /** @type {any} */ (null);
/** The host's book, held; answers it, so the host's one construction line holds it as it makes it. */
export function holdGuildBook(book) {
  _held = book ?? null;
  return book;
}
/** The held book's door, or null where no book is held (offline, a standalone page). */
export const heldGuildVaultDoor = () => guildVaultDoorFor(_held);
