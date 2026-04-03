// Tracks hostility between every pair of civs — drives AI attack decisions
import { state } from '../state.js';
import {
  HOSTILITY_AGGRESSION_SPIKE,
  HOSTILITY_AGGRESSION_DECAY,
  HOSTILITY_AGGRESSION_CAP,
  DIPLOMACY_DECAY,
  TILE_SIZE,
  UNIT_COST,
  MILITARY_ASSIST_UNITS,
  MILITARY_ASSIST_TRAVEL_COST_PER_TILE,
  MILITARY_ASSIST_MULTIPLIERS,
  DECLARE_WAR_AGGRESSION,
} from '../constants.js';

const NUM_CIVS = 5;

// hostility[a][b] = how much civ a wants to attack civ b (0–100)
let hostility = [];

// aggressionLog[a][b] = raw aggression points from civ b attacking civ a
let aggressionLog = [];

// Tracks whether aggression was already recorded this AI tick per pair
let aggressionRecordedThisTick = [];

// diplomacyBonus[a][b] = bonus reducing hostility from civ a toward civ b
let diplomacyBonus = [];

// atWar[a][b] = true if civ a and civ b are at war (floors hostility at 70)
let atWar = [];

// Creates empty 5x5 matrices
function createMatrix(fill) {
  return Array.from({ length: NUM_CIVS }, () => Array(NUM_CIVS).fill(fill));
}

// Sets up the relationship matrices for a new game
export function initRelationships() {
  hostility = createMatrix(0);
  aggressionLog = createMatrix(0);
  aggressionRecordedThisTick = createMatrix(false);
  diplomacyBonus = createMatrix(0);
  atWar = createMatrix(false);
}

// Clears all relationship data
export function resetRelationships() {
  initRelationships();
}

// Records that attackerCiv has aggressed against victimCiv
// Capped at one spike per pair per AI tick
export function recordAggression(attackerCiv, victimCiv) {
  if (!attackerCiv || !victimCiv) return;
  if (attackerCiv === victimCiv) return;

  const a = victimCiv.id;
  const b = attackerCiv.id;

  if (aggressionRecordedThisTick[a][b]) return;
  aggressionRecordedThisTick[a][b] = true;

  aggressionLog[a][b] = Math.min(
    aggressionLog[a][b] + HOSTILITY_AGGRESSION_SPIKE,
    HOSTILITY_AGGRESSION_CAP
  );
}

// Returns the hostility score from civA toward civB
export function getHostility(civA, civB) {
  return hostility[civA.id][civB.id];
}

// Applies a diplomacy bonus/penalty between two civs
// Positive amount = gift (reduces hostility), negative = insult (increases hostility)
export function applyDiplomacy(fromCivId, toCivId, amount) {
  diplomacyBonus[toCivId][fromCivId] = Math.max(0, Math.min(60,
    diplomacyBonus[toCivId][fromCivId] + amount
  ));
}

// Returns the relationship tier between two civs
export function getRelationshipTier(civA, civB) {
  const h = getHostility(civA, civB);
  if (h < 10) return 'allied';
  if (h < 25) return 'friendly';
  if (h < 50) return 'neutral';
  if (h < 70) return 'wary';
  return 'hostile';
}

// Returns a human-readable label for a hostility score
export function getRelationshipLabel(score) {
  if (score < 10) return 'Allied';
  if (score < 25) return 'Friendly';
  if (score < 50) return 'Neutral';
  if (score < 70) return 'Wary';
  return 'Hostile';
}

// Returns the label color hex string for a hostility score
export function getRelationshipColor(score) {
  if (score < 10) return '#44ff88';
  if (score < 25) return '#44cc44';
  if (score < 50) return '#aaaaaa';
  if (score < 70) return '#ffdd44';
  return '#ff4444';
}

// Directly spikes aggression between two civs (used by military assist and war)
export function spikeAggression(fromId, toId, amount) {
  aggressionLog[toId][fromId] = Math.min(
    HOSTILITY_AGGRESSION_CAP,
    aggressionLog[toId][fromId] + amount
  );
}

