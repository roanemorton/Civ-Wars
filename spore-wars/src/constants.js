// All tunable game values — no magic numbers elsewhere

// Map dimensions
export const MAP_WIDTH = 3200;
export const MAP_HEIGHT = 2400;
export const MAP_BG_COLOR = 0xd4e6b5;

// City
export const CITY_SPRITE_RADIUS = 40;
export const CITY_HP = 1000;
export const CITY_REGEN_RATE = 5;
export const CITY_REGEN_COOLDOWN = 100;

// Units
export const UNIT_COST = 1000;
export const UNIT_HP = 100;
export const UNIT_DAMAGE_PER_SECOND = 10;
export const UNIT_SPEED = 120;
export const UNIT_CAP = 5;
export const ATTACK_RANGE = 1.5 * CITY_SPRITE_RADIUS;

// Geysers
export const GEYSER_HP = 300;
export const GEYSER_INCOME = 1000;

// Economy
export const STARTING_SPOREBUCKS = 2000;

// Controls
export const PAN_THRESHOLD = 4;
export const FAST_FORWARD_SPEED = 2;

// Civ colors (player blue, then red, green, orange, purple)
export const CIV_COLORS = [0x4488ff, 0xff4444, 0x44cc44, 0xffaa00, 0xcc44cc];

// City positions — player at center, rivals in quadrant corners
export const CITY_POSITIONS = [
  [1600, 1200],
  [600, 500],
  [2600, 500],
  [600, 1900],
  [2600, 1900],
];

// Conquest bar dimensions
export const CONQUEST_BAR_WIDTH = 60;
export const CONQUEST_BAR_HEIGHT = 6;
export const CONQUEST_BAR_OFFSET_Y = -55;
