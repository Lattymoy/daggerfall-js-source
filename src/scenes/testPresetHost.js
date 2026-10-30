// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `boot`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `boot.<name>` - as the code read them where it was.
import { applyHeadlessChargen, createChargenFlow, createChargenWindow, finishChargen, loadSpellIndex } from '../systems/chargenSession.js';
import { applyTestCharacter, seedTestLoot, seedTestMount } from '../systems/testRoom.js';
import { autoBuildArms, buildArmsFor } from '../combat/weapon/weaponRig.js';
import { enumerateSaves } from '../systems/save/saveSlots.js';
import { exitToTitleMenu, fetchBytes } from './shared.js';
import { loadSearch } from '../systems/legacy/places.js';
import { morrowindDataCount } from './dataSource.js';
import { newestSaveOf } from '../systems/legacy/store.js';
import { ownMinutes, sharedClockOn } from '../systems/worldTick.js';
import { peekPendingClassicSave } from '../systems/classicSave.js';
import { playerEntity, surfacePlayer } from '../characters/playerEntity.js';
import { preloadPaperDollArt } from '../ui/paperDoll.js';
import { releaseUnloadGuard } from '../systems/unloadGuard.js';
import { setLoadingAside } from '../ui/loadingScreen.js';
import { setRealmNotice } from '../systems/realmSaves.js';

