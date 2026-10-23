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

/** @typedef {{ shown: () => boolean, warm: () => Promise<any>, read: (o?: { again?: boolean }) => Promise<any>, view: () => any, error: () => (string|null), errorText: () => string,
 *   version: () => number, items: () => any[], slotOf: (item: any) => (number|null), slots: () => { used: number, max: number }, reach: () => boolean,
 *   busy: () => boolean, standing: () => any }} GuildVaultDoor */

/** A row's key: the slot, when its piece was put there and how many - a slot emptied and filled again is another row. */
const rowKey = (row) => `${row.slot}|${row.at}|${row.count}`;

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
