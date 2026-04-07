// All tunable game values — no magic numbers elsewhere

// Map dimensions
export const MAP_WIDTH = 6400;
export const MAP_HEIGHT = 4800;

// Terrain grid
export const MAP_SEED = 314;
export const TILE_SIZE = 32;
export const GRID_COLS = Math.ceil(MAP_WIDTH / TILE_SIZE);
export const GRID_ROWS = Math.ceil(MAP_HEIGHT / TILE_SIZE);
export const WATER_THRESHOLD = 0.32;
export const HILLS_THRESHOLD = 0.65;

// City
export const CITY_SPRITE_RADIUS = 40;
export const CITY_HP = 1000;
export const CITY_REGEN_RATE = 5;
export const CITY_REGEN_COOLDOWN = 100;

// Units
export const UNIT_COST = 1000;
export const UNIT_HP = 100;
export const UNIT_DAMAGE_PER_SECOND = 10;
export const UNIT_SPEED = 90;
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

// Continent layout — each continent is an array of overlapping ellipses
// Coordinates are in tile space (200x150 grid at TILE_SIZE=32)
// Larger shapes, more land coverage (~55%), water forms channels between
export const CONTINENTS = [
  // A: Left continent (medium)
  [
    { cx: 35, cy: 28, rx: 35, ry: 30 },
    { cx: 28, cy: 72, rx: 30, ry: 34 },
    { cx: 32, cy: 50, rx: 22, ry: 24 },
    { cx: 55, cy: 42, rx: 18, ry: 16 },
  ],
  // B: Right continent (medium)
  [
    { cx: 162, cy: 22, rx: 36, ry: 30 },
    { cx: 158, cy: 65, rx: 32, ry: 30 },
    { cx: 160, cy: 44, rx: 22, ry: 22 },
    { cx: 142, cy: 48, rx: 18, ry: 16 },
  ],
  // C: Center-bottom continent (small)
  [
    { cx: 100, cy: 92, rx: 36, ry: 24 },
    { cx: 90, cy: 112, rx: 26, ry: 20 },
  ],
];
export const CONTINENT_GEYSERS = [5, 5, 3];  // land geysers per continent
export const OCEAN_GEYSERS = 4;              // geysers placed in open water
export const CIV_CONTINENTS = [0, 0, 1, 1, 2]; // civ-to-continent assignment

// Entity placement
export const CITY_MIN_DISTANCE = 800;
export const CITY_WATER_BUFFER = 2;    // min tiles from coast
export const GEYSER_MIN_CITY_DIST = 400;
export const GEYSER_MIN_GEYSER_DIST = 300;

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

// Civ types
export const CIV_TYPES = ['military', 'economic', 'religious'];

// Diplomacy
export const GIFT_COST = 1000;
export const GIFT_DIPLOMACY_BONUS = 20;
export const INSULT_DIPLOMACY_PENALTY = 15;
export const DECLARE_WAR_AGGRESSION = 50;
export const DIPLOMACY_COOLDOWN = 10;
export const DIPLOMACY_DECAY = 1;

// Military assistance
export const MILITARY_ASSIST_UNITS = 2;
export const MILITARY_ASSIST_TRAVEL_COST_PER_TILE = 10;
export const MILITARY_ASSIST_HOSTILITY_SPIKE = 40;
export const MILITARY_ASSIST_DURATION = 120;
export const MILITARY_ASSIST_MULTIPLIERS = {
  allied: 0.5, friendly: 0.75, neutral: 1.25, wary: 2.0,
};

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

// Number of cities matches number of civs (derived from CIV_COLORS.length)
export const NUM_CITIES = CIV_COLORS.length;

// Conquest bar dimensions
export const CONQUEST_BAR_WIDTH = 60;
export const CONQUEST_BAR_HEIGHT = 6;
export const CONQUEST_BAR_OFFSET_Y = -55;
