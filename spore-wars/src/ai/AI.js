// All AI decision-making logic — isolated from other systems
import { state } from '../state.js';
import { Unit } from '../entities/Unit.js';
import {
  UNIT_COST,
  UNIT_CAP,
  ATTACK_RANGE,
  AI_TICK_INTERVAL,
  CITY_SPRITE_RADIUS,
  UNIT_SPRITE_RADIUS,
  MILITARY_ASSIST_UNITS,
  MILITARY_ASSIST_HOSTILITY_SPIKE,
  MILITARY_ASSIST_DURATION,
} from '../constants.js';
import { initRelationships, updateRelationships, getHostility, spikeAggression } from './Relationships.js';
import { pathDistance } from '../utils/pathfinding.js';
import { state as gameState } from '../state.js';

let aiTimer = 0;
let targetWeights = {};  // { civId: { targetCivId: expiryGameTime } }

// Resets the AI timer for a fresh game
export function resetAI() {
  aiTimer = 0;
  targetWeights = {};
}

// Assigns personality types and civ types, sets up relationships
export function initAI() {
  state.civs[0].civType = 'military';
  state.civs[1].civType = 'military';
  state.civs[2].civType = 'economic';
  state.civs[3].civType = 'religious';
  state.civs[4].civType = 'economic';

  state.civs[1].personality = 'rusher';
  state.civs[2].personality = 'balanced';
  state.civs[3].personality = 'balanced';
  state.civs[4].personality = 'economist';
  initRelationships();
}

// Applies a hired target bias to an AI civ
export function applyHiredTarget(hiredCivId, targetCivId, durationSecs) {
  if (!targetWeights[hiredCivId]) targetWeights[hiredCivId] = {};
  targetWeights[hiredCivId][targetCivId] = state.gameTime + durationSecs;
}

// Executes a military assistance hire — spawns mercenary units and applies targeting
export function executeHireAssist(hiredCiv, targetCiv, cost, scene) {
  state.player.sporebucks -= cost;
  hiredCiv.sporebucks += cost;

  spikeAggression(hiredCiv.id, targetCiv.id, MILITARY_ASSIST_HOSTILITY_SPIKE);
  applyHiredTarget(hiredCiv.id, targetCiv.id, MILITARY_ASSIST_DURATION);

  // Spawn mercenary units that attack the target directly
  const spawnCity = hiredCiv.cities[0];
  if (!spawnCity) return;

  // Find nearest target city to attack
  let nearestCity = null;
  let nearestDist = Infinity;
  for (const city of targetCiv.cities) {
    const dx = spawnCity.x - city.x;
    const dy = spawnCity.y - city.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < nearestDist) { nearestDist = d; nearestCity = city; }
  }

  for (let i = 0; i < MILITARY_ASSIST_UNITS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const sDist = CITY_SPRITE_RADIUS + UNIT_SPRITE_RADIUS + 5;
    const unit = new Unit(scene, spawnCity.x + Math.cos(angle) * sDist, spawnCity.y + Math.sin(angle) * sDist, hiredCiv);
    unit.isMercenary = true;
    // Refund the cost — mercenaries are paid for by the hiring civ
    hiredCiv.sporebucks += UNIT_COST;
    if (nearestCity) {
      unit.attackEntity(nearestCity);
    }
  }
}

// Runs the AI decision loop on a 1-second tick
export function updateAI(delta, scene) {
  aiTimer += delta;

  while (aiTimer >= AI_TICK_INTERVAL) {
    aiTimer -= AI_TICK_INTERVAL;
    updateRelationships();

    for (const civ of state.civs) {
      if (civ === state.player) continue;
      if (civ.cities.length === 0 && civ.units.length === 0) continue;
      runCivAI(civ, scene);
    }
  }
}

