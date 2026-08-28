// BS1 - THE GUILD LIBRARY BOOKSHELF (Internal/DaggerfallBookshelf.cs,
// MIT Daggerfall Workshop / Hazelnut). "Bookshelves in building
// interiors which allow reading books" - the component DFU adds to a
// shelf model (41000 + the shop-shelf indices) laid out inside a
// LIBRARY, GUILDHALL or TEMPLE (DaggerfallInterior.cs:808-814), where
// the same model in a shop becomes shop shelves and in an owned house
// a container.
//
// TWO LAWS, both here:
//
//   Start() (:26-38) - a shelf holds UP TO ten random books: ten
//   draws of GetRandomBookID, and a draw whose title resolves EMPTY
//   is dropped rather than redrawn, so a shelf can hold fewer. The
//   list is minted once per shelf and kept.
//
//   ReadBook() (:66-89) - ONLY a GuildHall or Temple consults the
//   guild (CanAccessLibrary: Mages rank >= 2, a temple's own library
//   rank); a refused reader gets the accessMembersOnly box. A LIBRARY
//   building never gates - a public library is public - and neither
//   does any other type the layout ever hands this component. An
//   allowed reader gets the title picker, and a pick opens the book
//   reader on that id.

import { getRandomBookID, bookTitle } from './books.js';
import { canAccessLibrary } from './guildServices.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';

export const BOOKSHELF_CAPACITY = 10;

/** Start() (:26-38): the shelf's ten draws, empty titles dropped. */
export function populateBookshelf(rolls = Math.random) {
  const books = [];
  for (let i = 0; i < BOOKSHELF_CAPACITY; i++) {
    const id = getRandomBookID(rolls);
    if ((bookTitle(id) ?? '') !== '') books.push(id);
  }
  return books;
}

/** ReadBook()'s gate (:68-80). `guild`/`membership` are the building
 *  faction's, resolved by the caller the way GetGuild(factionID)
 *  resolves DFU's - a null guild is a hall the dict cannot name, and
 *  DFU's GetGuild never returns null (the nonmember instance), so the
 *  honest read is the nonmember answer: refused. */
export function bookshelfAccess({ buildingType, guild = null, membership = null }) {
  if (buildingType === BUILDING_TYPES.GuildHall || buildingType === BUILDING_TYPES.Temple) {
    if (!guild || !canAccessLibrary(guild, membership)) {
      // Internal_Strings.csv, accessMembersOnly - VERBATIM from the
      // pinned clone's own CSV (the F116 convention).
      return { allowed: false, text: 'You need to be a member of sufficient rank to access this.' };
    }
  }
  return { allowed: true };
}

/** The picker rows: each id's title (the Setup loop, :60-64 - the
 *  window re-reads GetBookTitle per row; the port's mapping is the
 *  same lookup Start filtered on, so no row can be empty). */
export const bookshelfTitles = (books) => books.map((id) => bookTitle(id) ?? '');
