// INSTANCES (2026-10-15, Mac: "The player approaches, should be met with an enhanced UI popup that lets them select
// public or instanced (if applicable)"; bible/11-Multiplayer/Instances.md): THE DOOR - the page's half of an instance.
// The law is systems/instancePlaces.js's (what the door offers, where a quest's things stand) and net/instanceRoom.js's
// (the room); this module holds what a page must: the account's digest (async, worked out once), the popup
// (ui/talkWindow.js ChoiceWindow - the enhanced dialog on the Plus skin, the panel on the classic one), and the one rule
// for every other way into a place. HOST-SPLIT: the hosts construct it once and ask it; it grows here, not in them.
//
// THE POPUP IS A PLAYER'S DOOR'S ALONE (the audit, 2026-10-16). A host asks `choose` - through `atDoor` - when the player
// walks up to a door and takes it, and awaits the answer; the entry itself (worldModes.js tryEnterDungeon,
// enterInteriorCore) is handed the ENTRY decided, `{ instance, whole }`, and never asks. Every other way in - a quest's
// `teleport pc` and `transfer pc`, a Recall, a load, a staff landing, the cemetery, the Abyss, the arena - asks
// `entryFor`, which never shows anything: a quest's own place its instance (a partner's, standing there, first), the
// place a save, an anchor or a staff landing recorded where it still may be had, else the public room. The door's
// popup asked from inside the entry broke every one of those: it answered "not entered" to a quest's transfer, which
// then stood the player at dungeon coordinates outside (S0000016's Crux - the main quest's soft-lock).
//
// THE DOOR REMEMBERS THE PARTY'S ROOM (WIPE-RETURN, a field report, 2026-10-25: "Upon Death in an instance, party members
// and host will desync even if everyone dies and goes back in at times"). A partner's room was offered only off a pose
// that named it, and a pose names one only while its member stands inside. A party that fell together respawned at the
// door with no pose naming its room: a member with a copy of the quest was offered Public and their own instance, a
// member without it no popup at all, and each walked into a room apart. The room the relay last joined this page to is
// kept (poseWord), forgotten if the relay shuts it on me (refused), and offered after the rooms members stand in, under
// the same law (systems/instancePlaces.js partnerInstances' `stood`): a row of the popup, and entryFor's room for a
// quest's place where nothing was recorded. It lives as long as the page: a reload inside records the room in the save,
// a reload outside forgets it.
//
// deps: online() - the page is online; instanceOk() - its relay admits instances (net/instanceRoom.js
// relaySupportsInstances, the welcome's word); account(), character() - the verified account and the character's id
// (the private rooms' own: social.acct, realmSession.id); members() - the party's other members, each with its party
// pose `p` (net/social.js); questMachine(); openOverlay(window, onClosed) - the window laid over whatever is open
// (townTalk.pushOverlay), true when it went up; say(line); wild() - the player stands in the open zone (WILD1), where
// nothing keeps an instance: its real dungeons are sealed and its halls the relay refuses one; remains() - HEIR-WHOLE:
// where the line's remains lie (scenes/legacyHost.js remainsWhere), whose death quest's place a dungeon whole is.
import { ChoiceWindow } from '../ui/talkWindow.js';
import { t, getLocalizedLocationName } from '../systems/textManager.js';
import { SITE_TYPES } from '../systems/quest/place.js';
import { instanceOwnerOf, holdEpochOf, instanceOf, instanceOfWord, isInstanceRoom, INSTANCE_DOOR_WORD } from '../net/instanceRoom.js';
import { roomKeyFor } from '../net/online.js';
import { wdunHallOfRoom, seaRoomCell } from '../net/wire.js';
import { openerQuestOf, partnerInstances, instanceOffer, questDungeonWhole, questsAtSite, questInstanceEpoch, remainsWholeAt, remainsInstanceEpoch } from '../systems/instancePlaces.js';
import { isPrivateersHold } from '../systems/startDungeon.js';   // HOLD-ONCE: online the Hold's public room is entered once - its instance any time
import { builtSizeFor } from '../world/smallerDungeons.js';   // QUEST-ELSEWHERE: the size the world builds a dungeon's public room at

/** The words, one home - drafted in the thirteen whole languages (locales/), keys under `instance.door`. */
export const INSTANCE_TEXT = Object.freeze({
  line: () => t('instance.door.line', 'Enter the shared world, or an instance of your own for you and your party?'),
  holdLine: () => t('instance.door.holdLine', "Privateer's Hold is closed to the public. You may enter an instance of your own, for you and your party."),
  public: () => t('instance.door.public', 'Public'),
  mine: () => t('instance.door.mine', 'Your instance'),
  join: (name) => t('instance.door.join', "{name}'s instance", { name }),
  leave: () => t('instance.door.leave', 'Leave'),
  questHere: () => t('instance.door.questHere', "Your quest's business here waits in your instance."),
  questPublic: () => t('instance.door.questPublic', "Your quest's business here is only in your instance. The shared dungeon is smaller and has none of it."),
  unavailable: () => t('instance.door.unavailable', 'Your instance could not be opened. Try again in a moment.'),
  refused: () => t('instance.door.refused', 'That instance is closed to you. Only its owner and their party can enter.'),
});