// Runs the full AI decision tree for one civ
function runCivAI(civ, scene) {
  trySpawnUnit(civ, scene);

  // Step 1: Defend if any city is under attack
  if (handleDefense(civ)) return;

  // Step 2: Claim unclaimed geysers
  if (handleClaimGeysers(civ)) return;

  // Step 3: Guard owned geysers
  if (handleGuardGeysers(civ)) return;

  // Step 4: Attack enemy assets (only when significantly stronger)
  if (handleAttack(civ)) return;

  // Step 5: Idle units return to home city
  handleReturnHome(civ);
}

// Spawns a unit if the civ can afford it and has room
function trySpawnUnit(civ, scene) {
  if (civ.cities.length === 0) return;
  if (civ.sporebucks >= UNIT_COST && civ.units.length < UNIT_CAP) {
    const city = civ.cities[0];
    const angle = Math.random() * Math.PI * 2;
    const dist = CITY_SPRITE_RADIUS + UNIT_SPRITE_RADIUS + 5;
    new Unit(scene, city.x + Math.cos(angle) * dist, city.y + Math.sin(angle) * dist, civ);
  }
}

// Checks if any city is under attack and recalls units to defend
function handleDefense(civ) {
  const attackedCity = civ.cities.find((city) => isCityUnderAttack(city));
  if (!attackedCity) return false;

  for (const unit of civ.units) {
    if (!unit.isAlive) continue;
    // Only recall units not already heading to defend this city
    const alreadyDefending = unit.unitState === 'moving' &&
      unit.targetX === attackedCity.x && unit.targetY === attackedCity.y &&
      !unit.attackTarget && !unit.claimTarget;
    const nearCity = distBetween(unit, attackedCity) <= ATTACK_RANGE;

    if (!alreadyDefending && !nearCity) {
      // Find the nearest enemy unit attacking the city and attack it
      const attacker = findNearestEnemyAttacker(attackedCity, civ);
      if (attacker) {
        unit.attackEntity(attacker);
      } else {
        unit.moveTo(attackedCity.x, attackedCity.y);
      }
    }
  }
  return true;
}

// Sends idle units to claim the nearest unclaimed geyser
function handleClaimGeysers(civ) {
  const unclaimed = state.geysers.filter((g) => g.owner === null);
  if (unclaimed.length === 0) return false;

  const idleUnits = getIdleUnits(civ);
  if (idleUnits.length === 0) return false;

  const unit = idleUnits[0];
  const geyser = findNearest(unit, unclaimed);
  if (geyser) {
    unit.claimGeyser(geyser);
  }
  return true;
}

// Sends idle units to guard the nearest unguarded owned geyser
function handleGuardGeysers(civ) {
  if (civ.geysers.length === 0) return false;

  const idleUnits = getIdleUnits(civ);
  if (idleUnits.length === 0) return false;

  // Find geysers without a nearby friendly unit guarding them
  const unguarded = civ.geysers.filter((geyser) => {
    return !civ.units.some((u) => u.isAlive && distBetween(u, geyser) <= ATTACK_RANGE * 2);
  });
  if (unguarded.length === 0) return false;

  const unit = idleUnits[0];
  const geyser = findNearest(unit, unguarded);
  if (geyser) {
    unit.moveTo(geyser.x, geyser.y);
    return true;
  }
  return false;
}

// Returns the number of alive units for a civ
function getAliveUnitCount(civ) {
  return civ.units.filter((u) => u.isAlive).length;
}

