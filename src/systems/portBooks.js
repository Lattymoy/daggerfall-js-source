// @ts-check
// WB12c (2026-10-01, Mac: "shops, libraries and the first breach" for the book): THE PORT'S OWN BOOKS - books the
// classic table never had, written into the BOK format's own bytes (formats/bookFile.js) so the reader, the raum-book
// face, the item's title and its price read them as they read a classic book. The classic table baked from DFU
// (systems/booksData.js) is never touched: a port book's id is above every classic one, its low byte no classic
// book's (the filename law reads the low byte - BOK%05d.TXT), and the one door (ui/bookDoor.js) reads it here before
// it asks for a file. Design: bible/11-Multiplayer/World-Bosses.md section 19 C; the text is its appendix.
//
// Not a DFU member. Ledger A (WB).
import { RSC } from '../formats/textRsc.js';
import { BookFile, messageToBookFilename } from '../formats/bookFile.js';
import { getSeed, setSeed } from '../formats/dfRandom.js';

/** WB12c: On the Burning Doors - id 417 (the year), a Mages Guild conjurer's account of the breaches. */
export const BURNING_DOORS_ID = 417;
/** GUN-LORE (2026-10-24; bible/05-Combat/Dwarven-Thunderlock.md "GUN-LORE"): Rourken Thunder - id 418, a Sentinel
 *  antiquarian's account of the Dwemer guns and the shot they throw. */
export const ROURKEN_THUNDER_ID = 418;
/** KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md): The Ketch That Never Lands - id 419, the same antiquarian's
 *  account of the Rourken sky-ketch Mzunthar, which keeps station over Daggerfall once a real week (net/ketch/ketchLaw.js) -
 *  never the online calendar's Loredas (it runs twelve days a real day), so the book names no day (AUDIT KETCH L5-3). */
export const KETCH_BOOK_ID = 419;

/**
 * A port book: its header's title and author, and its pages - each a list of rows, a row a paragraph the reader wraps
 * (`center` for a centred one, `font` a FontPrefix face - BOOK_TITLE_FONT) or '' for an empty line.
 * @typedef {{ title: string, author: string, pages: ReadonlyArray<ReadonlyArray<string|{ text: string, center?: boolean, font?: number }>> }} PortBook
 */

/** The face a title page sets: FontPrefix 5, FONT0004 (ui/bookReader.js BOOK_FONT_NAMES, ui/enhanced/enhancedBook.js
 *  FACE_OF_PREFIX). The empty line under it puts the reader back in its own face. */
export const BOOK_TITLE_FONT = 5;

/** @type {(head: string, text: string) => ReadonlyArray<string|{ text: string, center?: boolean }>} */
const section = (head, text) => Object.freeze([{ text: head, center: true }, '', text, '']);

/** A port book, frozen and typed as one (the map's entries each a PortBook, never the first entry's literal type). */
const book = (/** @type {PortBook} */ b) => /** @type {PortBook} */ (Object.freeze(b));

