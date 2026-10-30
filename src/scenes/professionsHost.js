// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { accountRefusalText, storedSession } from '../net/accountClient.js';
import { addItem } from '../systems/inventory.js';
import { affixLine, reforgeableLines, reforgeCount } from '../systems/loot/lootRarity.js';
import { allyCastFrame } from '../systems/allyCast.js';
import { appStorage } from '../systems/appStorage.js';
import { audio } from '../systems/audio.js';
import { BAG_KG_LIMIT, madeWhere, movedFirstText } from '../net/bagLaw.js';
import { heldKeysOf as bagHeldKeysOf, heldOf as bagHeldOf, roomFor as bagRoomFor, bagWeight, emptyBagIntoPack, hasBag } from '../systems/materialsBag.js';
import { billboardSize } from '../world/rmbFlats.js';
import { bodiesHere, createBodyStamps, huntKind } from './huntHost.js';
import { BREW_KEPT_TEXT, brewedText } from '../systems/alchemyItems.js';
import { chainStopText, refinedText } from '../net/chainLaw.js';
import { characterIdOf } from '../systems/characterId.js';
import { chiselBand, DISH_LEVEL, facetBand, heatBand, panBand, planeBand, QUALITY_NAMES, recipeById, stitchBand } from '../net/recipeLaw.js';
import { controllerLook } from '../player/lookFilter.js';
import { craftedText, essenceReforgeRefusal, mintPieces, REFORGE_LOST_TEXT, reforgeItem, storedText, TEMPER_LOST_TEXT, TEMPER_MOVED_TEXT, temperItem } from '../systems/smithItems.js';
import { craftXpText } from '../ui/craftXpWords.js';
import { createFishItem } from '../systems/deepWater/deepWatersFishItems.js';
import { createGatherHost } from './gatherHost.js';
import { createProfHud } from '../ui/professions/profHud.js';
import { currentWeather } from '../systems/weather/weatherSim.js';
import { cursorActive, holdCursor, requestLook, setCursorActive } from '../player/pointerLock.js';
import { deductGold, totalGoldAmount } from '../systems/court.js';
import { disenchantableOf, setProfessionsPages } from '../ui/professions/profPages.js';
import { feetWaterCoverage, SWIM_COVERAGE } from '../player/exteriorSurface.js';
import { fieldOfView } from '../ui/viewSettings.js';
import { fishKind } from './fishHost.js';
import { flatBatchAabb } from '../render/frustum.js';
import { getInteractionMode } from '../player/interactionMode.js';
import { getPref } from '../systems/uiPrefs.js';
import { hallStepsFor } from '../net/fortLaw.js';
import { hasSkillet } from '../systems/survival/camp.js';
import { held, pressed } from '../ui/input.js';
import { herbKind } from './herbHost.js';
import { isEquipped } from '../systems/equip.js';
import { isInLocationRect, locationWorldRect, worldCoordToMapPixel } from '../world/streamingWorld.js';
import { isPlayerInTown } from '../systems/nearbyObjects.js';
import { itemLongName } from '../systems/item/itemInfo.js';
import { liveStat } from '../systems/statMods.js';
import { materialCountLabel, materialLabel } from '../systems/professions/profItems.js';
import { materialPicture } from '../ui/menu/menuPicture.js';
import { mineKind } from './mineHost.js';
import { overlayOpen } from '../ui/enhanced/enhancedOverlays.js';
import { pieceQuality, reforgeEssence, temperRecipeOf, temperRefusal } from '../net/temperLaw.js';
import { plaqueActionFor, plaqueStep } from '../systems/quickLoot.js';
import { playerEntity } from '../characters/playerEntity.js';
import { professionName, smeltRecipe, stockOf, trackOf } from '../net/professionLaw.js';
import { realmGoldAct } from '../systems/realmSaves.js';
import { registerPlayerKillListener } from '../systems/playerKills.js';
import { reticleAnchor, worldPlaqueOn } from '../ui/worldPlaque.js';
import { SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } from '../world/terrain/terrainSampler.js';
import { setFeastShare, shareFeastWith } from '../systems/cookItems.js';
import { showHaul } from '../ui/pickupFeed.js';
import { skyMinutes } from '../systems/worldTick.js';
import { treeKind } from './treeHost.js';
import { trophyDoor } from '../systems/hunt/trophies.js';
import { utcDayOfMs } from '../net/nodeLaw.js';

