// All AI decision-making logic — isolated from other systems
import { state } from '../state.js';
import { Unit } from '../entities/Unit.js';
import {
  UNIT_COST,
  UNIT_CAP,
  ATTACK_RANGE,
  AI_TICK_INTERVAL,
} from '../constants.js';

let aiTimer = 0;

// Resets the AI timer for a fresh game
export function resetAI() {
  aiTimer = 0;
}

// Assigns personality types to AI civs
export function initAI() {
  state.civs[1].personality = 'rusher';
  state.civs[2].personality = 'balanced';
  state.civs[3].personality = 'balanced';
  state.civs[4].personality = 'economist';
}

// Runs the AI decision loop on a 1-second tick
export function updateAI(delta, scene) {
  aiTimer += delta;

  while (aiTimer >= AI_TICK_INTERVAL) {
    aiTimer -= AI_TICK_INTERVAL;

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

  // Step 3: Defend if any city is under attack
  if (handleDefense(civ)) return;

  // Step 1: Claim unclaimed geysers
  if (handleClaimGeysers(civ)) return;

  // Step 2: Attack enemy assets (personality-gated)
  handleAttack(civ);
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

// Sends idle units to attack the nearest enemy asset based on personality
function handleAttack(civ) {
  const idleUnits = getIdleUnits(civ);
  if (idleUnits.length === 0) return;

  // Personality gate for step 2
  if (civ.personality === 'economist') return;
  if (civ.personality === 'balanced' && civ.units.length < 2) return;
  // Rusher: needs >= 1 unit (always true if we got here)

  const unit = idleUnits[0];
  const target = findNearestEnemyAsset(unit, civ);
  if (!target) return;

  // Use claimGeyser for geysers, attackEntity for cities
  if (target.currentHP !== undefined && target.claimState !== undefined) {
    unit.claimGeyser(target);
  } else {
    unit.attackEntity(target);
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

// Returns the nearest enemy city or geyser not owned by this civ
function findNearestEnemyAsset(unit, civ) {
  let nearest = null;
  let nearestDist = Infinity;

  // Check enemy cities
  for (const city of state.cities) {
    if (city.owner === civ) continue;
    const d = distBetween(unit, city);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = city;
    }
  }

  // Check enemy geysers (owned by someone else)
  for (const geyser of state.geysers) {
    if (geyser.owner === civ || geyser.owner === null) continue;
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
