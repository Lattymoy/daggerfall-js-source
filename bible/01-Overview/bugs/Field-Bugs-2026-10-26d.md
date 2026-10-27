# FIELD BUGS 2026-10-26d - "Is it possible to recover items that disappeared after a patch?"

One Discord thread, handed over by the owner. Read on main's `56eb3cb15a`, reproduced in the running game against the
real account service and relay in local workerd (`tools/loadHarness.mjs` standServices), in headed Edge.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Andry: "It was a ruahn's chest piece on my warrior character, the daedric set from Dagon" - "This morning around 10 A.M. Central time USA shortly after a Dagon fight and nothing else that I noticed. I logged back on and only the chest slot was empty" | A realm character's close or reload saved nothing: the page gave its lease up before its own checkpoint ran, so everything since the last landed checkpoint (up to five minutes) was lost | CLOSE-SAVE |

## CLOSE-SAVE - `src/systems/realmSaves.js`, `src/scenes/world.js`

WHAT DFU DOES. Nothing to follow: Daggerfall Unity saves to the player's own disk, and has no realm or lease
(`06-Systems/Realm-Arc.md` section 1).

WHAT THE PORT DID. A realm character is saved by its checkpoints: one every five minutes (`ONLINE_CHECKPOINT_MS`), one
before each act, and one as the page hides (`whenPageHides`, on `visibilitychange`). As the page goes (`whenPageGoes`,
on `pagehide`) the session gives its lease up with a keepalive leave and marks itself `left`. The comment beside the
leave said the checkpoint "the page asked as it hid" bounded what a close costs. That assumed `visibilitychange` comes
first. It does not: a close, a reload and a navigation fire `beforeunload`, then `pagehide`, then `visibilitychange`
(the HTML spec's unload steps; measured in Edge for all three). The hidden page's checkpoint therefore ran on a session
already `left`, and `realmCheckpoint` refused it. RESCUE-SAVE's device copy was never written, because no save was
handed over. Nothing reached the service and nothing stayed on the device.

The 14:42 and 14:54 UTC deploys of 2026-10-26 changed no item, save or realm code. They are the trigger only: an
update asks every player to reload.

MEASURED, before the fix (main `56eb3cb15a`, the pre-update build `cf20b37141`, one origin):

- Ruhn's Warden-Plate minted by `aetheric.js` mintAetheric and worn through `equip.js` equipItem, a checkpoint asked,
  the page closed, the new build's boot: the plate worn. The update itself drops nothing a landed save holds.
- The same with no checkpoint asked: the record still at the join's sequence without the plate, no device copy, and at
  the next boot the plate gone (pack 47 to 46). The same on the new build alone.
- A gate's spoils record written as `spoilsPool.js` spend writes it, then a reload: the plate handed back by the crash's
  door (`recoverSpoils`), unworn. The court's own safety net holds; this report's piece most likely reached the pack by
  another door (the Lost and Found's mailbox, for one). Not proven.

THE FIX. The session's `leave` takes the host's checkpoint as `save` and asks it before the lease goes; world.js's
pagehide statement hands it `onlineCheckpoint`. The save is composed and handed over synchronously, and the leave keeps
it on the device at once (`keepNow(going)`): a long life's save as it stands, never packed off the frame, which a going
page never finishes. Its put may land (the copy is then the save the realm holds, and the join drops it -
`settleMovedCopy`) or be cut off (the copy follows the record's sequence, and the join plays it).

PINNED. `test/systems/auditrealm2_client.test.js` (CLOSE-SAVE in the host) mounts world.js's own pagehide and
visibilitychange statements over the real session and Worker and fires them in the browser's order;
`test/server/rescuesave.test.js` (CLOSE-SAVE) holds the long save's synchronous copy. Mutant records:
`auditrealm2_client.json` CLOSE-SAVE-host-leaves-without-the-save, `rescuesave.json`
CLOSE-SAVE-a-going-page-packs-off-the-frame.

NOT RECOVERED HERE. The plate a player lost before this fix is not on any device. Staff restore it
(`/v1/staff/item/give`); the census trail (`/v1/staff/census/find`, `/v1/staff/contested/piece`) shows which records held
it.