/** @type {ReadonlyMap<number, PortBook>} */
export const PORT_BOOKS = new Map([[BURNING_DOORS_ID, book({
  title: 'On the Burning Doors',
  author: 'Ysolde Marnhel',
  pages: Object.freeze([
    Object.freeze([
      { text: 'On the Burning Doors', center: true, font: BOOK_TITLE_FONT }, '',
      { text: 'by Ysolde Marnhel', center: true },
      { text: 'Master Conjurer of the Mages Guild, Wayrest', center: true }, '',
      'Every day now, somewhere in the wilds of the Bay, the sky catches fire. Herders swear to a door of black stone that rises where no stone stood, its arch full of flame, and to a lord of the Deadlands who waits within. The common folk call these the doors of Oblivion and bar their shutters. They are right to bar them, and wrong about nearly everything else.',
      '',
    ]),
    section('The Covenant', 'Since the days of Saint Alessia, Akatosh has kept a covenant with the blood of the Emperors. While a Septim wears the Amulet of Kings and the Dragonfires burn in the Temple of the One, no Prince of Oblivion may force his way into Tamriel. Our Emperor Uriel, seventh of that name, sits the Ruby Throne, and the fires burn. No invasion comes. But the Covenant was made to bar a door forced from without. It was never made to bar a door opened from within. Every apprentice who calls a scamp into a circle proves as much, and every coven of the Bay that calls a Prince on his own day proves it more loudly.'),
    section('The faithful', 'Mehrunes Dagon, Prince of Destruction, has never lacked for worshipers in a land as quarrelsome as ours. His faithful keep to the wilds, and to a rite older than Wayrest. They gather about a ring of braziers, burn his sigil into the earth, and bleed for him. What opens is not a gate as the Daedra raise them in their own realms. It is a breach: a wound in the world, held open by the will of the Prince and the blood of his faithful, and by nothing else.'),
    section('The Warden', 'No Prince walks through such a wound himself. He sends a lord of his house to hold it, a Dremora of the rank they call valkynaz, and the one who answers most often in our Bay names himself Ruhn. Among the faithful he is the Warden of the Burning Gate. I have spoken with three who stood before him and lived. They agree that he is very large, that he burns, and that he does not tire.'),
    section('Why the doors close', 'Here the Covenant shows its teeth. A breach is a door the Dragonfires did not permit, and they will not suffer it long. From the hour it opens the Covenant presses upon it like a hand upon a wound. Within two hours it is sealed; two hours after, it collapses entirely, and whatever of Dagon\'s remains on our side is cast back into the Deadlands. Should the Warden fall before then, the breach fails at once. It is his will that holds the door.'),
    section('The Battlespire', 'I am asked whether the Prince has done such a thing before. He has, and worse. In the years of the false Emperor his legions took the Battlespire itself, where the Empire trained its battlemages, and held it until a single apprentice drove them out. Not since the Battlespire fell has Dagon found doors so wide as these.'),
    section('The embers', 'Those who close a breach carry out coals of its fire. They do not cool and they do not go out, and in the Guild we call them Deadlands embers. The Guild will buy them for study. A certain Broker of the wilds pays better, and asks fewer questions.'),
    section('Counsel', 'If you would close a door, find the faithful first. Their circle stands within sight of where the breach will open, and their smoke rises with the first omen. No one coven opens a breach - the Prince presses on that place from his side, and the faithful only widen the wound - so their door will open whatever you do. But cut down their Summoner before the rite is done, and the fire of the broken rite clings to those who broke it: when the door is closed, it pays each of them an ember more. What the faithful keep in their circle is yours as well. Do not go alone. Do not stand where the ground glows. And when the Covenant closes the door, do not be on the wrong side of it.'),
  ]),
})], [ROURKEN_THUNDER_ID, book({
  title: 'Rourken Thunder',
  author: 'Imrah Bel-Tavir',
  pages: Object.freeze([
    Object.freeze([
      { text: 'Rourken Thunder', center: true, font: BOOK_TITLE_FONT }, '',
      { text: 'On the Guns of the Dwemer, and the Shot They Throw', center: true }, '',
      { text: 'by Imrah Bel-Tavir', center: true },
      { text: 'Antiquarian of Sentinel', center: true }, '',
      'Every curio dealer between Sentinel and Wayrest will tell you he once held a Dwemer gun, and every one of them will tell you it was a kind of crossbow. It was not. I have held three, taken one apart, and lost the use of two fingers for a season to the fourth. What follows is what I have learned of them, and of the little brass beads they eat.',
      '',
    ]),
    section('The Rourken', 'The Dwemer who made these were not the Dwemer of Morrowind. When the Deep Folk of the east took the Chimer for allies, one clan would not. Their lord, Rourken, threw his hammer Volendrung out of Morrowind and swore his people would build wherever it came down. It came down in the Alik\'r, and there they built Volenfell, the City of the Hammer. The Rourken were a hard clan, a clan of soldiers and sailors, and their works are hard things. They went where every other Dwemer went, at Red Mountain, and they left their works behind them.'),
    section('The tonal art', 'The Dwemer made the world obey a struck note. Their scholars called it tonal architecture: a tone pitched truly to a thing will move it, mend it or unmake it, as a singer\'s note will break a glass. Kagrenac\'s Keening and Sunder were its greatest works, and they ended the Dwemer. The guns of the Rourken are its smallest, and they have ended a great many other people.'),
    section('The coil', 'Open the lock of a Dwemer gun, if you have a steadier hand than mine, and you will find no flint, no pan and no powder. You will find a coil of tuned brass and crystal, wound tight by a little key, and a striker held off it by the trigger. Pull the trigger and the striker falls, and the coil sings. It sings one note, and only one, and then it must be wound again. That is what a gunner is doing when he turns the key between his shots: he is not loading the gun. He is tuning it.'),
    section('The bead', 'The shot is the bead the Dwemer called a pellet: a pea of their brass, sealed around a mote of aetherium, the blue crystal they mined and fought over. The mote holds a charge as a cloud holds a storm. The coil\'s note is pitched to that mote and no other thing, and when it sounds the charge comes unbound. The bead leaves the barrel not as lead but as lightning, a ball of it, and it strikes as a storm strikes. That is why the flash of the gun is the colour of its shot: they are one light. And that is why the report is so loud. The thunder you hear is the note.'),
    section('The long gun and the short', 'The Rourken made two guns that I know of. The long one, which our dealers call a thunderlock, was the Tonal Guard\'s: a heavy gun for two hands, its long coil singing a deep note that throws the bead hard and far. The short one, the pistolet, was made for the decks of their sky-ketches. Its coil is short, and sings a sharp note once before its key must be turned, so the Ketch\'s marines carried them in braces of two, and fired one while they wound the other. Both eat the same beads, and both are worthless without them.'),
    section('Why they are rare', 'No forge in the Bay has made a pellet since the Dwemer went, and no mage I have met can charge a dead one. The live ones are found where the Rourken left them: in the old stores under the Alik\'r, in the packs of the treasure-hunters who robbed those stores and died of it, and now and then in the hoard of some creature that ate a treasure-hunter. And, if the boatmen of Daggerfall are to be believed, in the hold of the one Rourken ship that never came down, whose foundry still casts them, and whose master still pays a share of them to whoever reaches her cabin.'),
    section('Counsel', 'Do not open the lock. Do not put a bead to your ear to hear it hum. Do not fire one in a cellar. Do not trade for a gun without beads, nor for beads that do not hum, for a dead bead is a pea and nothing more. And if you would have a gun at all, look up when the shape crosses the sky over Daggerfall, and ask yourself whether you are brave enough to climb to where they came from.'),
  ]),
})], [KETCH_BOOK_ID, book({
  title: 'The Ketch That Never Lands',
  author: 'Imrah Bel-Tavir',
  pages: Object.freeze([
    Object.freeze([
      { text: 'The Ketch That Never Lands', center: true, font: BOOK_TITLE_FONT }, '',
      { text: 'Being an Account of the Rourken Sky-Ketch Mzunthar', center: true }, '',
      { text: 'by Imrah Bel-Tavir', center: true },
      { text: 'Antiquarian of Sentinel', center: true }, '',
      'Now and again a shape comes out of the east over Daggerfall. The boatmen keep a tally of her comings, and they say she comes round every fifth day, and is never late. The children call it the brass cloud. The priests of the city call it a portent, and preach on it. It is a ship, two-masted and brass-hulled, and it has been sailing since before the first Emperor was born.',
      '',
    ]),
    section('What she is', 'She is the Mzunthar, a sky-ketch of the Rourken of Volenfell. Her hull is brass and Dwemer steel. Her two masts carry no canvas but vanes of beaten brass and spun crystal, which drink the sun above the clouds. She is held up by her keel-song, the note her engine sings against the bones of the world, and her engine is fed on cells of aetherium, as a lamp is fed on oil.'),
    section('Why she still sails', 'She was aloft on the day the Dwemer vanished, and her crew vanished at their posts. Her steersman did not. It was never alive to vanish: a construct of the Rourken\'s Tonal Guard, bound to her helm, and it held the last course it was given, a circuit of the Iliac Bay by the Rourken\'s own reckoning of the week, high above the weather. For three thousand years no one saw her. What brought her down below the clouds over Daggerfall I cannot say for certain. Her lodestone was tuned to great masses of Dwemer brass, and something under Daggerfall has begun to answer it.'),
    section('How she is boarded', 'While she holds station she lowers her anchor-lift, a cage of brass on a chain, to a field outside the city walls. The cage holds eight and will not rise for nine; I have watched it refuse. Those who ride it come up at her bow, on the anchor deck, and may ride it down again whenever they please. Those who fall from her deck come down without it, and the Ketch\'s tether catches some of them.'),
    section('The Watch and the Gallery', 'Her weather deck is kept by a watch of constructs, spheres that unfold into soldiers and sentries that throw lightning, and they do not let boarders pass. Below decks lies what the boatmen call the Gallery of Hammers, where her engine\'s pistons rise and fall on her keel-song\'s beat, and steam crosses the passage on the same beat. Walk it in time, or do not walk it at all.'),
    section('The Starved Engine', 'Her engine is starving. Her cells lie charged in their cradles in the hold, where the sun has filled them, and no hand of hers is left to carry them to the sockets. A boarder must. A cell is heavy and wants both hands, so its carrier cannot fight and walks slowly, and the hold\'s spiders know it, and so do the arc-coils in her ceiling. Let the strong guard the slow, and a cell dropped is a cell carried again. When the engine has drunk its fill it sings, and the lift to her masts rises.'),
    section('The Sailwalk and the Bridge', 'The way to her bridge is over the yards, mast to mast, on spars that swing and sails that come and go with the light, and wind that would like you to be somewhere else. On the bridge waits the Tonal Warden, her steersman, and it will not be moved. When it is pressed it sounds a discord through the whole ship, and her resonators must be fed fresh cells to tune it out again; and at the last it sings her keel-song itself, and the tuning-forks that rise around it must be broken before the note is done. She keeps station for a day and a half, then turns west. Whatever is still fighting on her deck when she turns had better be the Warden.'),
    section('What is aboard', 'The boatmen say her master\'s cabin is behind the helm, and that it opens to whoever stills the Warden. They say it holds Rourken guns, and beads to feed them; that the Warden\'s own long gun is gilded; and that her master\'s pistolet lies there still, in gold, the one she gave her last order with. I believe about half of what boatmen say. I believe all of that.'),
  ]),
})]]);

