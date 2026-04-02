// Tracks hostility between every pair of civs — drives AI attack decisions
import { state } from '../state.js';
import {
  HOSTILITY_AGGRESSION_SPIKE,
  HOSTILITY_AGGRESSION_DECAY,
  HOSTILITY_AGGRESSION_CAP,
} from '../constants.js';

const NUM_CIVS = 5;

// hostility[a][b] = how much civ a wants to attack civ b (0–100)
let hostility = [];

// aggressionLog[a][b] = raw aggression points from civ b attacking civ a
let aggressionLog = [];

// Tracks whether aggression was already recorded this AI tick per pair
let aggressionRecordedThisTick = [];

// Creates empty 5x5 matrices
function createMatrix(fill) {
  return Array.from({ length: NUM_CIVS }, () => Array(NUM_CIVS).fill(fill));
}

// Sets up the relationship matrices for a new game
export function initRelationships() {
  hostility = createMatrix(0);
  aggressionLog = createMatrix(0);
  aggressionRecordedThisTick = createMatrix(false);
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

// Returns a human-readable label for a hostility score
export function getRelationshipLabel(score) {
  if (score < 25) return 'Friendly';
  if (score < 50) return 'Neutral';
  if (score < 70) return 'Wary';
  return 'Hostile';
}

// Returns the label color hex string for a hostility score
export function getRelationshipColor(score) {
  if (score < 25) return '#44cc44';
  if (score < 50) return '#aaaaaa';
  if (score < 70) return '#ffdd44';
  return '#ff4444';
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

      hostility[a][b] = Math.max(0, Math.min(100, aggression + proximity + power));
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
