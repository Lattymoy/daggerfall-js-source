// Travel Options 1.11's own setting keys, as its settings file named them, section-dot-name.
// They are a saved setting's name, so they are a fact the pins keep; the mod's file itself left the tree.
export const TRAVEL_OPTIONS_1_11_KEYS = Object.freeze([
  'CautiousTravel.PlayerControlledCautiousTravel', 'CautiousTravel.SpeedPenalty', 'CautiousTravel.MaxChanceToAvoidEncounter',
  'CautiousTravel.HealthMinimumPercentage', 'CautiousTravel.FatigueMinimumValue',
  'StopAtInnsTravel.PlayerControlledInnsTravel',
  'ShipTravel.OnlyFromPorts', 'ShipTravel.OnlyToPorts',
  'GeneralOptions.AllowTargetingMapCoordinates', 'GeneralOptions.LocationPause', 'GeneralOptions.AllowWeather',
  'GeneralOptions.AllowAnnoyingSounds', 'GeneralOptions.AllowRealGrass',
  'TimeAcceleration.DefaultStartingAcceleration', 'TimeAcceleration.AlwaysUseStartingAcceleration', 'TimeAcceleration.AccelerationLimit',
  'Teleportation.EnablePaidTeleportation',
  'RoadsIntegration.Enable', 'RoadsIntegration.VariableSizeDots', 'RoadsIntegration.FollowPathsKey',
  'RoadsIntegration.FollowPathsCustomKeyBind', 'RoadsIntegration.EnableWaterways', 'RoadsIntegration.EnableStreamsToggle',
  'RoadsIntegration.MarkLocationColor',
  'FastTravelCostScaling.FastTravelCostScaleFactor', 'FastTravelCostScaling.ShipTravelCostScaleFactor',
  'RoadsJunctionMap.Enable', 'RoadsJunctionMap.PersistentMap', 'RoadsJunctionMap.ToggleMapOffPaths', 'RoadsJunctionMap.ScreenSize',
  'RoadsJunctionMap.ScreenPositionX', 'RoadsJunctionMap.ScreenPositionY', 'RoadsJunctionMap.FilterMode', 'RoadsJunctionMap.Circular',
  'RoadsJunctionMap.PlayerColor', 'RoadsJunctionMap.Opaque', 'RoadsJunctionMap.BackgroundColor',
  'LocationColours.DungeonLabyrinth', 'LocationColours.DungeonKeep', 'LocationColours.DungeonRuin', 'LocationColours.Graveyard',
  'LocationColours.Coven', 'LocationColours.Farm', 'LocationColours.WealthyHome', 'LocationColours.PoorHome', 'LocationColours.Temple',
  'LocationColours.Cult', 'LocationColours.Tavern', 'LocationColours.City', 'LocationColours.Hamlet', 'LocationColours.Village',
]);
/** The mod's TimeAcceleration section, which the port no longer declares. */
export const RATE_LAW_RETIRED = Object.freeze(['TimeAcceleration.DefaultStartingAcceleration', 'TimeAcceleration.AlwaysUseStartingAcceleration', 'TimeAcceleration.AccelerationLimit']);