/** An entry: the place's public room, as the world lays it. */
const PUBLIC = Object.freeze({ instance: null, whole: false });

/** A dungeon's site, from the location its door names. QUEST-ELSEWHERE (FIELD BUGS 2026-10-16c): `relaid` - online the
 *  world builds its public room smaller, where a quest's things never stand (systems/instancePlaces.js questMountsHere)
 *  and the line's remains laid whole never lie (remainsWholeAt). AUDIT FB1019f B1: the size BUILT
 *  (world/smallerDungeons.js builtSizeFor), the size the mount reads (worldModes.js mountQuestResources' builtDungeonSize) -
 *  never the size drawn, which a dungeon at or under its size's threshold never takes: its public room is the dungeon
 *  whole, and its quest's things and its remains stand there. */
export const dungeonSite = (dfLocation) => {
  const mapId = (Number(dfLocation?.mapTableData?.mapId) || 0) >>> 0;
  return { siteType: SITE_TYPES.Dungeon, mapId, buildingKey: 0, layout: null, isHold: isPrivateersHold(dfLocation), home: false, name: dfLocation?.name ? getLocalizedLocationName(mapId, dfLocation.name) : '', relaid: builtSizeFor(dfLocation, { online: true }) !== 'full' };
};
/** A building's site in the town `mapId`, from its building record (buildingDataForDoor's): `layout` its town's (the
 *  room's - WD3), `home` a player's home or a house of the player's own - whose room is its owner's, never an instance. */
export const buildingSite = (mapId, building, { layout = null, home = false } = {}) => ({
  siteType: SITE_TYPES.Building, mapId: (Number(mapId) || 0) >>> 0, buildingKey: (Number(building?.buildingKey) || 0) >>> 0, layout, isHold: false, home: !!home, name: '',
});
/** The place's public room - the room an instance of it stands beside (net/instanceRoom.js): a dungeon whole, a building
 *  in its town's layout. Null for a place no room keys. */
export const siteBase = (site) => roomKeyFor({ host: 'world', mode: site?.siteType === SITE_TYPES.Building ? 'interior' : 'dungeon', mapId: site?.mapId ?? 0, buildingKey: site?.buildingKey ?? 0, layout: site?.layout ?? null });
/** A place that keeps no instance: a home (its owner's room), a zone hall (net/wire.js wdunHallOfRoom - the relay refuses
 *  one), an isle's dungeon (SEA-VAULTS: seaRoomCell - the open sea keeps none, the relay refuses one), a place no room keys. */
const keepsNone = (site) => { const base = siteBase(site); return !base || !!site.home || wdunHallOfRoom(base) != null || seaRoomCell(base) != null; };

