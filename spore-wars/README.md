# Spore Wars

Real-time strategy game built with Phaser 3 + Vite. 5 civilizations across 3 continents compete to control cities, geysers, and territory on a procedurally generated map.

## Quick Start

```bash
npm install
npm run dev    # http://localhost:5173
```

## How to Play

- **Click** a city to spawn a unit (costs 1000 sporebucks)
- **Click** a unit to select it, then click to:
  - Empty ground → move
  - Enemy unit → attack
  - Enemy city → attack (capture at 0 HP)
  - Geyser → claim (generates income)
- **Drag** to pan the camera
- **Scroll wheel** to zoom in/out (0.4x–2.0x)
- **Minimap** click jumps the camera
- **Speed buttons** (top-right): Play, Pause, 2x Fast-Forward
- **Diplomacy** (bottom-right): View civ stats, talk to civs, gift/insult/declare war/request military aid
- **Backtick** toggles debug overlay
- **Win** by capturing all cities. **Lose** if you lose your last city.

## Architecture

```
src/
├── main.js                    Entry point, Phaser config (1280x720)
├── constants.js               All tunable parameters (no magic numbers)
├── state.js                   Central game state singleton
├── scenes/
│   ├── GameScene.js           World sim, terrain, entities, input, camera
│   ├── UIScene.js             HUD: minimap, speed, economy, diplomacy
│   └── MenuScene.js           Win/lose/restart screen
├── entities/
│   ├── Unit.js                Mobile combat unit (move, attack, claim)
│   ├── City.js                Settlement (capture, regen, spawning)
│   └── Geyser.js              Resource node (claim, income, priority system)
├── terrain/
│   └── TerrainGrid.js         Multi-continent terrain generation
├── ai/
│   ├── AI.js                  Per-tick decision tree, civ types, mercenary hiring
│   └── Relationships.js       Hostility matrix, diplomacy, war declarations
├── data/
│   └── dialogue.js            Opening messages and action responses per civ type
└── utils/
    ├── pathfinding.js         A* with line-of-sight smoothing
    └── debug.js               Toggle overlay (backtick)
```

**~4,000 lines across 15 source files.**

## Systems

### Terrain Generation (`TerrainGrid.js`)
- 3-continent map: 2 medium (left, right) + 1 small (center-bottom)
- Each continent defined by overlapping ellipses for organic shapes
- 4-octave Simplex noise creates irregular coastlines with bays and peninsulas
- 200x150 tile grid (32px tiles) on a 6400x4800 world
- Per-continent flood fill ensures each landmass is connected
- Continents fully isolated by water (no crossing until boats are added)
- Deterministic via `MAP_SEED` (default: 314)

### Pathfinding (`pathfinding.js`)
- A* on tile grid, 8-directional (no corner-cutting through water)
- Line-of-sight smoothing removes staircase waypoints
- Snap-to-walkable if start/end in water
- Returns null for cross-continent paths (continents are isolated)
- Used by units for movement and AI for distance calculations

### Combat & Entities
- **Units**: 100 HP, 10 DPS, 90 px/s speed, 5 per civ cap, cost 1000
- **Cities**: 1000 HP, regen 5/s after 100s cooldown. Capture transfers ownership. Losing last city eliminates the civ (units die, geysers unclaimed).
- **Geysers**: Unclaimed → 5s timer to claim (first unit has priority). Claimed → 300 HP to steal. Generate 1000 sporebucks/min. Geyser claim priority prevents multiple units from claiming the same unclaimed geyser. 4 ocean geysers visible in water but unclaimed until boats are added.
- **Mercenaries**: Spawned via military assistance, bypass unit cap, fight to death on assigned target.
- **Collision**: Units path around cities and geysers (treated as obstacles). Units spawn at random positions just outside city radius. Units push apart to prevent overlapping.

### AI (`AI.js`)
Runs once per second. 3 civ types × 4 personalities:

| Civ | Color | Type | Personality | Attack Threshold |
|-----|-------|------|-------------|-----------------|
| 0 | Blue | Military | — | Player |
| 1 | Red | Military | Rusher | 35 hostility, 2+ units |
| 2 | Green | Economic | Balanced | 50 hostility, 3+ units |
| 3 | Orange | Religious | Balanced | 50 hostility, 3+ units |
| 4 | Purple | Economic | Economist | 65 hostility, 3+ units |

**Decision priority**: Defend → Claim geysers → Guard geysers → Attack → Return home

**Civ distribution**: Civs 0+1 on continent A, civs 2+3 on continent B, civ 4 alone on continent C.

**Target weights**: Military assistance creates a 70% bias toward the hired target for 120 seconds.

### Relationships (`Relationships.js`)
Hostility score (0–100) per civ pair:
```
hostility = aggression + proximity + power - diplomacyBonus
if atWar: hostility = max(70, hostility)
```
- **Aggression** (0–60): +15 per attack, decays 3/tick
- **Proximity** (0–15): Based on nearest city distance
- **Power** (-10 to +15): Strength ratio (units + cities×2 + geysers)
- **Diplomacy** (0–60): From gifts (+20), decays 1/tick
- **War**: `declareWar()` floors hostility at 70, spikes aggression by 50

**Relationship Tiers**:
| Tier | Hostility | Color |
|------|-----------|-------|
| Allied | < 10 | Bright green |
| Friendly | < 25 | Green |
| Neutral | < 50 | Gray |
| Wary | < 70 | Yellow |
| Hostile | ≥ 70 | Red |

