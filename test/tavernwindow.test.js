// U39: the tavern WINDOW against DaggerfallTavernWindow.cs - the
// panel's geometry, the two button chains and their closing quirks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TAVERN_PANEL_W, TAVERN_PANEL_H, TAVERN_PANEL_X, TAVERN_PANEL_Y, TAVERN_RECTS, DAYS_FIELD, TavernWindow,
} from '../src/ui/tavernWindow.js';
import { NATIVE_W, NATIVE_H } from '../src/ui/nativePanel.js';
import {
  TAVERN_MENU, HOW_MANY_DAYS_ID, HOW_MANY_ADDITIONAL_DAYS_ID,
  TOO_MANY_DAYS_ID, OFFER_PRICE_ID, NOT_ENOUGH_GOLD_ID,
  ROOM_FREE_FOR_KNIGHT, YOU_ARE_NOT_HUNGRY, roomRemainingHours,
} from '../src/systems/tavern.js';
import { MINUTES_PER_DAY, dayOfYearFromMinutes } from '../src/systems/gameDate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The host's TEXT.RSC reader, echoing the id so a box can be
 *  identified by the record it drew - and carrying the two macros the
 *  tavern's own data source fills. */
const rows = (id) => [{ text: `#${id} %a gold, %dwr hours`, center: true }];
const idOf = (box) => Number(/^#(\d+)/.exec(box?.rows?.[0]?.text ?? '')?.[1]);

const player = (gold = 5000) => ({
  name: 'Rin', health: 20, maxHealth: 50, rentedRooms: [],
  items: [{ group: 'Currency', stackCount: gold }],
  stats: { personality: 50 },
});

/** A window over a fixed clock and a fixed inn. `day` is the day of
 *  year the rental formula should see. */
function win(overrides = {}) {
  const entity = overrides.entity ?? player();
  const day = overrides.day ?? 100;
  const now = overrides.now ?? ((day - 1) * MINUTES_PER_DAY + 600);
  const closed = { count: 0 };
  const w = new TavernWindow({
    entity,
    rows,
    now: () => now,
    mapId: () => 7,
    buildingKey: () => 42,
    buildingName: () => 'The Dancing Dagger',
    quality: () => 10,
    bedCount: () => 4,
    freeRooms: () => !!overrides.free,
    skills: () => ({ mercantile: 50, personality: 50 }),
    heal: (n) => { entity.health = Math.min(entity.maxHealth, entity.health + n); },
    onTalk: () => { closed.talked = true; },
    onClose: () => { closed.count++; },
    rolls: () => 0.5,
    ...overrides.hooks,
  });
  return { w, entity, now, closed };
}

/** Click the middle of a panel-relative rect. */
const clickRect = (w, key) => {
  const [x, y, rw, rh] = TAVERN_RECTS[key];
  return w.click(TAVERN_PANEL_X + x + rw / 2, TAVERN_PANEL_Y + y + rh / 2);
};

/** Type a value into the live field, digit by digit, the way a player
 *  does - the field is numeric, so this also proves the filter. */
const type = (w, text) => {
  for (let i = 0; i < 12; i++) w.flow.input('backspace');
  for (const ch of text) w.flow.input(`char:${ch}`);
};

test('U39: the panel is TVRN00I0\'s own size, Center/Middle (:96-100)', () => {
  assert.equal(TAVERN_PANEL_W, 130);
  assert.equal(TAVERN_PANEL_H, 44, 'the IMG really ships 130x44 - read, not assumed');
  assert.equal(TAVERN_PANEL_X, Math.round((NATIVE_W - TAVERN_PANEL_W) / 2));
  assert.equal(TAVERN_PANEL_Y, Math.round((NATIVE_H - TAVERN_PANEL_H) / 2));
  assert.equal(TAVERN_PANEL_X, 95);
  assert.equal(TAVERN_PANEL_Y, 78, 'the declared Position (0,50) never applies - both alignments are set');
  // #region UI Rects (:23-26): four identical rows on a 9px stride
  assert.deepEqual([...TAVERN_RECTS.room], [5, 5, 120, 7]);
  assert.deepEqual([...TAVERN_RECTS.talk], [5, 14, 120, 7]);
  assert.deepEqual([...TAVERN_RECTS.food], [5, 23, 120, 7]);
  assert.deepEqual([...TAVERN_RECTS.exit], [5, 32, 120, 7]);
  for (const k of ['room', 'talk', 'food', 'exit']) {
    const [x, y, w, h] = TAVERN_RECTS[k];
    assert.ok(x + w <= TAVERN_PANEL_W && y + h <= TAVERN_PANEL_H, `${k} fits inside the panel`);
  }
  // TextBox.Numeric, MaxCharacters 3, Text "1" (:166-168)
  assert.deepEqual({ ...DAYS_FIELD }, { numeric: true, maxCharacters: 3, initial: '1' });
});

test('U39: the four buttons route, and exit/talk close the window', () => {
  const a = win();
  assert.equal(clickRect(a.w, 'exit'), true);
  assert.equal(a.w.done, true);
  assert.equal(a.closed.count, 1);

  const b = win();
  clickRect(b.w, 'talk');
  assert.equal(b.closed.talked, true, 'TalkButton_OnMouseClick (:263)');
  assert.equal(b.w.done, true, 'and it closes the tavern first');

  // a click OUTSIDE every rect is not swallowed
  const c = win();
  assert.equal(c.w.click(0, 0), false);
  assert.equal(c.w.done, false);

  // the room button raises the day field pre-filled on 1
  const d = win();
  clickRect(d.w, 'room');
  assert.ok(d.w.flow, 'a chain is up');
  assert.equal(idOf(d.w.flow.top), HOW_MANY_DAYS_ID, 'no room yet: 5102');
  assert.equal(d.w.flow.value, '1', 'TextBox.Text = "1"');
});

test('U39: the field is numeric and three characters wide (:166-168)', () => {
  const { w } = win();
  clickRect(w, 'room');
  type(w, 'a3b');
  assert.equal(w.flow.value, '3', 'letters are dropped');
  type(w, '99999');
  assert.equal(w.flow.value, '999', 'MaxCharacters 3 - the 350 ceiling cannot even be typed past');
});

test('U39: renting - offer, confirm, gold, and the record it mints', () => {
  const { w, entity, now } = win();
  clickRect(w, 'room');
  type(w, '3');
  w.flow.input('Enter');
  const offer = w.flow.top;
  assert.equal(idOf(offer), OFFER_PRICE_ID);
  assert.equal(offer.buttons, 'YesNo');
  const price = Number(/(\d+) gold/.exec(offer.rows[0].text)[1]);
  assert.ok(price > 0, 'the %a macro carried the trade price');

  const before = entity.items[0].stackCount;
  w.flow.input('KeyY');
  assert.equal(entity.items[0].stackCount, before - price, 'the gold left at the YES, not at the offer');
  assert.equal(entity.rentedRooms.length, 1);
  const room = entity.rentedRooms[0];
  assert.equal(room.mapId, 7);
  assert.equal(room.buildingKey, 42);
  assert.equal(room.name, 'The Dancing Dagger');
  assert.equal(room.allocatedBedIndex, 2, 'the bed comes from the rest-marker COUNT');
  assert.equal(room.expiryMinutes, now + 3 * MINUTES_PER_DAY);
  // AUDIT 26 F143: ConfirmRenting_OnButtonClick's CloseWindow() (:214)
  // is uiManager.PopWindow() (UserInterfaceWindow.cs:127-130), which
  // pops the TOP window - and the top window is the price box pushed
  // at :208, since DaggerfallMessageBox does not close itself on a
  // button (:479-484). The tavern is what it uncovers.
  assert.equal(w.done, false, 'renting hands the four-button panel back');
  assert.equal(w.flow, null, 'and the chain is gone');
});

test('AUDIT 26 F143: declining the price returns to the four-button panel (:214)', () => {
  const { w, entity } = win();
  clickRect(w, 'room');
  type(w, '2');
  w.flow.input('Enter');
  const before = entity.items[0].stackCount;
  w.flow.input('KeyN');
  assert.equal(entity.items[0].stackCount, before, 'nothing paid');
  assert.equal(entity.rentedRooms.length, 0, 'nothing rented');
  assert.equal(w.done, false, 'the CloseWindow at :214 pops the price box, not the tavern');
  assert.equal(w.flow, null);
  // ...and the panel is live again: the innkeeper takes another click.
  clickRect(w, 'exit');
  assert.equal(w.done, true);
});

test('U39: the gold test is at the YES, so the game offers a price you cannot pay (:214-222)', () => {
  const { w, entity } = win({ entity: player(3) });
  clickRect(w, 'room');
  type(w, '10');
  w.flow.input('Enter');
  assert.equal(idOf(w.flow.top), OFFER_PRICE_ID, 'the offer is made regardless of the purse');
  w.flow.input('KeyY');
  assert.equal(idOf(w.flow.top), NOT_ENOUGH_GOLD_ID, '...and the refusal lands only after agreeing');
  assert.equal(entity.rentedRooms.length, 0);
  assert.equal(entity.items[0].stackCount, 3, 'and no partial charge');
});

test('U39: a KNIGHT rents free, and the ceiling still stops them (:204-208, :188)', () => {
  const { w, entity, now } = win({ free: true });
  clickRect(w, 'room');
  type(w, '5');
  w.flow.input('Enter');
  assert.equal(w.flow.top.rows[0].text, ROOM_FREE_FOR_KNIGHT);
  assert.equal(entity.items[0].stackCount, 5000, 'not a coin');
  assert.equal(entity.rentedRooms[0].expiryMinutes, now + 5 * MINUTES_PER_DAY);

  // THE ORDER: the 350-day ceiling is tested BEFORE the knightly arm
  const k = win({ free: true });
  clickRect(k.w, 'room');
  type(k.w, '400');
  k.w.flow.input('Enter');
  assert.equal(idOf(k.w.flow.top), TOO_MANY_DAYS_ID, 'even a free room cannot be booked past 350 days');
  assert.equal(k.entity.rentedRooms.length, 0);
});

test('U39: a LIVE room renews (5100 + %dwr); an EXPIRED one is swept and reads as fresh (:157-165)', () => {
  const entity = player();
  const now = 99 * MINUTES_PER_DAY + 600;
  entity.rentedRooms = [{ mapId: 7, buildingKey: 42, name: 'x', expiryMinutes: now + 2 * MINUTES_PER_DAY }];
  const a = win({ entity, now });
  clickRect(a.w, 'room');
  assert.equal(idOf(a.w.flow.top), HOW_MANY_ADDITIONAL_DAYS_ID, 'a live room asks for ADDITIONAL days');
  // %dwr is GetRemainingHours, a CEILING over the hours left
  const hours = roomRemainingHours(entity.rentedRooms[0], now);
  assert.equal(hours, 48);
  assert.match(a.w.flow.top.rows[0].text, /48 hours/, 'the RoomHoursLeft macro is filled');
  // renewing EXTENDS the same record rather than minting a second
  type(a.w, '2');
  a.w.flow.input('Enter');
  a.w.flow.input('KeyY');
  assert.equal(entity.rentedRooms.length, 1);
  assert.equal(entity.rentedRooms[0].expiryMinutes, now + 4 * MINUTES_PER_DAY);

  // an EXPIRED room is swept before the lookup, so the prompt changes
  const gone = player();
  gone.rentedRooms = [{ mapId: 7, buildingKey: 42, name: 'x', expiryMinutes: now - 60 }];
  const b = win({ entity: gone, now });
  clickRect(b.w, 'room');
  assert.equal(idOf(b.w.flow.top), HOW_MANY_DAYS_ID, 'the sweep ran first (:157)');
  assert.equal(gone.rentedRooms.length, 0, 'and the dead record is gone from the entity');
});

test('U39: an unparsable day count does NOTHING AT ALL, as int.TryParse does (:175-178)', () => {
  for (const bad of ['', '0']) {
    const { w, entity } = win();
    clickRect(w, 'room');
    type(w, bad);
    w.flow.input('Enter');
    // AUDIT 26 F143: the input box closed ITSELF before OnGotUserInput
    // ran (DaggerfallInputMessageBox.cs:298-301), so int.TryParse's
    // bare `return` leaves the TAVERN as the top window.
    assert.equal(w.done, false, `"${bad}" says nothing and hands the panel back`);
    assert.equal(w.flow, null);
    assert.equal(entity.rentedRooms.length, 0);
  }
});

test('U39: the FOOD button closes the tavern BEFORE it tests hunger (:283-299)', () => {
  // full: the "not hungry" line appears with the panel already gone
  const fed = player();
  fed.lastTimePlayerAteOrDrankAtTavern = 99 * MINUTES_PER_DAY + 600;
  const a = win({ entity: fed, now: fed.lastTimePlayerAteOrDrankAtTavern + 60 });
  clickRect(a.w, 'food');
  assert.equal(a.w.flow.top.rows[0].text, YOU_ARE_NOT_HUNGRY);
  assert.equal(a.w.flow.top.picker, undefined, 'no menu at all');

  // hungry: the eleven-line picker
  const b = win();
  clickRect(b.w, 'food');
  assert.deepEqual(b.w.flow.top.picker, [...TAVERN_MENU]);
  assert.equal(b.w.flow.top.picker.length, 11);
});

test('U39: a meal charges, heals twice the price, and stamps the clock (:305-334)', () => {
  const { w, entity, now } = win();
  clickRect(w, 'food');
  // row 3 is Wine (3 gold) on an ordinary day
  w.flow._picker.onPick(3, TAVERN_MENU[3]);
  assert.equal(entity.items[0].stackCount, 4997);
  assert.equal(entity.health, 26, '20 + 2 * 3');
  assert.equal(entity.lastTimePlayerAteOrDrankAtTavern, now, 'the hunger clock is stamped');
  assert.equal(w.done, true, 'a meal says nothing and the window is already closed');

  // too poor: the refusal, and NO stamp - a penniless player may try
  // again the moment they have a coin
  const p = win({ entity: player(1) });
  clickRect(p.w, 'food');
  p.w.flow._picker.onPick(3, TAVERN_MENU[3]);
  assert.equal(idOf(p.w.flow.top), NOT_ENOUGH_GOLD_ID);
  assert.equal(p.entity.lastTimePlayerAteOrDrankAtTavern, undefined);
  assert.equal(p.entity.health, 20);
});

test('U39: the healing is CLAMPED by the entity, not by the formula', () => {
  const near = player();
  near.health = 49;
  const { w, entity } = win({ entity: near });
  clickRect(w, 'food');
  w.flow._picker.onPick(3, TAVERN_MENU[3]);
  assert.equal(entity.health, 50, 'a 6-point meal at 49/50 does not overheal');
  assert.equal(entity.items[0].stackCount, 4997, 'and it is still paid for');
});

test('U39: ONE clock - the room formula reads the day the tavern\'s own minutes name', () => {
  // day 45 with a 3-day stay spans Heart's Day (46) and loses a day
  const before = win({ day: 45 });
  assert.equal(dayOfYearFromMinutes(before.now), 45);
  clickRect(before.w, 'room');
  type(before.w, '3');
  before.w.flow.input('Enter');
  const spanning = Number(/(\d+) gold/.exec(before.w.flow.top.rows[0].text)[1]);

  const after = win({ day: 100 });
  clickRect(after.w, 'room');
  type(after.w, '3');
  after.w.flow.input('Enter');
  const full = Number(/(\d+) gold/.exec(after.w.flow.top.rows[0].text)[1]);
  assert.ok(spanning < full, `a stay spanning Heart's Day is cheaper (${spanning} < ${full})`);
});

test('U39: %ra and %hnr resolve - the macros the LIVE PROBE caught printing raw', () => {
  // TEXT.RSC 5102 opens "Good day, %ra." and the first run of the
  // probe read exactly that back off the real game: expandGuildMacros
  // filled %a, %gii, %god and %pct and left the two IDENTITY macros
  // alone, so every service window in the port has been showing them
  // raw since U24. ExpandRandomTextRecord runs the WHOLE MacroHelper
  // table over every record, and both readers already existed.
  const identityRows = (id) => [{ text: `#${id} Good day, %ra. Very well, %hnr.`, center: true }];
  const she = { ...player(), race: 'DarkElf', gender: 'female' };
  const { w } = win({ entity: she, hooks: { rows: identityRows } });
  clickRect(w, 'room');
  const text = w.flow.top.rows[0].text;
  assert.match(text, /Good day, Dark Elf\./, 'the elves are TWO words, per Internal_Strings');
  assert.match(text, /Very well, Ma'am\./);
  assert.doesNotMatch(text, /%/, 'and no macro survives into the box');
  // ...and the same holds for a male Breton, so the pin is not
  // reading one hard-coded pair back at itself
  const he = { ...player(), race: 'Breton', gender: 'male' };
  const b = win({ entity: he, hooks: { rows: identityRows } });
  clickRect(b.w, 'room');
  assert.match(b.w.flow.top.rows[0].text, /Good day, Breton\. Very well, Sir\./);
});

test('U39: the host consumes the tavern route the G8 law has answered all along', () => {
  const code = readFileSync(join(root, 'src', 'scenes', 'worldModes.js'), 'utf8');
  assert.match(code, /route\.service === 'tavern'/, 'the arm exists');
  assert.match(code, /preloadTavernArt\(/, 'and the art is preloaded with the rest');
  // the free-room perk reaches the window rather than staying a law
  // with no caller (it had none but travel.js's own hook)
  assert.match(code, /freeTavernRooms\(knightGuild/);
  assert.match(code, /INTERIOR_MARKER\.REST/, 'the bed comes from the interior\'s own markers');
  // the save carries both halves
  const save = readFileSync(join(root, 'src', 'systems', 'save.js'), 'utf8');
  assert.match(save, /'lastTimePlayerAteOrDrankAtTavern'/);
  assert.match(save, /snap\.rentedRooms =/);
  assert.match(save, /entity\.rentedRooms = \(snap\.rentedRooms \?\? \[\]\)/);
});
