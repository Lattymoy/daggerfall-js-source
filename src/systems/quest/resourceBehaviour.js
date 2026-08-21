// THE QUEST RESOURCE BEHAVIOUR (Q4-iii) - QuestResourceBehaviour.cs
// whole. The per-instance bridge between a stood scene object and the
// quest system: click routing (ClickedNpc's door), the foe
// injured/death tracking, the spell/item queue drains, the
// hidden/restrained handling, and the destroy event that uncouples
// the resource. In DFU this is a MonoBehaviour on the GameObject; the
// port's behaviour is a plain object the HOST drives - it calls
// update() each frame-ish tick, doClick() on activation, and
// notifyDestroyed() when the object unmounts.
//
// THE HOST HANDLE (bindHost; every member optional - headless the
// behaviour laws idle exactly as a component with no scene peers):
//   setActive(active)      - GameObject.SetActive (Person hide/show)
//   destroy()              - Destroy(gameObject): unmount the object;
//                            destroyGameObject() calls it then raises
//                            the destroy event, as Unity's teardown
//                            does; a host tearing down on its own
//                            calls behaviour.notifyDestroyed()
//   staticNpcFactionId     - the peer StaticNPC's faction id (number)
//                            or null: DoClick's individual broadcast
//   enemy                  - the DaggerfallEntityBehaviour surface
//                            for a Foe instance, else absent:
//     currentHealth / maxHealth  (getters)
//     setCurrentHealth(n)        - the DeathTrigger zeroing
//     setNonHostile()            - EnemyMotor.IsHostile = false (the
//                                  restrain law; restraintApplied
//                                  latches even with no motor, C#)
//     hasEffectManager()         - EntityEffectManager presence; a
//                                  missing manager PARKS the spell
//                                  queue (position does not advance)
//     assignSpellBundle(spell)   - resolve the SpellReference and
//                                  AssignBundle(BypassSavingThrows);
//                                  a missing record is the seam's own
//                                  skip (C#'s `continue` / logged
//                                  custom-key miss)
//     hasCorpseLootContainer()
//     addItemsToCorpse(items) / addItemsToEntity(items)
//
// KEPT QUIRKS: the injured check RETURNS for the tick (death waits a
// tick behind injury, C#'s comment law); the dead-entity spell gate
// is EXACT zero (negative health still casts); DoClick's individual
// broadcast ASSIGNS its result - an individual questor with no
// matching quest overwrites the direct click's true; restraintApplied
// is NOT in the save shape, so a restrained foe re-applies restraint
// after load.

export class QuestResourceBehaviour {
  constructor(machine, host = null) {
    this.machine = machine;
    this.host = host;
    // the serialized six (QuestResourceSaveData_v1)
    this.questUID = 0;
    this.targetSymbol = null;
    this.isFoeDead = false;
    this.foeSpellQueuePosition = 0;
    this.foeItemQueuePosition = 0;
    this.isAttackableByAI = false;   // never set in core - custom actions only, C#
    // volatile state
    this.restraintApplied = false;
    this.targetQuest = null;
    this.targetResource = null;
    this.enemy = null;               // enemyEntityBehaviour - cached for Foe targets
    this._destroyHandlers = [];
  }

  bindHost(host) {
    this.host = host;
    // a Foe target re-caches its enemy surface off the new host
    if (this.targetResource?.isFoe) this.enemy = host?.enemy ?? null;
  }

  /** AssignResource (:217-224): stamps identity only; CacheTarget
   *  resolves the live objects. */
  assignResource(questResource) {
    if (questResource != null) {
      this.questUID = questResource.parentQuest.uid;
      this.targetSymbol = questResource.symbol;
    }
  }

  /** Start (:124-130). */
  start() { return this.cacheTarget(); }

  /** Update (:132-203), the order verbatim. */
  update() {
    // Ensure target resource has this behaviour assigned - coupling
    // is otherwise lost when reloading a game
    if (this.targetResource != null) {
      if (!this.targetResource.questResourceBehaviour) this.targetResource.questResourceBehaviour = this;
    }

    // Handle NPC checks: a hidden or destroyed person disables even
    // when the quest stopped ticking (the $CUREWER teardown law) -
    // through the RESOURCE's behaviour, as C# routes it
    if (this.targetResource?.isPerson && this.targetResource.questResourceBehaviour) {
      if (this.targetResource.isHidden || this.targetResource.isDestroyed) {
        this.targetResource.questResourceBehaviour.setGameObjectActive(false);
      }
    }

    // Handle enemy checks
    if (this.enemy) {
      const foe = this.targetResource;
      if (!foe) return;

      // If foe is hidden then remove self from game
      if (foe.isHidden) {
        this.destroyGameObject();
        return;
      }

      // Process spell and item queues
      this.castSpellQueue(foe, this.enemy);
      this.addItemQueue(foe, this.enemy);

      // Handle restrained check
      if (foe.isRestrained && !this.restraintApplied) {
        this.enemy.setNonHostile?.();
        this.restraintApplied = true;
      }

      // Handle injured check - BEFORE death or script actions on the
      // injured event would never trigger (C#'s own comment); the
      // return holds death checks to the next tick
      if (this.enemy.currentHealth < this.enemy.maxHealth && !foe.injuredTrigger) {
        foe.setInjured();
        return;
      }

      // Handle death checks
      if (!this.isFoeDead && foe.deathTrigger) this.enemy.setCurrentHealth(0);

      if (this.enemy.currentHealth <= 0 && !this.isFoeDead) {
        foe.incrementKills();
        this.isFoeDead = true;
      }
    }
  }