export function createInstanceDoor(deps) {
  let ownerFor = null, owner = null;   // the account the owner digest is of, and the digest
  let refusedRoom = null;              // the instance room whose refusal was said (refused)
  let stood = null;                    // WIPE-RETURN: the instance room the relay last joined me to (poseWord), kept past its leave - its key
  const said = new WeakSet();          // the builds whose quest-elsewhere line was said (questElsewhere)
  const online = () => !!deps.online?.();
  const machine = () => deps.questMachine?.() ?? null;
  /** Instances may be had here: online, at a relay that keeps them, at a place that keeps one. */
  const can = (site) => online() && !!deps.instanceOk?.() && !keepsNone(site) && !deps.wild?.();
  /** HEIR-WHOLE: the line's remains that lie in this place whole, where its public room is laid smaller
   *  (systems/instancePlaces.js remainsWholeAt). */
  const remainsHere = (site) => remainsWholeAt(deps.remains?.() ?? [], site);
  /** A running quest of mine names this place (the Hold is no quest's) - or the death quest does: the line's remains lie
   *  in it whole (HEIR-WHOLE), which only a build of its own stands. */
  const questHere = (site) => !site.isHold && (openerQuestOf(machine(), site) != null || remainsHere(site).length > 0);
  /** My owner digest - worked out once an account. */
  async function myOwner() {
    const a = deps.account?.() ?? null;
    if (!a) return null;
    if (ownerFor !== a) { ownerFor = a; owner = await instanceOwnerOf(a); }
    return owner;
  }
  /** My instance of `site`: my owner, and the epoch of the quest that names it (the oldest - its own, kept in its save:
   *  questInstanceEpoch, minted here the first time), or the Hold's (my character's) - or, no quest of the machine's
   *  naming it, the remains' that lie in it whole (HEIR-WHOLE: the first of the line's there, remainsInstanceEpoch). A
   *  quest's room stands the remains too: both are the dungeon whole. */
  async function mine(site) {
    const o = await myOwner();
    const epoch = site.isHold ? await holdEpochOf(deps.character?.() ?? null) : (questInstanceEpoch(openerQuestOf(machine(), site)) ?? await remainsInstanceEpoch(remainsHere(site)[0]));
    return o && epoch ? { owner: o, epoch } : null;
  }
  /** HEIR-WHOLE: the epochs of the rooms the line's remains here open - one a row. */
  const remainsEpochs = (site) => Promise.all(remainsHere(site).map(remainsInstanceEpoch));
  /** The party's other members' owner digests, by account. */
  async function partyOwners() {
    const members = deps.members?.() ?? [];
    return new Map(await Promise.all(members.map(async (m) => [m?.acct, await instanceOwnerOf(m?.acct)])));
  }
  /** The party's instances standing at `site` whose owners are in the party (systems/instancePlaces.js partnerInstances) -
   *  then the room I last stood in there (WIPE-RETURN), while its owner is in the party. */
  async function partnersAt(site) {
    const owners = await partyOwners();
    return partnerInstances(deps.members?.() ?? [], siteBase(site), (acct) => owners.get(acct) ?? null, instanceOf(stood));
  }
  /** May a RECORDED instance (a save's, an anchor's, a staff landing's) still be stood in? A staff landing's always (the
   *  relay admits staff); mine while what opened it runs - the Hold's for good, a quest's while a running quest that names
   *  the place holds its epoch (an ended quest's room is never keyed again: Mac's "Kept until quest ends"), the remains'
   *  while they lie there whole (HEIR-WHOLE - taken up, the death quest's place is the heir's keeping); a partner's while
   *  its owner is in my party (the relay's own law). */
  async function stillHeld(site, inst, staff) {
    if (!inst) return false;
    if (staff) return true;
    if (inst.owner === await myOwner()) return site.isHold ? inst.epoch === await holdEpochOf(deps.character?.() ?? null) : questsAtSite(machine(), site).some((q) => q.instanceEpoch === inst.epoch) || (await remainsEpochs(site)).includes(inst.epoch);
    return [...(await partyOwners()).values()].includes(inst.owner);
  }

  /**
   * EVERY WAY IN BUT A PLAYER'S DOOR: the entry `{ instance, whole }` for `site`, never asked.
   * `recorded` - what a save, an anchor or a staff landing recorded of the place (`{ ins, whole, staff }`: its instance's
   *   word, net/instanceRoom.js instanceWord, absent for its public room; whether it stood whole; a staff landing's): that
   *   instance where it may still be had (stillHeld), else the public room laid as it was - an instance's place whole, so
   *   the recorded position stands in the blocks it was taken in. Undefined: nothing recorded -
   * a quest's place its instance (a partner's standing there first - the party together - then the partner's room I
   *   last stood in there, WIPE-RETURN - else mine), and where none can be had (an older relay, no account yet) its
   *   public room whole (questDungeonWhole: its markers are the whole's);
   * the Hold mine (HOLD-ONCE refuses its public room at the entry);
   * anywhere else the public room, as it always was.
   */
  async function entryFor(site, recorded = undefined) {
    if (!online()) return PUBLIC;
    const ok = can(site);
    if (recorded != null) {
      const inst = instanceOfWord(recorded.ins);
      if (ok && await stillHeld(site, inst, recorded.staff === true)) return { instance: inst, whole: true };
      return { instance: null, whole: !!(recorded.whole || inst) };
    }
    const quest = questHere(site);
    if (!quest && !site.isHold) return PUBLIC;
    const fallback = { instance: null, whole: questDungeonWhole({ online: true, instanceOk: false, questHere: quest }) };
    if (!ok) return fallback;
    const partner = (await partnersAt(site))[0];
    if (partner) return { instance: { owner: partner.owner, epoch: partner.epoch }, whole: true };
    const inst = await mine(site);
    return inst ? { instance: inst, whole: true } : fallback;
  }

  /**
   * A PLAYER'S DOOR: the popup where there is a choice (systems/instancePlaces.js instanceOffer - a quest's place, the
   * Hold, a partner's instance standing here), awaited; else entryFor's answer. Resolves to the entry, or null for Leave
   * (Esc, or the window closed any other way - replaced, disposed: never a door left waiting on nothing).
   */
  async function choose(site) {
    const ok = can(site);
    const rows = instanceOffer({ online: online(), instanceOk: ok, isHold: !!site.isHold, questHere: questHere(site), relaid: site.relaid === true, partners: ok ? await partnersAt(site) : [] });   // QUEST-FIRST: Public last where the quest's dungeon is laid smaller
    if (!rows) return entryFor(site);
    const row = await new Promise((resolve) => {
      let settled = false;
      const done = (r) => { if (!settled) { settled = true; resolve(r); } };
      // Digit1.. a row (nine at most: public, mine and a full party's seven others), Esc to leave - a keyed menu takes
      // its codes alone (ui/talkWindow.js), so Leave is the Escape key's row
      const options = rows.map((r, i) => ({ code: `Digit${i + 1}`, label: `${i + 1} - ${r.kind === 'public' ? INSTANCE_TEXT.public() : r.kind === 'mine' ? INSTANCE_TEXT.mine() : INSTANCE_TEXT.join(r.name)}`, action: () => done(r) }));
      options.push({ code: 'Escape', label: `Esc - ${INSTANCE_TEXT.leave()}`, action: () => done(null) });
      // QUEST-ELSEWHERE (FIELD BUGS 2026-10-16c): a quest's place laid smaller in public says, before the choice, that its
      // things stand in the instance alone - the line said once inside (questElsewhere) came after Public was chosen; the
      // death quest's remains laid whole among them (HEIR-WHOLE)
      const quest = !site.isHold && site.relaid === true && questHere(site);
      const win = new ChoiceWindow({ lines: [site.name ?? '', site.isHold ? INSTANCE_TEXT.holdLine() : INSTANCE_TEXT.line(), quest ? INSTANCE_TEXT.questPublic() : ''].filter(Boolean), options });
      const dispose = typeof win.dispose === 'function' ? win.dispose.bind(win) : null;
      win.dispose = () => { done(null); dispose?.(); };
      if (deps.openOverlay?.(win, () => done(null)) !== true) done(null);
    });
    if (!row) return null;
    if (row.kind === 'public') return PUBLIC;
    const inst = row.kind === 'mine' ? await mine(site) : { owner: row.owner, epoch: row.epoch };
    if (!inst) { deps.say?.(INSTANCE_TEXT.unavailable()); return null; }
    return { instance: inst, whole: true };
  }

  return {
    choose,
    entryFor,
    dungeonSite,
    buildingSite,
    /** A player's door (worldModes.js activateStaticDoor): asked, then `go(entry)` - a Leave enters nothing and the press is
     *  spent (true: its caller says nothing more). */
    async atDoor(site, go) { const entry = await choose(site); return entry ? go(entry) : true; },
    /** The party pose's `ins` (net/wire.js validPartyPose): inside, the instance room the relay joined me to (`room`) - never
     *  the one I meant to enter (a private room wins the key, a refused one is none) - so a partner is offered what is there.
     *  WIPE-RETURN: and the door keeps it (`stood`) - the pose stops naming it the moment I leave it (a death leaves the room
     *  at once, world.js onlineFrame), and its place's door offers it to me again. The pose is composed whenever the page
     *  has its hub link, in a party or not (world.js partyFrame). */
    poseWord(mode, room) {
      if (mode === 'exterior' || !isInstanceRoom(room)) return {};
      stood = room;
      return { ins: room };
    },
    /** THE RELAY SHUT AN INSTANCE'S DOOR on `session` (net/instanceRoom.js INSTANCE_DOOR_WORD: not its owner, staff, nor of
     *  its owner's party - at the hello, or asked again while staying, a kick or a lapse): said once a room, true then -
     *  the host takes the player out (the realm's door's own shape, systems/realmSaves.js realmDoorShut). WIPE-RETURN: and
     *  the door no longer offers it back - the relay's word on who comes in is the hub's party, which can be ahead of mine. */
    refused(session) {
      const room = session?.room;
      if (!session?.terminal || session.error !== INSTANCE_DOOR_WORD || !isInstanceRoom(room) || refusedRoom === room) return false;
      refusedRoom = room;
      if (stood === room) stood = null;
      deps.say?.(INSTANCE_TEXT.refused());
      return true;
    },
    /** A re-laid public room stands none of a quest's things (systems/instancePlaces.js questMountsHere): where a quest of
     *  mine names this dungeon and an instance could be had, it says so - once a build (`dungeonLoc`, the built location). */
    questElsewhere(dungeonLoc) {
      if (!dungeonLoc || said.has(dungeonLoc)) return false;
      const site = dungeonSite(dungeonLoc);
      if (!can(site) || !questsAtSite(machine(), site).length) return false;
      said.add(dungeonLoc);
      deps.say?.(INSTANCE_TEXT.questHere());
      return true;
    },
    myOwner,
  };
}