// Sends idle units to attack the most hostile civ's nearest asset
// Guided by relationship scores and personality thresholds
function handleAttack(civ) {
  const idleUnits = getIdleUnits(civ);
  if (idleUnits.length === 0) return false;

  // Personality gate — minimum unit thresholds
  if (civ.personality === 'economist' && civ.units.length < 3) return false;
  if (civ.personality === 'balanced' && civ.units.length < 3) return false;
  if (civ.personality === 'rusher' && civ.units.length < 2) return false;

  // Hostility threshold by personality
  const threshold = civ.personality === 'rusher' ? 35
    : civ.personality === 'economist' ? 65 : 50;

  // Find the most hostile living civ that passes all gates
  let targetCiv = null;
  let highestHostility = 0;
  const ourUnits = getAliveUnitCount(civ);

  for (const other of state.civs) {
    if (other === civ) continue;
    if (other.cities.length === 0 && other.units.filter((u) => u.isAlive).length === 0) continue;

    const h = getHostility(civ, other);
    if (h < threshold) continue;

    // Light strength gate — need 1.25x their units
    const theirUnits = getAliveUnitCount(other);
    if (ourUnits < theirUnits * 1.25) continue;

    if (h > highestHostility) {
      highestHostility = h;
      targetCiv = other;
    }
  }

  // Check for hired target bias — 70% chance to override target selection
  const weights = targetWeights[civ.id];
  if (weights) {
    // Clean expired weights
    for (const [tid, expiry] of Object.entries(weights)) {
      if (state.gameTime > expiry) delete weights[tid];
    }
    const weightedIds = Object.keys(weights).map(Number);
    if (weightedIds.length > 0 && Math.random() < 0.7) {
      const weightedCiv = state.civs[weightedIds[0]];
      if (weightedCiv && (weightedCiv.cities.length > 0 || weightedCiv.units.some(u => u.isAlive))) {
        targetCiv = weightedCiv;
      }
    }
  }

  if (!targetCiv) return false;

  const unit = idleUnits[0];
  const target = findNearestCivAsset(unit, targetCiv);
  if (!target) return false;

  // Use claimGeyser for geysers, attackEntity for cities
  if (target.currentHP !== undefined && target.claimState !== undefined) {
    unit.claimGeyser(target);
  } else {
    unit.attackEntity(target);
  }
  return true;
}

// Sends idle units back toward their home city when nothing else to do
function handleReturnHome(civ) {
  if (civ.cities.length === 0) return;

  const idleUnits = getIdleUnits(civ);
  const homeCity = civ.cities[0];

  for (const unit of idleUnits) {
    if (distBetween(unit, homeCity) > ATTACK_RANGE * 3) {
      unit.moveTo(homeCity.x, homeCity.y);
    }
  }
}

// Returns all alive idle units for a civ
function getIdleUnits(civ) {
  return civ.units.filter((u) => u.isAlive && u.unitState === 'idle' && !u.isMercenary);
}

// Returns true if any enemy unit is attacking this city
function isCityUnderAttack(city) {
  for (const civ of state.civs) {
    if (civ === city.owner) continue;
    for (const unit of civ.units) {
      if (!unit.isAlive) continue;
      if (unit.attackTarget === city && unit.unitState === 'attacking') {
        return true;
      }
      // Also count units moving to attack this city and within range
      if (unit.attackTarget === city && distBetween(unit, city) <= ATTACK_RANGE * 2) {
        return true;
      }
    }
  }
  return false;
}

// Returns the nearest enemy unit that is attacking the given city
function findNearestEnemyAttacker(city, defenderCiv) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const civ of state.civs) {
    if (civ === defenderCiv) continue;
    for (const unit of civ.units) {
      if (!unit.isAlive) continue;
      if (unit.attackTarget === city) {
        const d = distBetween(unit, city);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = unit;
        }
      }
    }
  }
  return nearest;
}

// Returns the nearest object from a list to the given unit (using path distance when terrain exists)
function findNearest(unit, list) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const item of list) {
    const d = gameState.terrain
      ? pathDistance(gameState.terrain, unit.x, unit.y, item.x, item.y)
      : distBetween(unit, item);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = item;
    }
  }
  return nearest;
}

// Returns the nearest city or geyser owned by a specific target civ (using path distance)
function findNearestCivAsset(unit, targetCiv) {
  const assets = [];
  for (const city of state.cities) {
    if (city.owner === targetCiv) assets.push(city);
  }
  for (const geyser of state.geysers) {
    if (geyser.owner === targetCiv) assets.push(geyser);
  }
  return findNearest(unit, assets);
}

// Returns the distance between two objects with x/y properties
function distBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