// Declares war — floors hostility at 70 until one side is eliminated
export function declareWar(civA, civB) {
  atWar[civA.id][civB.id] = true;
  atWar[civB.id][civA.id] = true;
  spikeAggression(civA.id, civB.id, DECLARE_WAR_AGGRESSION);
  spikeAggression(civB.id, civA.id, DECLARE_WAR_AGGRESSION);
}

// Returns true if two civs are at war
export function areAtWar(civA, civB) {
  return atWar[civA.id][civB.id];
}

// Calculates the cost for military assistance
export function calculateAssistCost(hiringCiv, hiredCiv, targetCiv) {
  const tier = getRelationshipTier(hiredCiv, hiringCiv);
  if (tier === 'hostile') return null;
  if (hiredCiv.cities.length === 0 || targetCiv.cities.length === 0) return null;

  const multiplier = MILITARY_ASSIST_MULTIPLIERS[tier];
  const baseCost = MILITARY_ASSIST_UNITS * UNIT_COST;

  let minDist = Infinity;
  for (const cityA of hiredCiv.cities) {
    for (const cityB of targetCiv.cities) {
      const dx = cityA.x - cityB.x;
      const dy = cityA.y - cityB.y;
      minDist = Math.min(minDist, Math.sqrt(dx * dx + dy * dy));
    }
  }
  const tileDistance = minDist / TILE_SIZE;
  const travelFee = tileDistance * MILITARY_ASSIST_TRAVEL_COST_PER_TILE;

  return Math.floor(baseCost * multiplier + travelFee);
}

// Recalculates all hostility scores — called once per AI tick
export function updateRelationships() {
  // Reset per-tick aggression throttle
  aggressionRecordedThisTick = createMatrix(false);

  for (let a = 0; a < NUM_CIVS; a++) {
    for (let b = 0; b < NUM_CIVS; b++) {
      if (a === b) {
        hostility[a][b] = 0;
        continue;
      }

      // Decay aggression
      aggressionLog[a][b] = Math.max(0, aggressionLog[a][b] - HOSTILITY_AGGRESSION_DECAY);

      const aggression = aggressionLog[a][b];
      const proximity = calcProximity(a, b);
      const power = calcPowerComponent(a, b);

      let h = Math.max(0, Math.min(100, aggression + proximity + power - diplomacyBonus[a][b]));

      // War floors hostility at 70
      if (atWar[a][b]) {
        h = Math.max(70, h);
        // Clear war if target is eliminated
        const civB = state.civs[b];
        if (civB.cities.length === 0 && civB.units.filter(u => u.isAlive).length === 0) {
          atWar[a][b] = false;
          atWar[b][a] = false;
        }
      }

      hostility[a][b] = h;

      // Decay diplomacy bonus slowly
      diplomacyBonus[a][b] = Math.max(0, diplomacyBonus[a][b] - DIPLOMACY_DECAY);
    }
  }
}

// Returns proximity hostility (0–15) based on minimum city distance
function calcProximity(a, b) {
  const civA = state.civs[a];
  const civB = state.civs[b];

  if (civA.cities.length === 0 || civB.cities.length === 0) return 0;

  let minDist = Infinity;
  for (const cityA of civA.cities) {
    for (const cityB of civB.cities) {
      const dx = cityA.x - cityB.x;
      const dy = cityA.y - cityB.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) minDist = d;
    }
  }

  if (minDist < 800) return 15;
  if (minDist < 1200) return 10;
  if (minDist < 1800) return 5;
  return 0;
}

// Returns power-based hostility (-10 to +15) based on strength ratio
function calcPowerComponent(a, b) {
  const strengthA = calcStrength(state.civs[a]);
  const strengthB = calcStrength(state.civs[b]);

  if (strengthB === 0) return 15;
  const ratio = strengthA / strengthB;

  if (ratio < 0.5) return -10;
  if (ratio < 0.8) return -10;
  if (ratio < 1.2) return 5;
  if (ratio < 2.0) return 10;
  return 15;
}

// Returns a civ's overall strength score
function calcStrength(civ) {
  const aliveUnits = civ.units.filter((u) => u.isAlive).length;
  return aliveUnits + civ.cities.length * 2 + civ.geysers.length;
}