/** The port books' ids, in order. */
export const PORT_BOOK_IDS = Object.freeze([...PORT_BOOKS.keys()]);
export const isPortBook = (id) => PORT_BOOKS.has(id);
export const portBookTitle = (id) => PORT_BOOKS.get(id)?.title ?? null;

/** The BOK header's length before the page offsets (formats/bookFile.js: title 64, author 64, the tag 8, 88 empty,
 *  the price u32, three u16s, the page count u16). */
const HEADER = 236;

/** A row's bytes: printable ASCII only - anything else is the file's own '?' (textRsc.js encodeRscRecord's rule). */
function textBytes(out, s) {
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    out.push(c >= RSC.FirstCharacter && c <= RSC.LastCharacter ? c : 0x3f);
  }
}

/**
 * A port book in the BOK format's own bytes: the header (title, author, its price - the classic law's own for its
 * title, as the reader's load rolls it), the page offsets, and each page a token stream - a centred row opened by
 * JustifyCenter, a left one by JustifyLeft, a face by FontPrefix, each closed by NewLine, an empty line a bare NewLine
 * (which also ends a centred run and a face - ui/bookReader.js layoutBookLines) - closed by EndOfPage. Pure.
 * @param {PortBook} book
 */
export function encodePortBook(book) {
  const pages = book.pages.map((rows) => {
    const out = [];
    for (const r of rows) {
      if (r === '') { out.push(RSC.NewLine); continue; }
      const row = typeof r === 'string' ? { text: r } : r;
      out.push(row.center ? RSC.JustifyCenter : RSC.JustifyLeft);
      if (row.font) out.push(RSC.FontPrefix, row.font);
      textBytes(out, row.text);
      out.push(RSC.NewLine);
    }
    out.push(RSC.EndOfPage);
    return out;
  });
  const start = HEADER + 4 * pages.length;
  const bytes = new Uint8Array(start + pages.reduce((n, p) => n + p.length, 0));
  const v = new DataView(bytes.buffer);
  const field = (s, at, len) => { const b = []; textBytes(b, s); bytes.set(b.slice(0, len - 1), at); };   // a C string, NUL-ended
  field(book.title, 0, 64);
  field(book.author, 64, 64);
  v.setUint16(234, pages.length, true);
  let at = start;
  pages.forEach((p, i) => { v.setUint32(HEADER + 4 * i, at, true); bytes.set(p, at); at += p.length; });
  v.setUint32(224, classicPrice(bytes), true);
  return bytes;
}