  /** DoClick (:230-260): click the resource (items also transfer to
   *  the player and hide), then the INDIVIDUAL broadcast - a peer
   *  StaticNPC with an Individual faction clicks that Person in
   *  EVERY quest, and its result ASSIGNS over the direct click's
   *  (the follow-up-quest bootstrap door, C#'s own shape). */
  doClick() {
    let foundInActiveQuest = false;
    if (this.targetResource != null) {
      this.targetResource.setPlayerClicked();
      if (this.targetResource.isItem) this._transferWorldItemToPlayer();
      foundInActiveQuest = true;
    }
    const factionID = this.host?.staticNpcFactionId ?? null;
    if (factionID != null) {
      if (this.machine.isIndividualNPC(factionID)) {
        foundInActiveQuest = this._clickAllIndividualNPCs(factionID);
      }
    }
    return foundInActiveQuest;
  }

  /** CastSpellQueue (:293-351): park while the queue is empty, the
   *  entity is EXACTLY dead, or no effect manager stands; otherwise
   *  hand every queued SpellReference from the position to the seam
   *  and jump the position to the END - a spell the seam cannot
   *  resolve is skipped, never retried, verbatim. */
  castSpellQueue(foe, enemy) {
    if (!enemy || foe == null || foe.spellQueue == null || this.foeSpellQueuePosition === foe.spellQueue.length) return;
    if (enemy.currentHealth === 0) return;
    if (!enemy.hasEffectManager?.()) return;
    for (let i = this.foeSpellQueuePosition; i < foe.spellQueue.length; i++) {
      enemy.assignSpellBundle?.(foe.spellQueue[i]);
    }
    this.foeSpellQueuePosition = foe.spellQueue.length;
  }

  /** AddItemQueue (:353-380): clone the queue with new UIDs and land
   *  it on the CORPSE loot container when one exists (the enemy died
   *  before the drain), else the live entity's items. */
  addItemQueue(foe, enemy) {
    if (!enemy || foe == null || foe.itemQueueCount === 0 || this.foeItemQueuePosition === foe.itemQueueCount) return;
    const clonedItems = foe.getClonedItemQueue();
    if (enemy.hasCorpseLootContainer?.()) enemy.addItemsToCorpse?.(clonedItems);
    else enemy.addItemsToEntity?.(clonedItems);
    this.foeItemQueuePosition = foe.itemQueueCount;
  }

  /** CacheTarget (:390-415). */
  cacheTarget() {
    if (this.targetQuest != null && this.targetResource != null) return true;
    if (this.questUID === 0 || this.targetSymbol == null) return false;
    this.targetQuest = this.machine.getQuest(this.questUID);
    if (this.targetQuest == null) return false;
    this.targetResource = this.targetQuest.getResource(this.targetSymbol);
    if (this.targetResource == null) return false;
    if (this.targetResource.isFoe) this.enemy = this.host?.enemy ?? null;
    return true;
  }

  /** gameObject.SetActive through the handle. */
  setGameObjectActive(active) { this.host?.setActive?.(active); }

  /** Destroy(gameObject): unmount then raise OnDestroy, as Unity's
   *  teardown sequence does. */
  destroyGameObject() {
    this.host?.destroy?.();
    this.notifyDestroyed();
  }

  /** OnDestroy (:205-208) + the event (:465-471). The QuestResource
   *  accessor subscribes here; its handler uncouples the field. */
  onDestroy(handler) { this._destroyHandlers.push(handler); }
  offDestroy(handler) {
    const i = this._destroyHandlers.indexOf(handler);
    if (i >= 0) this._destroyHandlers.splice(i, 1);
  }
  notifyDestroyed() {
    for (const handler of [...this._destroyHandlers]) handler(this);
  }

  /** GetSaveData/RestoreSaveData (:265-291) - the v1 shape; the
   *  Q4-iv envelope carries it. restraintApplied is NOT saved (C#). */
  getSaveData() {
    return {
      questUID: this.questUID,
      targetSymbol: this.targetSymbol,
      isFoeDead: this.isFoeDead,
      foeSpellQueuePosition: this.foeSpellQueuePosition,
      foeItemQueuePosition: this.foeItemQueuePosition,
      isAttackableByAI: this.isAttackableByAI,
    };
  }

  restoreSaveData(data) {
    this.questUID = data.questUID;
    this.targetSymbol = data.targetSymbol;
    this.isFoeDead = data.isFoeDead;
    this.foeSpellQueuePosition = data.foeSpellQueuePosition;
    this.foeItemQueuePosition = data.foeItemQueuePosition;
    this.isAttackableByAI = data.isAttackableByAI;
    this.cacheTarget();
  }

  _transferWorldItemToPlayer() {
    const item = this.targetResource;
    this.machine.deps.giveItemToPlayer?.(item.daggerfallUnityItem);
    // Hide item so player cannot pick it up again despite the
    // SiteLink still standing it
    item.isHidden = true;
  }

  /** ClickAllIndividualNPCs (:428-459): EVERY quest in the machine -
   *  no complete-skip - clicks its matching individual Persons. */
  _clickAllIndividualNPCs(factionID) {
    let matched = false;
    for (const quest of this.machine.quests.values()) {
      for (const resource of quest.resources.values()) {
        if (!resource.isPerson) continue;
        if (resource.isIndividualNPC && resource.factionData?.id === factionID) {
          resource.setPlayerClicked();
          matched = true;
        }
      }
    }
    return matched;
  }
}
