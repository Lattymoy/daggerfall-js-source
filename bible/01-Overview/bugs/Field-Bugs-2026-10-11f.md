# FIELD BUGS 2026-10-11f - "I can't do that disenchant thing"

Mac, in a session: "Here's a report. Also can't refund a station even though I think my enchanter is bugged now because I
can't do that disenchant thing". The report itself never arrived - the message carried no attachment and no paste - so
this wave is read from the two sentences alone, on the code as it stands at main's `ee56a34a`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "I think my enchanter is bugged now because I can't do that disenchant thing" | a home's enchanting station (`DECOR_STATION_FEES` 200,000) pressed opened Daggerfall's item maker and nothing else; Disenchanting (PROF12, `06-Systems/Professions-Arc.md` 37) stood at the foot of the Stores page, its last section, with no door to it from the station - and the Professions page told the player to disenchant "at an enchanting station", where the press never offered it. The alchemy station's brew the same | fixed (STATION-DOOR) |
| 2 | "can't refund a station" | not a fault: a station's fee is a licence and never comes back (STATION-FEES, 2026-09-27; `Field-Bugs-2026-09-27g.md`) - the panel says so before it is paid ("Make station - 200,000 gold") and on the unmaking ("Unmake station (nothing back)") | unchanged - the owner's call, below |

## STATION-DOOR: a station's press offers its profession's act (1)

`scenes/worldModes.js` useDecorStation, openStationMaker, offerStationActs; `ui/professions/profPages.js` STORES_ACT_STATIONS,
focusStoresStation.

FOUND. HOME-STATIONS (`06-Systems/Online-Arc.md`, THE PRESS) made a pressed station open its craft's Daggerfall maker
through the guild service's door - the potion maker, the spell maker, the item maker. PROF12 then put the Alchemy and
Enchanting professions' own acts - the brew and Disenchanting - on the Stores page, at "an enchanting station (a Mages
Guild hall or your own home)", and left the press as it was. So a player standing at their own 200,000-gold enchanting
station pressed it, met the item maker, found no Disenchant in it, and read the station as broken. Nothing was broken
behind the door: `enchantHere` answers the home's station, and the Stores page's The Enchanting Station takes a crafted
piece apart there - but nothing led to it, and the section is the page's last, under the Stores' materials and every
other station's.

THE LAW. A station whose Daggerfall maker stands beside a profession's act on the Stores page - the alchemy station
(Brew) and the enchanting station (Disenchant), `STORES_ACT_STATIONS` - asks first, online (`forgeOffered`, the page's
own gate): "1 - Make Potions" or "1 - Make Magic Items" (Daggerfall's own service labels, `SERVICE_LABEL`, found through
the station's service's destination), "2 - Brew (Stores page)" or "2 - Disenchant (Stores page)", and Esc. One opens the
maker as the press always did; two opens the Stores page, which scrolls to that station's section once it is drawn
(`focusStoresStation`, read once - the settings rail's landing, `enhancedMenu.js` optScrollTo). Offline, where the page
is not, the press is the maker's alone, as before. The spellmaking station (no act on the page) and the page's own
stations (the forge, the workbench, the loom, the mason's and the jeweller's benches, which open the page) are
unchanged. THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: the chooser leaves the room's slot before either door opens,
so the maker's "not ready" reads the slot as it is and the pause opens on a free one.

The Professions page's two lines say where the acts are done: "... at an enchanting station (a Mages Guild hall or your
own home) from the Stores page", and the brew's the same (`ENCHANTING_HOW`, `ALCHEMY_HOW`).

THE FOUR HOSTS. `scenes/worldModes.js` (building interiors - a home's, a hall's and a caravan's rooms, where every
station stands) is wired. `scenes/world.js` hands the Stores page its stations as before and needs nothing: the
chooser is the interior's press. `scenes/exterior.js` (the fixed city) and `scenes/dungeonContext.js` stand no
station (Professions-Arc 22's law), so neither has a press to change.

NOT CHANGED. A Mages Guild hall's enchanter is Daggerfall's service popup, 1:1; Disenchanting there is still the Stores
page's, which the Professions page's line now names. The account service is untouched - no deploy.

Pinned by `test/net/fb1011f_stationdoor.test.js` (8): the three host functions lifted from `worldModes.js` and run over the
real ChoiceWindow and the real service tables - the chooser's lines and options, each door, Esc, the maker's "not
ready", offline, the spellmaking and forge stations, a visitor - and the real Stores page's landing with a recording
frame. `tools/mutants/fb1011f_stationdoor.json` (14, all dead). `test/ui/homestations.test.js`'s press pin re-aimed by
content (the maker's call moved into openStationMaker).

## The station's refund (2)

STATION-FEES (2026-09-27, Discord: "Make crafting stations in interiors way more expensive") made a station's fee a
licence for the craft in a piece, not the piece's price: removing the piece gives half of the piece's own price back,
and the licence nothing (`net/decorLaw.js` DECOR_STATION_FEES; `ui/decorPanel.js` decorStationWords). The report's
refund was asked because the station seemed broken; STATION-DOOR is the fix for that. Whether a licence should come back
- whole, half as a piece does, or for a while after it is bought - is the owner's call, and nothing here changes it.
