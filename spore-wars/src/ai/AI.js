// All AI decision-making logic — isolated from other systems
import { state } from '../state.js';
import { Unit } from '../entities/Unit.js';
import {
  UNIT_COST,
  UNIT_CAP,
  ATTACK_RANGE,
  AI_TICK_INTERVAL,
} from '../constants.js';
import { initRelationships, updateRelationships, getHostility } from './Relationships.js';

let aiTimer = 0;

// Resets the AI timer for a fresh game
export function resetAI() {
  aiTimer = 0;
}

// Assigns personality types to AI civs and sets up relationships
export function initAI() {
  state.civs[1].personality = 'rusher';
  state.civs[2].personality = 'balanced';
  state.civs[3].personality = 'balanced';
  state.civs[4].personality = 'economist';
  initRelationships();
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
    new Unit(scene, city.x, city.y, civ);
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
  return civ.units.filter((u) => u.isAlive && u.unitState === 'idle');
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

// Returns the nearest object from a list to the given unit
function findNearest(unit, list) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const item of list) {
    const d = distBetween(unit, item);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = item;
    }
  }
  return nearest;
}

// Returns the nearest city or geyser owned by a specific target civ
function findNearestCivAsset(unit, targetCiv) {
  let nearest = null;
  let nearestDist = Infinity;

  for (const city of state.cities) {
    if (city.owner !== targetCiv) continue;
    const d = distBetween(unit, city);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = city;
    }
  }

  for (const geyser of state.geysers) {
    if (geyser.owner !== targetCiv) continue;
    const d = distBetween(unit, geyser);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = geyser;
    }
  }

  return nearest;
}

// Returns the distance between two objects with x/y properties
function distBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