/** The classic price law for a book's bytes: BookFile's own roll off the title's first four bytes (300-800) - with the
 *  generator's state put back, so pricing a port book never moves the classic draws (the port prices the classic books
 *  once, at boot - systems/books.js loadBookPrices - and never at a mint). */
function classicPrice(bytes) {
  const seed = getSeed();
  try {
    const f = new BookFile();
    f.load(bytes, 'BOK00000.TXT');
    return f.price;
  } finally { setSeed(seed); }
}

/** @type {Map<number, Uint8Array>} */
const _bytes = new Map();
/** A port book's bytes, or null for any other id. Encoded once. */
export function portBookBytes(id) {
  const book = PORT_BOOKS.get(id);
  if (!book) return null;
  if (!_bytes.has(id)) _bytes.set(id, encodePortBook(book));
  return /** @type {Uint8Array} */ (_bytes.get(id));
}

/** A port book opened as the reader opens a classic one (its filename the id's own, so the price law is the
 *  classic's), or null for any other id. */
export function openPortBook(id) {
  const bytes = portBookBytes(id);
  if (!bytes) return null;
  const f = new BookFile();
  f.load(bytes, messageToBookFilename(id));
  return f;
}

/** A port book's price - the classic law's own for its title, as its header carries it - or null for any other id. */
export function portBookPrice(id) {
  const bytes = portBookBytes(id);
  return bytes ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(224, true) : null;
}