### Diplomacy & Communication (`UIScene.js`, `dialogue.js`)
Full dialogue system with civ-type-flavored responses (military/economic/religious):

**Actions available by tier**:
- **Allied**: Request Military Assistance, Offer Gift
- **Friendly**: Request Military Assistance, Offer Gift, Insult
- **Neutral**: Request Military Assistance, Offer Gift, Insult, Declare War
- **Wary**: Request Military Assistance, Offer Gift, Insult, Declare War
- **Hostile**: Insult, Declare War

**Gift**: 1000 sporebucks, reduces hostility by 20 (decays ~20s)
**Insult**: Free, increases hostility by 15
**Declare War**: Floors hostility at 70 permanently, spikes aggression by 50
**Military Assistance**: Pay to hire another civ's mercenaries to attack a target. Cost = (2 × unit cost × tier multiplier) + travel fee. Spawns 2 mercenary units.

10-second cooldown per civ between actions. AI response text shown for 2 seconds.

### UI Layout (1280x720)
- **Top-left**: Placeholder tabs (Dropdowns, News, Priorities, Ongoing Effects)
- **Top-right**: Speed controls (Play / Pause / 2x)
- **Bottom-left**: Minimap (200x150) with terrain, territory, entities, viewport
- **Below minimap**: Sporebucks counter
- **Bottom-right**: Diplomacy panel → Talk opens dialogue with opening message, tiered action buttons, military assist target picker

## Key Constants (constants.js)

| Category | Parameter | Value |
|----------|-----------|-------|
| Map | MAP_WIDTH × MAP_HEIGHT | 6400 × 4800 |
| Map | MAP_SEED | 314 |
| Map | TILE_SIZE | 32 |
| Continents | Layout | Left + Right (medium), Center-bottom (small) |
| Continents | Land geysers | 5, 5, 3 per continent |
| Continents | Ocean geysers | 4 (unclaimed until boats) |
| Continents | Civ assignment | [0,0,1,1,2] |
| Economy | STARTING_SPOREBUCKS | 2000 |
| Economy | UNIT_COST | 1000 |
| Economy | GEYSER_INCOME | 1000/min |
| Unit | UNIT_HP / DPS / SPEED | 100 / 10 / 90 |
| Unit | UNIT_CAP | 5 per civ |
| City | CITY_HP / REGEN | 1000 / 5/s |
| City | CITY_REGEN_COOLDOWN | 100s |
| Geyser | GEYSER_HP / CLAIM_TIME | 300 / 5s |
| Terrain | WATER_THRESHOLD | 0.32 |
| Terrain | HILLS_THRESHOLD | 0.65 |
| AI | AI_TICK_INTERVAL | 1000ms |
| Diplomacy | GIFT_COST / BONUS | 1000 / 20 |
| Diplomacy | INSULT_PENALTY | 15 |
| Diplomacy | COOLDOWN / DECAY | 10s / 1/tick |
| Diplomacy | DECLARE_WAR_AGGRESSION | 50 |
| Military | ASSIST_UNITS / DURATION | 2 / 120s |
| Military | HOSTILITY_SPIKE | 40 |
| Placement | CITY_MIN_DISTANCE | 800 |
| Placement | GEYSER_MIN_CITY/GEYSER | 400 / 300 |

## Civ Colors & Types

| Civ | Color | Type | Personality | Continent |
|-----|-------|------|-------------|-----------|
| 0 | Blue (0x4488ff) | Military | Player | A (left) |
| 1 | Red (0xff4444) | Military | Rusher | A (left) |
| 2 | Green (0x44cc44) | Economic | Balanced | B (right) |
| 3 | Orange (0xffaa00) | Religious | Balanced | B (right) |
| 4 | Purple (0xcc44cc) | Economic | Economist | C (center) |

## Version History

- **V0.1** (2026-03-31): Core gameplay — flat map, fixed positions, 9 systems
- **V0.2** (2026-04-03): Terrain — procedural single-island generation, A* pathfinding, entity placement, minimap terrain, basic diplomacy panel (gift/insult), civ elimination (geysers unclaimed on death)
- **V0.3** (2026-04-03): Multi-continent & diplomacy overhaul:
  - 3-continent map (2 medium + 1 small) with ellipse-influence + 4-octave noise
  - 32px tiles (200x150 grid) for smooth coastlines
  - 6400x4800 world (doubled from 3200x2400)
  - Per-continent entity placement (2-2-1 civs, 5-5-3 geysers)
  - Camera zoom (scroll wheel, 0.4x–2.0x)
  - Civ types (military/economic/religious) with flavored dialogue
  - 5-tier relationships (allied/friendly/neutral/wary/hostile)
  - Full communication panel with opening messages and action responses
  - Declare War (persistent hostility floor at 70)
  - Military assistance (hire mercenary units to attack a target)
  - Geyser claim priority (first unit claiming has exclusive access)
  - Unit speed reduced to 90 px/s
- **V0.4** (2026-04-05): Physics & ocean geysers:
  - Units path around cities and geysers (obstacle avoidance in A*)
  - Units spawn at random positions outside city radius (not on top)
  - Unit-to-unit collision separation (no overlapping)
  - 4 ocean geysers placed in open water (visible but unclaimed until boats)
  - Fixed pathfinding to enemy cities/geysers (target excluded from obstacles)