/** @param {any} boot */
export function createTestPreset(boot) {
  const {
    farStart, getTexture, legacyReady, legacyRealmBirth, palette, params, questInitAtGameStart, realmBirth,
    realmLost, realmNew, renderer, starts, testEntry, testPreset, townTalk
  } = boot;
  if (testPreset) {
    (async () => {
      const preset = testPreset;
      const sbi = await loadSpellIndex(fetchBytes);
      boot.spellsByIndex = sbi;
      const { added } = await applyTestCharacter(playerEntity, preset, { fetchBytes, spellsByIndex: sbi });
      preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
        { race: playerEntity.race, gender: playerEntity.gender, faceIndex: playerEntity.faceIndex });
      surfacePlayer();
      questInitAtGameStart();
      console.log(`[testroom] ${preset.label}: ${added} armory items in the pack`);
      // TSR4: the horse in the pack now; the landing and the mount wait
      // for the first stand (the frame loop's spawn gate calls rideOut).
      if (testEntry.ride) { seedTestMount(playerEntity); boot.rideOutWanted = true; }
      if (testEntry.sea) boot.seaTestWanted = true;   // FIELD BUGS 2026-09-29 (the sea) #5: the Bay, her helm and a pirate wait for the first stand
      if (testEntry.loot) console.log(`[testroom] loot ladder: ${seedTestLoot(playerEntity).length} rolled items in the pack`);   // LR3
      // The Morrowind rigs, WITHOUT the trip to the pause card - the
      // room exists to look at them. Only when the data is attached;
      // without it the classic sprite stands exactly as everywhere
      // else, and the pause card's button still names why.
      if (morrowindDataCount() > 0) {
        const res = await buildArmsFor(playerEntity);
        if (!res.ok) console.warn(`[testroom] arms refused - ${res.stage}: ${res.error}`);
      }
    })().catch((e) => console.warn('[testroom] boot failed; the wizard stands in', e));
  } else if (!playerEntity.chargenDone && params.has('legacyborn') && !params.has('load')) {
    // LEGACY1 (bible/06-Systems/Legacy-Arc.md section 4): A MEMBER OF THE FAMILY IS BORN - Project Legacy's heir, or a
    // sibling played for the first time. Not the wizard: the person's own record, through THE ONE CONSTRUCTION SEAM
    // (finishChargen over a result the family law builds - legacyHost.bornResult), in the town the boot stood the world
    // in (`?region=&loc=`). AUDIT LEGACY B7: a birth that waits for nobody (a stale address, a birth already made) or
    // whose files would not load goes back to the title menu, SAID - never to a stranger's wizard: the line waits on the
    // record (its heir chosen, unborn), and the fallen's save asks again. BAY-LEFT-B: a seat past the Bay is reached
    // first (`farStart`, scenes/bootStartHost.js), so the heir is made, and first saved, there.
    const legacyBirthFailed = (why) => { console.warn(`[legacy] the birth did not take: ${why}`); setRealmNotice(globalThis.sessionStorage, `The heir could not be born: ${why}. The house waits. ${realmNew ? 'Choose who carries it on from the Online page' : 'Load the fallen\'s save to try again'}.`); releaseUnloadGuard(); exitToTitleMenu(); };   // HOUSE-WAITS (FIELD BUGS 2026-10-09f): online the fallen is a tombstone - the Online page names the waiting house
    Promise.all([createChargenFlow(fetchBytes), legacyReady, farStart]).then(([{ careers, spellsByIndex: sbi, factionDict }, host]) => {
      boot.spellsByIndex = sbi;
      const r = host?.bornResult({ careers, factionDict });
      if (!r) { legacyBirthFailed('no birth waits for this address'); return; }
      finishChargen(playerEntity, r, sbi);
      if (sharedClockOn()) playerEntity.lastSkillCheckTime = Math.floor(ownMinutes());   // AUDIT LIVED1b R4, as the wizard's
      preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture }, { race: r.race, gender: r.gender, faceIndex: r.faceIndex });
      surfacePlayer();
      questInitAtGameStart();
      autoBuildArms(playerEntity);
      if (realmNew) { legacyRealmBirth(host).catch((e) => { console.error('[legacy] the online birth failed', e); realmLost('server'); }); return; }   // LEGACY7: born into the realm
      host.onBorn();
      // AUDIT LEGACY B7: the born member is saved (onBorn) - this page is that save's now, so a reload loads them
      const key = newestSaveOf(enumerateSaves().info, String(playerEntity.characterId ?? ''));
      if (key >= 0) { try { globalThis.history.replaceState(globalThis.history.state, '', `${location.pathname}${loadSearch(location.search, key)}`); } catch { /* a page that refuses keeps its address; the menu's Load still finds them */ } }
    }).catch((e) => legacyBirthFailed(e?.message ?? String(e)));
  } else if (!playerEntity.chargenDone && params.has('class')) {
    // AUDIT 17f: ?class=N is the headless skip - parsed here for the
    // DUNGEON the host might build, but never honoured for the host's
    // own chargen, so a town boot had no way past the overlay.
    loadSpellIndex(fetchBytes).then((sbi) => { boot.spellsByIndex = sbi; return applyHeadlessChargen(playerEntity, Number(params.get('class')), { fetchBytes, spellsByIndex: sbi }); })
      .then(() => {
        preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
          { race: playerEntity.race, gender: playerEntity.gender, faceIndex: playerEntity.faceIndex });
        surfacePlayer();
        questInitAtGameStart();   // Q4-v: OnStartGame for the headless character
        boot.legacyHost?.onCharacterMade();   // LEGACY1: and its family
      })
      .catch((e) => console.warn('[chargen] CLASS*.CFG unavailable; the interim entity stands in', e));
  } else if (!playerEntity.chargenDone && !params.has('load')
    && !(params.has('classicload') && peekPendingClassicSave())) {
    // AUDIT 24: not when a SAVE is about to load - its chargenDone arrives after the boot walk, so the wizard would
    // mount over the game the player asked to resume. SAV3: a classic import is a load by another door, but only with
    // a real pending SaveGames (a stale ?classicload has nothing to import).
    // AUDIT 17i: ONE construction seam - the flow arrives with every
    // dependency already attached (careers, SPELLS.STD, the biography question sets), so a host cannot forget one:
    // three bugs came from hosts wiring these by hand.
    createChargenFlow(fetchBytes).then(({ flow, spellsByIndex: sbi }) => {
      boot.spellsByIndex = sbi;   // M2
      setLoadingAside('window', true);   // AUDIT LOAD1 2: the wizard is shown mid-boot, before any frame asks - it is the player's, never under the screen
      townTalk.showOverlay(createChargenWindow(flow, {
        // ui-chargen-4: the race screen's back cancels the wizard to
        // the front door (DFU unwinds to the start screen); the
        // reload re-runs the boot flow.
        // AUDIT-MACL F3: ...and the guard stands down first, because
        // this is a door the GAME opened - the same law `exitToTitleMenu`
        // follows. A player who presses Cancel has asked to leave.
        onCancel: () => { releaseUnloadGuard(); location.reload(); },
        startChoice: starts.page,   // START2: where the story begins - the page past the Bay's starts (ui/startChoice.js)
        onDone: (r) => {
          setLoadingAside('window', false);   // AUDIT LOAD1 2: a boot still going stands its screen again; the frame asks from its first
          finishChargen(playerEntity, r, sbi);
          // AUDIT LIVED1b R4: DFU's AssignCharacter stamps the skill check at WorldTime.Now (PlayerEntity.cs:881); chargen
          // stamps the classic game's start, which is now offline - online the character's clock begins at the world's,
          // months past it, and the six-hour gate was open at birth
          if (sharedClockOn()) playerEntity.lastSkillCheckTime = Math.floor(ownMinutes());
          preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture },
            { race: r.race, gender: r.gender, faceIndex: r.faceIndex });
          surfacePlayer();
          questInitAtGameStart(r.startKey);   // Q4-v: OnStartGame for the new character - START2: where their story begins
          autoBuildArms(playerEntity);   // MWA1: the new character's arms - race, sex and face are known now
          boot.legacyHost?.onCharacterMade(r.legacyModel ?? null);   // LEGACY1: the family founded at the character's birth (D9), its model the question's answer
          if (realmNew) starts.settled.then(realmBirth).catch((e) => { console.error('[realm] the birth failed', e); realmLost('server'); });   // REALM P1.3: born online - START2: where the story begins
        },
      }));
    }).catch((e) => console.warn('[chargen] CLASS*.CFG unavailable; the interim entity stands in', e));
  }
}
