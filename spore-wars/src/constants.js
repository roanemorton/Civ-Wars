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
export const GEYSER_CLAIM_TIME = 5;
export const GEYSER_HP = 300;
export const GEYSER_INCOME = 1000;
export const GEYSER_SPRITE_RADIUS = 20;
export const GEYSER_COLOR = 0xeedd44;
export const GEYSER_BAR_WIDTH = 40;
export const GEYSER_BAR_HEIGHT = 4;
export const GEYSER_BAR_OFFSET_Y = -30;

// Geyser positions — 17 fixed positions scattered between cities
export const GEYSER_POSITIONS = [
  [1400, 1050], [1800, 1350],
  [1000, 750], [1200, 600],
  [2000, 750], [2200, 600],
  [1000, 1650], [1200, 1800],
  [2000, 1650], [2200, 1800],
  [450, 650], [750, 400],
  [2450, 650], [2750, 400],
  [450, 1750], [750, 2000],
  [2450, 1750],
];

// Territory
export const TERRITORY_CITY_RADIUS = 200;
export const TERRITORY_GEYSER_RADIUS = 120;
export const TERRITORY_ALPHA = 0.15;
export const DEPTH_TERRITORY = 0;

// Depth layers
export const DEPTH_GEYSER = 1;
export const DEPTH_CITY = 2;
export const DEPTH_UNIT = 3;
export const DEPTH_UI = 10;

// Unit rendering
export const UNIT_SPRITE_RADIUS = 12;
export const UNIT_BAR_WIDTH = 24;
export const UNIT_BAR_HEIGHT = 3;
export const UNIT_BAR_OFFSET_Y = -18;

// Economy
export const STARTING_SPOREBUCKS = 2000;

// AI
export const AI_TICK_INTERVAL = 1000;

// Relationships
export const HOSTILITY_AGGRESSION_SPIKE = 15;
export const HOSTILITY_AGGRESSION_DECAY = 3;
export const HOSTILITY_AGGRESSION_CAP = 60;

// Minimap
export const MINIMAP_WIDTH = 200;
export const MINIMAP_HEIGHT = 150;
export const MINIMAP_X = 10;
export const MINIMAP_Y = 560;
export const MINIMAP_BG_COLOR = 0x1a1a2e;

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