/** @param {any} host */
export function createProfessionsHost(host) {
  const {
    BAG_DEPOSIT_KEPT_TEXT, actKeyWord, built, cam, canvas, collider, cookFireHere, craftStation, csaRuntime,
    deepWaters, exteriorFoes, gamePaused, getTexture, heightAt, locationIndex, maps, marksBook, motherlodeBook,
    pieceKept, player, playerTravelPixel, profBook, profChoose, profMint, profMintCraft, realmSession, renderer,
    saveSoon, seatHere, state, toldBalance, townTalk, uploadRecord, walkMode, workbenchHere
  } = host;
  // PROF1/PROF2 (bible/06-Systems/Professions-Arc.md 22, 23): THE GATHERING PROFESSIONS IN THE STREAMING WORLD - the day's
  // herb patches, veins and boulders on every built wilderness pixel, the prompt, the act, the answer (scenes/gatherHost.js,
  // its kinds scenes/herbHost.js and scenes/mineHost.js); the HUD's pieces its (ui/professions/profHud.js). Online only, and only once
  // the account service has said the professions are this account's.
  if (profBook) {
    const hud = createProfHud({ anchor: () => reticleAnchor(canvas, fieldOfView()) });   // PROF-RETICLE: the act's marks round the crosshair, through the frame's own lens
    if (hud) {
      // PROF7 (bible/06-Systems/Professions-Arc.md 29): A BODY MY OWN BLOW FELLED - stamped at the kill (the street's, the
      // dungeon's, a puppet's owner's word), a node where it lies while the pack holds a Skinning Knife
      const bodyStamps = createBodyStamps({ nowMs: () => Date.now() + host._sharedOffsetMs });
      registerPlayerKillListener('hunting', (entity) => { bodyStamps.stamp(entity); });
      // FIELD BUGS 2026-10-07 INDOOR-SKIN: and a building's - its own pool (a quest's rats in a house in town), where the
      // street's was asked and the body was never found
      host.huntBodies = () => bodiesHere(host.modeNow(), { street: exteriorFoes, dungeon: host.modes?.dungeonCtx, interior: host.modes?.interiorFoes }, bodyStamps);
      // AUDIT 32 H8: a body's search opens its loot through its pool's own door, by its key - the street's body window, the
      // dungeon's take; INDOOR-SKIN: a building's body window (its keys are the street's spelling, its pool its own)
      const openHuntLoot = (key) => (host.modeNow() === 'interior' ? host.modes?.openInteriorBody?.(key)
        : key.startsWith('foeCorpse:') ? host.openBodyLoot(key) : host.modes?.dungeonCtx?.takeLoot(key, getInteractionMode()));
      const _fishSeaT = [0, 0, 0];   // HIGH-CAST: the sea's top's translation, the fish host's waterY
      host.gatherHost = createGatherHost({
        book: profBook, hud, kinds: [herbKind({ book: profBook }), mineKind({ book: profBook, lodes: motherlodeBook, marks: marksBook }),   // PROF2b: and the Motherlodes
          treeKind({ book: profBook, renderer, flatBatchAabb, getTexture, billboardSize, uploadRecord }),   // PROF4: Logging's trees
          huntKind({ book: profBook, bodies: () => host.huntBodies(), openLoot: openHuntLoot, trophy: trophyDoor(saveSoon) }),   // PROF7: Hunting's bodies; HUNTERS-MARK: a Trophy Hunter's trophy
          // PROF8: Fishing's casts - the net in its water, the pixel and its ground the player stands in, the game clock's
          // hour and a storm for the wait, a trophy into the pack (the species' own Deep Waters item)
          fishKind({ book: profBook, host: {
            pixel: () => playerTravelPixel(),
            ground: () => { try { const px = playerTravelPixel(); return { climate: maps.getClimateIndex(px.x, px.y), region: maps.getRegionIndexAt(px.x, px.y) }; } catch { return null; } },
            eye: () => ({ pos: cam.pos, dir: [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)] }),
            feet: () => (walkMode ? player.pos : cam.pos),
            hour: () => Math.floor((((skyMinutes() % 1440) + 1440) % 1440) / 60),   // TIME1: the sky's hour
            storm: () => currentWeather() === 'thunder',
            climateAt: (x, y) => { try { return maps.getClimateIndex(x, y); } catch { return null; } },
            day: () => utcDayOfMs(Date.now() + host._sharedOffsetMs),
            busy: () => !!csaRuntime?.isSailing?.() || !!host.naval?.aiming || !!host.naval?.boarding,   // HELM-NET: no cast at the helm, over the laid guns or in a boarding
            // FIELD BUGS 2026-10-05 SHORE-CAST: the cast's point over water the feet would swim in (MAC2's coverage law) -
            // null off the built ground, which the kind reads as unknown
            waterAt: (pos) => { const g = host.groundSampleAt(pos); const c = g ? feetWaterCoverage(g.tile, g.feet) : null; return c == null ? null : c >= SWIM_COVERAGE; },
            // FIELD BUGS 2026-10-07 HIGH-CAST: the water's surface under the cast - the ground the water lies on (heightAt), or the
            // sea's top over it (tvSeaY's composition: Deep Waters' sea over its carved seabed, else the ground's clamp at
            // OceanElevation); null off the built ground, which the kind reads as unknown
            waterY: (pos) => { const g = heightAt(pos[0], pos[2]); return Number.isFinite(g) ? Math.max(g, (deepWaters?.oceanLocalY ?? SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE) + state.pixelTranslation(state.current.x, state.current.y, _fishSeaT)[1]) : null; },
            // the tug's buzz (5.2: "the pad and phone buzz") - the touch layer's own pulse, under its own pref (TI2)
            tug: () => { if (!getPref('touchHaptics')) return; try { navigator.vibrate?.(120); } catch { /* a platform without it */ } },
            trophy: (species) => {
              const item = createFishItem(species);
              if (!item) return false;
              addItem((playerEntity.items ??= []), item);
              saveSoon.changed();
              return true;
            },
          } })],
        renderer, getTexture, uploadRecord, billboardSize, flatBatchAabb,
        built: () => built, pixelTranslation: (x, y, out) => state.pixelTranslation(x, y, out),
        pixelInfo: (x, y) => { try { return { climate: maps.getClimateIndex(x, y), region: maps.getRegionIndexAt(x, y) }; } catch { return null; } }, settled: (pos) => { const wc = state.worldCoords(pos), p = worldCoordToMapPixel(wc.x, wc.z), loc = locationIndex.get(`${p.x},${p.y}`); return !!loc?.exterior?.exteriorData && isPlayerInTown(loc.mapTableData?.locationType, { mustBeInLocationRect: true, mustBeOutside: true, inLocationRect: isInLocationRect(wc.x, wc.z, locationWorldRect(loc, p.x, p.y)), inside: false }); },   // SETTLE-STAND: the acts' own settlement check (Foraging's 'town'), asked of a node's place
        nowMs: () => Date.now() + host._sharedOffsetMs, haul: (entries) => showHaul(entries),   // HAUL-CARDS: a harvest's goods and XP as one card (the enhanced skin's)
        audio,   // GATHER-FEEL: the bus the gathering's ear says the acts on (systems/gatherSounds.js) - in the street, a dungeon and a building alike, the one host's
        marks: marksBook,   // SILVER-FINDS: a harvest's find said, its balance kept
        eye: () => ({ pos: cam.pos, dir: [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)] }),
        // AUDIT 29 C1: a node seen - the eye's ray to it through the place's collider (the street's, or the dungeon's own)
        clear: (from, to, underground, interior = false) => {
          const c = underground ? host.modes?.dungeonCtx?.collider : interior ? host.modes?.interiorCollider : collider;   // INDOOR-SKIN: a building's own walls
          if (!c?.raycast) return true;
          const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
          const l = Math.hypot(d[0], d[1], d[2]) || 1;
          const room = l - 0.35;
          return room <= 0 || !(c.raycast(from, [d[0] / l, d[1] / l, d[2] / l], room) < room);
        },
        view: () => ({ yaw: (cam.yaw * 180) / Math.PI, pitch: (cam.pitch * 180) / Math.PI }),
        feet: () => (walkMode ? player.pos : cam.pos),
        entity: () => playerEntity,
        keyLabel: (a) => actKeyWord(a) ?? '?',   // TOUCH-HOLD: a pad in hand, its button
        // ACT-CLICK (FIELD BUGS 2026-10-01, "minig is broken doesnt work"): the act's strike is the swing's button OR the
        // activation's - mid-act a click was the act's and nothing else (AUDIT 32 H5), so a player who clicked struck nothing
        input: () => ({ held: held(host.keys, 'Interact'), attack: pressed(host.latch.edge, host.keys, 'SwingWeapon') || pressed(host.latch.edge, host.keys, 'ActivateCenterObject'), choice: !csaRuntime?.isSailing() && pressed(host.latch.edge, host.keys, 'ActChoice') }),   // HELM-KEYS: a helm's hands are on the wheel - the up arrow there is More sail's (inputActions.js DEFAULT_SHARES); PROF-MENU: the key steps a node's list
        // PROF-MENU (2026-10-01, Mac: "They should use the same menu the loot menu uses and not an interaction button"): the
        // node is the loot plaque's list where the plaque stands - it names the node, so no prompt does - and the row it
        // has lit is the one a press presses; where none stands (a phone, the classic skins) the node's acts are a list
        plaque: () => worldPlaqueOn(),
        lit: (key) => plaqueActionFor(key),
        choose: (rows, pick) => profChoose(rows, pick),
        step: (n) => plaqueStep(n),
        active: () => walkMode && host.modeNow() === 'exterior' && !townTalk.overlayActive && !host.modes?.deathUp?.() && !host.modes?.transitioning && !host.travelView?.active,   // AUDIT 32 H10: never from under the travel view (its ray is the hidden head's - AUDIT OW5 V2's law for E)
        activeDungeon: () => walkMode && host.modeNow() === 'dungeon' && !host.modes?.dungeonCtx?.uiOverlayActive && !host.modes?.deathUp?.() && !host.modes?.transitioning,   // PROF2: a dungeon's veins
        activeInterior: () => walkMode && host.modeNow() === 'interior' && !host.modes?.overlayHeld && !townTalk.overlayActive && !host.modes?.deathUp?.() && !host.modes?.transitioning,   // INDOOR-SKIN: a building's bodies (its own pool's)
        onSettle: () => { profBook.settle(profMint, profMintCraft).catch(() => {}); }, pointer: (want) => { const relock = () => { if (!cursorActive() && !gamePaused() && !host.pointerSurfaces.size && !(host.modes?.modalWindowUp?.() ?? false) && !overlayOpen() && !host.travelView?.active) requestLook(canvas); }; if (want === 'look') { if (cursorActive()) { setCursorActive(false); relock(); } return null; } if (controllerLook()) return null; const off = holdCursor(); return () => { if (!off()) return; if (host.backButtonHeld) host.escRelock = relock; else relock(); }; },   // HERB-CURSOR (FIELD BUGS 2026-10-02 part four): the Basket's glints are clicked with the cursor, held free while it plays and the look taken back after (never under a window, a surface, an overlay, the travel view or the player's own freed mouse); a vein's, a body's or the net's act is aimed by the look - a mouse the player freed is taken back, under the same gates (AUDIT A4). AUDIT A1: an Escape that ended the act asks on its keyup (escRelock) - a lock taken inside its keydown was the browser's to end on the keyup, and ESC-LOCK read that as a second Escape; C8: a pad in hand strikes with its trigger, and no hold shows the OS pointer
      });
      /** AUDIT PROF-541 B4: the town the alchemy station stands in, where my guild holds it - its Apothecary's steps, and
       *  the seat a brew names (null where no step stands); AUDIT PROF-541 R2-H1: every station's by one law, by profession
       *  (fortLaw.js hallStepsFor) */
      const myHall = (profession) => hallStepsFor(seatHere(host._musicLoc?.mapTableData?.mapId), host.guildBook?.guild?.id ?? null, profession);
      const alchemyHall = () => myHall('alchemy');
      setProfessionsPages({
        book: profBook, name: (k) => materialLabel(k), withdraw: (k, n) => profBook.withdraw(k, n, profMint),
        picture: (k, wake) => materialPicture(k, { onReady: wake }),   // MENU-ORDER: a material card's picture
        settle: () => profBook.settle(profMint, profMintCraft),   // AUDIT 29 C4: a kept withdrawal asked again when the Stores page opens; PROF3: and a kept craft
        // BAG1 (bible/06-Systems/Materials-Bag.md): THE STORES PAGE'S OTHER HALF - what is carried put in (the bag's first,
        // then the pack's), in a town; the bag's load, and the room the bag and the pack have left
        // FB1020c ONE-SAVE: the page's put-ins as one batch (profBook.js depositMany: one save for them all, each its own
        // `order` - LOOT-LOOSE's `work` puts a looted unit in as loose), each answered in its own words
        deposit: async (plan) => (await profBook.depositMany(plan)).map((r, i) => (r?.ok ? { ok: true, text: `${plan[i].qty} ${materialCountLabel(plan[i].material, plan[i].qty)} put in the Stores.` }
          : { ok: false, kept: r?.kept === true, text: r?.kept ? BAG_DEPOSIT_KEPT_TEXT : accountRefusalText(r?.error) })),   // AUDIT BAG1: `kept` - Put everything in stops on it
        inTown: () => host._storesReached(),
        room: (k) => bagRoomFor(playerEntity, k),
        carriedHeld: (k) => bagHeldOf(playerEntity, k, { counter: false }),   // AUDIT TOWN-ECON 2 PRICE-2: the Stores page never puts a counter's piece in
        heldKeys: () => bagHeldKeysOf(playerEntity),   // UNCOUNTED: what is held that the Stores will not take, named
        bag: () => ({ has: hasBag(playerEntity.items), kg: bagWeight(playerEntity), max: BAG_KG_LIMIT, count: playerEntity.bagItems?.length ?? 0 }),
        // AUDIT2 BAG1 H1/U2: the bag emptied into the pack, from the Stores page - anywhere, on either skin
        emptyBag: () => { const r = emptyBagIntoPack(playerEntity); if (r.moved > 0) saveSoon.changed(); return r; },
        // PROF2 (bible/06-Systems/Professions-Arc.md 23): THE FORGE - the one the player stands at (a Weaponsmith's or an
        // Armorer's, its fee a smelt from the purse, paid on the service's answer; a home's forge), and a smelt through it
        forge: () => host.modes?.forgeHere?.() ?? null,
        // PROF3 (bible/06-Systems/Professions-Arc.md 24): THE ANVIL beside it - a craft through the book, its pieces into
        // the pack (kept until minted), the smith's fee a craft on the service's answer, as a smelt's; the smith's stock;
        // the heat's band, Smithing's attribute pair
        craft: async (recipe, { clean, heartwood = false, dye = null, cracked = false, ...more }) => {   // MASTER-ART: `more` the page's other asks (a Master's work's lines), handed on
          // PROF4: the station is the recipe's - the anvil for Smithing's, the workbench for Carpentry's; PROF7: the loom
          // for Outfitting's
          const st = craftStation(recipeById(recipe)?.profession);
          const f = st.here();
          if (!f) return { ok: false, text: `You are not at ${st.a}.` };
          if (f.fee > 0 && totalGoldAmount(playerEntity) < f.fee) return { ok: false, text: `The ${f.who ?? st.who} asks ${f.fee} gold for the use of the ${st.noun}.` };   // CARP-YARD: the joinery's carpenter
          // AUDIT 30 C4: the fee rides the kept craft and is paid as its pieces are minted (profMintCraft) - by this press's
          // answer, or a settle's later; A4: the workbench's kept word its own
          // SEAT2b part two (Seats-Arc 7.5): the town the station stands in, where my guild holds it and its crafting halls
          // step this craft (fortLaw.js hallStepsFor) - the service asks the Charter again (professions.js seatStepsFor)
          const { seat } = myHall(recipeById(recipe)?.profession);
          const r = await profBook.craft(recipe, { clean, heartwood, dye, cracked, fee: f.fee > 0 ? f.fee : 0, name: typeof playerEntity?.name === 'string' ? playerEntity.name : null, seat, ...more }, profMintCraft);   // PROF10: a Lapidary's cracked gem
          // CRAFT1 (bible/06-Systems/Professions-Arc.md 41): the chain's works the craft ran first - said, made or refused
          // AUDIT CRAFT1 F3: a kept craft says it too; F4: and a refused one where the chain stopped
          const chain = [refinedText(r?.refined, materialLabel, (prof) => profBook.track(prof)), r?.ok ? '' : chainStopText(r?.stopped, r?.material, materialLabel)].filter(Boolean).join(' ');
          if (!r?.ok) return { ok: false, text: r?.kept ? `${st.kept}${chain ? ` ${chain}` : ''}` : `${accountRefusalText(r?.error)}${movedFirstText(r)}${chain ? ` ${chain}` : ''}` };
          const paid = f.fee > 0 && !r.elsewhere;
          const rec = recipeById(recipe);
          const made = rec?.kind === 'siege' ? storedText(rec.name, Number(r.data.count) || 1) : craftedText(mintPieces(r.data));   // SEAT2b part two: a Ram Kit is the Stores'
          return { ok: true, text: `${chain ? `${chain} ` : ''}${made} ${craftXpText(rec, r.data, st.xp, profBook.limit(rec?.profession))}${paid ? `, and paid the ${f.who ?? st.who} ${f.fee} gold` : ''}.` };   // CRAFT-LIMIT-SAID: and the crafter's limit, where it now holds the track
        },
        stock: async (material, qty, counter = stockOf(material)?.counter) => {
          const r = await profBook.stock(material, qty);
          toldBalance(r?.data?.balance);   // PROF5 (FOUND): the Bank's balance told too; AUDIT 32 B3: and the market's
          const who = counter === 'furnisher' ? 'furnisher' : counter === 'weavers' ? 'Weavers' : counter === 'apothecaries' ? 'Apothecaries' : 'smith';   // PROF12: the Apothecaries' sixteen   // PROF4: the furnisher's Linen; PROF7: the Weavers' at the tailor's
          return r?.ok ? { ok: true, text: `Bought ${r.data.qty} ${materialCountLabel(material, r.data.qty)} from the ${who} for ${r.data.marks} silver.` } : { ok: false, text: accountRefusalText(r?.error) };
        },
        heatBand: () => heatBand({ strength: liveStat(playerEntity, 'strength'), agility: liveStat(playerEntity, 'agility') }),
        // PROF4 (bible/06-Systems/Professions-Arc.md 25): THE WORKBENCH the player stands at, and the plane's band
        workbench: () => workbenchHere(),   // CARP-YARD: and a joinery's in the street
        planeBand: () => planeBand({ agility: liveStat(playerEntity, 'agility'), willpower: liveStat(playerEntity, 'willpower') }),
        purse: () => totalGoldAmount(playerEntity),   // AUDIT 30 U13: a station's fee the purse cannot meet is not offered
        // PROF7 (bible/06-Systems/Professions-Arc.md 29): THE LOOM the player stands at, the stitch's band, and the clothing
        // it shows first - the player's own, as DFU's Clothing Store shelves it
        loom: () => host.modes?.loomHere?.() ?? null,
        stitchBand: () => stitchBand({ agility: liveStat(playerEntity, 'agility'), speed: liveStat(playerEntity, 'speed') }),
        // PROF11 (bible/06-Systems/Professions-Arc.md 9.3, 9.4): THE MASON'S BENCH the player stands at, and the chisel's band
        mason: () => host.modes?.masonHere?.() ?? null,
        chiselBand: () => chiselBand({ strength: liveStat(playerEntity, 'strength'), endurance: liveStat(playerEntity, 'endurance') }),
        // PROF9 (bible/06-Systems/Professions-Arc.md 9.3, 9.4): THE FIRE the player stands at, the pan's band, and C&C's Skillet
        fire: () => cookFireHere(),
        panBand: () => panBand({ intelligence: liveStat(playerEntity, 'intelligence'), personality: liveStat(playerEntity, 'personality') }),
        skillet: () => hasSkillet(playerEntity?.items),
        // AUDIT PROF-541 K7: the town Apothecary's steps a dish's XP takes here - the seat the craft below sends (where my
        // guild holds the town; professions.js seatStepsFor asks the Charter again), so the fire's line says the XP the service pays
        cookSteps: () => myHall('cooking').steps,
        // PROF10 (bible/06-Systems/Professions-Arc.md 9.3, 9.4): THE JEWELLER'S BENCH the player stands at, and the facet's band
        jeweller: () => host.modes?.jewellerHere?.() ?? null,
        // AUDIT PROF-541 R2-C6: and the town Apothecary's quality steps a piece takes there - the seat the craft sends, as cookSteps
        jewelSteps: () => myHall('jewelcrafting').steps,
        // PROF12 (bible/06-Systems/Professions-Arc.md 9.3, 37): THE ALCHEMY STATION the player stands at (an Alchemist's, its
        // fee a brew; a home's), a brew through the book - its potions into the pack, kept until minted, the fee paid as they
        // are - under the Apothecary's steps where my guild holds the town; the transmutations ride the smelt below
        alchemy: () => host.modes?.alchemyHere?.() ?? null,
        // AUDIT PROF-541 B4: the Apothecary's steps where my guild holds the town the station stands in - the station's
        // Potent chance says them, as the service adds them (professions.js seatStepsFor)
        alchemySteps: () => alchemyHall().steps,
        brew: async (potion, keys) => {
          const f = host.modes?.alchemyHere?.() ?? null;
          if (!f) return { ok: false, text: 'You are not at an alchemy station.' };
          if (f.fee > 0 && totalGoldAmount(playerEntity) < f.fee) return { ok: false, text: `The alchemist asks ${f.fee} gold for the use of the station.` };
          const { seat } = alchemyHall();
          const r = await profBook.brew(potion, keys, { fee: f.fee > 0 ? f.fee : 0, seat }, profMintCraft);
          if (!r?.ok) return { ok: false, text: r?.kept ? BREW_KEPT_TEXT : r?.error === 'prof-busy' ? 'Your hands are busy with another craft.' : `${accountRefusalText(r?.error)}${movedFirstText(r)}` };
          const paid = f.fee > 0 && !r.elsewhere;
          return { ok: true, text: `${brewedText(r.data)} (+${r.data.xp} ${professionName('alchemy')} experience)${paid ? `, and paid the alchemist ${f.fee} gold` : ''}.` };
        },
        // PROF12: THE ENCHANTING STATION the player stands at (a Mages Guild hall, its fee a piece; a home's), the pack's crafted
        // pieces it lists (DISENCHANT-SAID: made by the page's module - profPages.js disenchantableOf - a piece under one
        // Essence among them, greyed with its reason) and a disenchant: the piece out of the pack on the service's answer,
        // its Essence in the Stores
        enchanter: () => host.modes?.enchantHere?.() ?? null,
        disenchantable: () => disenchantableOf(playerEntity.items, { kept: pieceKept, book: profBook }),
        disenchant: async (provenance) => {
          const owner = characterIdOf(playerEntity), account = storedSession(appStorage())?.id;
          const pack = playerEntity.items;
          const here = () => owner === characterIdOf(playerEntity) && account === storedSession(appStorage())?.id && pack === playerEntity.items;
          const f = host.modes?.enchantHere?.() ?? null;
          if (!f) return { ok: false, text: 'You are not at an enchanting station.' };
          if (f.fee > 0 && totalGoldAmount(playerEntity) < f.fee) return { ok: false, text: `The enchanter asks ${f.fee} gold to take a piece apart.` };
          const it = (playerEntity.items ?? []).find((x) => x?.provenance === provenance) ?? null;
          const name = it ? itemLongName(it) : 'the piece';
          // the piece out of the pack - once (a `repeat` finds it gone already); `out` what this press took, and where
          let out = null;
          const takeOut = () => {
            const at = (playerEntity.items ?? []).findIndex((x) => x?.provenance === provenance);
            if (at >= 0) out = { piece: playerEntity.items.splice(at, 1)[0], at };
            return at >= 0;
          };
          let r;
          if (realmSession) {
            // AUDIT PROF-541 B2: a realm character's piece leaves its RECORD in the disenchant's own batch - the save
            // checkpointed first, the piece out of the pack inside the hold as the service is first asked (marketBook
            // postGood's order), back on a refusal; silence ends the session and a join reads the record
            let asked = false;
            r = await realmGoldAct({
              session: realmSession, checkpoint: () => { if (here()) host.onlineCheckpoint(); },
              reserve: () => () => { if (out) { pack.splice(Math.min(out.at, pack.length), 0, out.piece); out = null; } },
              call: (at) => { if (!here()) return Promise.resolve({ ok: false, error: 'elsewhere', elsewhere: true }); if (!asked) { asked = true; takeOut(); } return out ? profBook.disenchant(provenance, at) : Promise.resolve({ ok: false, error: 'prof-piece-gone' }); },
            });
          } else {
            r = await profBook.disenchant(provenance);
            if (r?.ok && here() && !r.elsewhere) takeOut();
          }
          if (!here() || r?.elsewhere) return { ok: false, text: 'Your character changed while disenchanting. Check its Stores when you return.' };
          if (!r?.ok) {
            // AUDIT PROF-541 B2: a disenchant of this account took the piece's record already (an answer lost, the save
            // kept the piece) - the save's copy goes too, as the answer it missed would have taken it
            // AUDIT PROF-541 R2-C1: the Stores and Enchanting's track read again (the answer that moved them was lost);
            // R2-N1: and the enchanter paid the fee the lost press owed, as the answered one pays it
            if (r?.error === 'prof-no-piece' && r?.why === 'disenchanted' && takeOut()) {
              const owed = f.fee > 0 ? Math.min(f.fee, totalGoldAmount(playerEntity)) : 0;
              if (owed > 0) deductGold(playerEntity, owed);
              profBook.refresh({ force: true }).catch(() => {});
              saveSoon.changed();
              return { ok: false, text: `${name} was already disenchanted. Its Essence is in your Stores, and it leaves your pack${owed > 0 ? `; you paid the enchanter ${owed} gold` : ''}.` };
            }
            return { ok: false, text: accountRefusalText(r?.error) };
          }
          const paid = f.fee > 0 && out != null;
          if (paid) deductGold(playerEntity, Math.min(f.fee, totalGoldAmount(playerEntity)));
          // AUDIT PROF-541 R2-C1: a realm act that LANDED (its answer lost, the record one on) says no Stores and no track -
          // the state read again, so the Essence and the XP show now, not at the next read
          if (!r.data) profBook.refresh({ force: true }).catch(() => {});
          saveSoon.changed();
          const got = Number.isSafeInteger(r.data?.essence) ? `${r.data.essence} Arcane Essence (+${r.data.xp} Enchanting experience)` : 'Arcane Essence';   // a landed realm act says no more
          return { ok: true, text: `${name} comes apart into ${got}${paid ? `, and paid the enchanter ${f.fee} gold` : ''}.` };
        },
        // CRAFT4 (bible/06-Systems/Professions-Arc.md 41.7): THE TEMPER at the anvil (the smith's pieces) and the loom (the
        // tailor's) - the pack's pieces a temper takes (Rare or below, below Superior), not worn, no market act kept on them;
        // the step laid on the piece on the service's answer (smithItems.js temperItem), the station's fee a temper
        temperable: (where) => (playerEntity.items ?? []).filter((it) => it && !isEquipped(it) && !temperRefusal(it) && !(typeof it.provenance === 'string' && pieceKept(it.provenance)))
          .map((it) => ({ it, r: temperRecipeOf(it) })).filter(({ r }) => trackOf(r.profession) === (where === 'loom' ? 'outfitting' : 'smithing'))
          .map(({ it, r }) => ({ item: it, name: itemLongName(it), recipe: r.id, quality: pieceQuality(it), provenance: typeof it.provenance === 'string' ? it.provenance : null })),
        temper: async (offer) => {
          const r0 = recipeById(offer?.recipe);
          const loom = trackOf(r0?.profession) === 'outfitting';
          const f = (loom ? host.modes?.loomHere?.() : host.modes?.forgeHere?.()) ?? null;
          if (!f) return { ok: false, text: loom ? 'You are not at a loom.' : 'You are not at an anvil.' };
          const who = loom ? 'tailor' : 'smith';
          if (f.fee > 0 && totalGoldAmount(playerEntity) < f.fee) return { ok: false, text: `The ${who} asks ${f.fee} gold for a temper.` };
          const pack = playerEntity.items, it = offer.item;
          if (!pack?.includes(it) || isEquipped(it) || temperRefusal(it) || pieceQuality(it) !== offer.quality) return { ok: false, text: TEMPER_MOVED_TEXT };
          const name = itemLongName(it);
          const r = await profBook.temper(offer.recipe, offer.quality, offer.provenance);
          if (r?.elsewhere || pack !== playerEntity.items) return { ok: false, text: 'Your character changed while tempering. Check its Stores when you return.' };
          if (!r?.ok) return { ok: false, text: `${accountRefusalText(r?.error)}${movedFirstText(r)}` };
          // the fee for the temper this press made, on the first answer it hears - `repeat` or not (AUDIT 29 C3's law)
          if (f.fee > 0) deductGold(playerEntity, Math.min(f.fee, totalGoldAmount(playerEntity)));
          const took = pack.includes(it) && temperItem(it, r.data);
          saveSoon.changed();
          if (!took) return { ok: false, text: TEMPER_LOST_TEXT };
          return { ok: true, text: `${name} is ${QUALITY_NAMES[r.data.quality]} now (+${r.data.xp} ${professionName(r0.profession)} experience)${f.fee > 0 ? `, and paid the ${who} ${f.fee} gold` : ''}.` };
        },
        // CRAFT4: THE REFORGE WITH ESSENCE at the enchanting station - the pack's known Magic and Rare pieces, not worn, each
        // line the Loot arc's own Reforge may replace (REFORGE-REPLACE: any line another kind can take, the price doubling
        // with the piece's reforges); the line replaced on the service's seed
        reforgeable: () => (playerEntity.items ?? []).filter((it) => it && reforgeEssence(it.rarity) && !essenceReforgeRefusal(it, reforgeableLines(it)[0]))
          .map((it) => ({ item: it, name: itemLongName(it), tier: it.rarity, lines: reforgeableLines(it).map((index) => ({ index, text: affixLine(it, index) })) })),
        essenceReforge: async (offer, index) => {
          const f = host.modes?.enchantHere?.() ?? null;
          if (!f) return { ok: false, text: 'You are not at an enchanting station.' };
          if (f.fee > 0 && totalGoldAmount(playerEntity) < f.fee) return { ok: false, text: `The enchanter asks ${f.fee} gold to reforge a piece.` };
          const pack = playerEntity.items, it = offer.item;
          if (!pack?.includes(it) || essenceReforgeRefusal(it, index) || it.rarity !== offer.tier) return { ok: false, text: TEMPER_MOVED_TEXT };
          const r = await profBook.reforge(offer.tier, reforgeCount(it));   // REFORGE-REPLACE: the piece's count, its price
          if (r?.elsewhere || pack !== playerEntity.items) return { ok: false, text: 'Your character changed while reforging. Check its Stores when you return.' };
          if (!r?.ok) return { ok: false, text: accountRefusalText(r?.error) };
          if (f.fee > 0) deductGold(playerEntity, Math.min(f.fee, totalGoldAmount(playerEntity)));
          const line = pack.includes(it) && r.data?.tier === it.rarity ? reforgeItem(it, index, r.data.seed) : null;
          saveSoon.changed();
          if (!line) return { ok: false, text: REFORGE_LOST_TEXT };
          return { ok: true, text: `Reforged: ${affixLine(it, index)}${f.fee > 0 ? `, and paid the enchanter ${f.fee} gold` : ''}.` };
        },
        facetBand: () => facetBand({ willpower: liveStat(playerEntity, 'willpower'), luck: liveStat(playerEntity, 'luck') }),
        clothing: () => (playerEntity?.gender === 'female' ? 'WomensClothing' : 'MensClothing'),
        marks: () => marksBook?.state?.balance ?? null,   // AUDIT 32 P6: a counter's purchase the Marks cannot meet, said first
        marksOpen: () => marksBook?.state?.open !== false,
        smelt: async (recipe, count, { clean = false } = {}) => {
          // PROF4: the station is the work's - a smelt's and a burn's the forge, a saw's the workbench; PROF7: a cure's and
          // a weave's the loom; PROF11: a cut's and a mix's the mason's bench, its chisel's report with it
          const work = smeltRecipe(recipe);
          const bench = work?.station === 'workbench', loom = work?.station === 'loom', mason = work?.station === 'mason';
          const alch = work?.station === 'alchemy';   // PROF12: a Transmuter's transmutation, at the alchemy station
          const f = (alch ? host.modes?.alchemyHere?.() : mason ? host.modes?.masonHere?.() : loom ? host.modes?.loomHere?.() : bench ? workbenchHere() : host.modes?.forgeHere?.()) ?? null;
          if (!f) return { ok: false, text: alch ? 'You are not at an alchemy station.' : mason ? 'You are not at a mason\'s bench.' : loom ? 'You are not at a loom.' : bench ? 'You are not at a workbench.' : 'You are not at a forge.' };
          const who = alch ? 'alchemist' : mason ? 'mason' : loom ? 'tailor' : bench ? (f.who ?? 'furnisher') : 'smith';   // CARP-YARD: the joinery's carpenter
          if (f.fee > 0 && totalGoldAmount(playerEntity) < f.fee) return { ok: false, text: `The ${who} asks ${f.fee} gold for the use of the ${alch ? 'station' : mason ? 'mason\'s bench' : loom ? 'loom' : bench ? 'workbench' : 'forge'}.` };
          const r = await profBook.smelt(recipe, count, { clean });
          if (!r?.ok) return { ok: false, text: `${accountRefusalText(r?.error)}${movedFirstText(r)}` };
          // the fee for the smelt this press made, on the first answer it hears - `repeat` or not (AUDIT 29 C3: a first
          // answer lost, the same smelt asked again answers `repeat`, and the smith went unpaid); the page holds one press
          // at a time, and the book one ask an id
          if (f.fee > 0) { deductGold(playerEntity, f.fee); saveSoon.changed(); }
          const out = smeltRecipe(r.data.recipe)?.out ?? recipe;
          const made = (Number(r.data.own) || 0) + (Number(r.data.bought) || 0) + (Number(r.data.loose) || 0) || r.data.count;   // AUDIT BAG-CRAFT A1: its loose products too
          const id = String(r.data.recipe);
          const verb = bench ? 'Sawed' : id.startsWith('burn:') ? 'Burnt' : id.startsWith('cure:') ? 'Cured' : id.startsWith('weave:') ? 'Wove'
            : id.startsWith('cut:') ? 'Cut' : id.startsWith('mix:') ? 'Mixed' : alch ? 'Transmuted into' : 'Smelted';   // PROF7: the loom's; PROF11: the mason's; PROF12: the Transmuter's
          // PROF11 (FOUND): the XP said is the work's own profession's - Masonry's at the bench (it said Smithing's whatever
          // the work); a clean chisel and a first work said with it
          const xpWord = professionName(smeltRecipe(r.data.recipe)?.xp ?? 'smithing');
          const how = [r.data.clean === true ? 'a clean chisel' : null, r.data.first === true ? 'your first' : null].filter(Boolean).join(', ');
          const where = madeWhere(r.data.put);   // AUDIT BAG1 B9: where the work went - the bag, the pack, or the Stores' room
          return { ok: true, text: `${verb} ${made} ${materialCountLabel(out, made)}${r.data.xp > 0 ? ` (+${r.data.xp} ${xpWord} experience${how ? `, ${how}` : ''})` : ''}${f.fee > 0 ? `, and paid the ${who} ${f.fee} gold` : ''}.${where ? ` ${where}` : ''}` };
        },
      });
      // PROF9 (bible/06-Systems/Professions-Arc.md 9.3: "the whole party"): A FEAST SHARED - eaten, its spell record goes
      // to every party mate in the room through ALLY-CAST's own frame (systems/allyCast.js allyCastFrame - a beneficial
      // spell, at the dish's level, laid on by the mate's own client as a mate's gift); the names it went to, said
      setFeastShare((spell) => {
        if (!host.online || host.online.status !== 'open' || !host.social?.party) return [];
        // AUDIT PROF-541 K5: the mates at the table - in sight, as a stranger's gift is (online.onCast), never the whole
        // room and its halo; R2-H1: by cookItems.js shareFeastWith
        return shareFeastWith(host.peersNear(), { isMate: (id) => host.social.isPartyPeer(id), send: (id) => host.online.sendCast?.(allyCastFrame(spell, DISH_LEVEL, id)), nameOf: (id) => host.peerName(id) });
      });
    }
  }
}
