# Spore Wars

Real-time strategy game built with Phaser 3 + Vite. 5 civilizations compete to control cities, geysers, and territory on a procedurally generated island map.

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
- **Minimap** click jumps the camera
- **Speed buttons** (top-right): Play, Pause, 2x Fast-Forward
- **Diplomacy** (bottom-right): View civ stats, send gifts/insults
- **Backtick** toggles debug overlay
- **Win** by capturing all cities. **Lose** if you lose your last city.

## Architecture

```
src/
├── main.js                    Entry point, Phaser config (1280x720)
├── constants.js               All tunable parameters (no magic numbers)
├── state.js                   Central game state singleton
├── scenes/
│   ├── GameScene.js           World sim, terrain, entities, input
│   ├── UIScene.js             HUD: minimap, speed, economy, diplomacy
│   └── MenuScene.js           Win/lose/restart screen
├── entities/
│   ├── Unit.js                Mobile combat unit (move, attack, claim)
│   ├── City.js                Settlement (capture, regen, spawning)
│   └── Geyser.js              Resource node (claim, income)
├── terrain/
│   └── TerrainGrid.js         Simplex noise terrain generation
├── ai/
│   ├── AI.js                  Per-tick decision tree for 4 AI civs
│   └── Relationships.js       Hostility matrix, diplomacy bonuses
└── utils/
    ├── pathfinding.js         A* with line-of-sight smoothing
    └── debug.js               Toggle overlay (backtick)
```

**~3,600 lines across 14 source files.**

## Systems

### Terrain Generation (`TerrainGrid.js`)
- 2-octave Simplex noise → 51x38 tile grid (64px tiles)
- Tile types: Water (< 0.35), Plains (0.35–0.65), Hills (> 0.65)
- Edge falloff creates island shape
- Flood-fill enforces single connected landmass
- Deterministic via `MAP_SEED` (default: 42)

### Pathfinding (`pathfinding.js`)
- A* on tile grid, 8-directional (no corner-cutting through water)
- Line-of-sight smoothing removes staircase waypoints
- Snap-to-walkable if start/end in water
- Used by units for movement and AI for distance calculations

### Combat & Entities
- **Units**: 100 HP, 10 DPS, 120 px/s speed, 5 per civ cap, cost 1000
- **Cities**: 1000 HP, regen 5/s after 100s cooldown. Capture transfers ownership. Losing last city eliminates the civ (units die, geysers unclaimed).
- **Geysers**: Unclaimed → 5s timer to claim. Claimed → 300 HP to steal. Generate 1000 sporebucks/min.

### AI (`AI.js`)
Runs once per second. 4 personalities:
- **Rusher** (Civ 1): Attacks at hostility 35, needs 2 units
- **Balanced** (Civs 2-3): Attacks at 50, needs 3 units
- **Economist** (Civ 4): Attacks at 65, needs 3 units

Decision priority: Defend → Claim geysers → Guard geysers → Attack → Return home

### Relationships (`Relationships.js`)
Hostility score (0–100) per civ pair:
```
hostility = aggression + proximity + power - diplomacyBonus
```
- **Aggression** (0–60): +15 per attack, decays 3/tick
- **Proximity** (0–15): Based on nearest city distance
- **Power** (-10 to +15): Strength ratio (units + cities×2 + geysers)
- **Diplomacy** (0–60): From gifts (+20), decays 1/tick

Labels: Friendly (<25), Neutral (<50), Wary (<70), Hostile (≥70)

### Diplomacy (UIScene)
- **Gift**: 1000 sporebucks, reduces hostility by 20 (decays over ~20s)
- **Insult**: Free, increases hostility by 15
- 10-second cooldown per civ between actions

### UI Layout (1280x720)
- **Top-left**: Placeholder tabs (Dropdowns, News, Priorities, Ongoing Effects)
- **Top-right**: Speed controls (Play / Pause / 2x)
- **Bottom-left**: Minimap (200x150) with terrain, territory, entities, viewport
- **Below minimap**: Sporebucks counter
- **Bottom-right**: Diplomacy panel (stats, relationships, Talk → Gift/Insult)

## Key Constants (constants.js)

| Category | Parameter | Value |
|----------|-----------|-------|
| Map | MAP_WIDTH × MAP_HEIGHT | 3200 × 2400 |
| Map | MAP_SEED | 42 |
| Map | TILE_SIZE | 64 |
| Economy | STARTING_SPOREBUCKS | 2000 |
| Economy | UNIT_COST | 1000 |
| Economy | GEYSER_INCOME | 1000/min |
| Unit | UNIT_HP / DPS / SPEED | 100 / 10 / 120 |
| Unit | UNIT_CAP | 5 per civ |
| City | CITY_HP / REGEN | 1000 / 5/s |
| City | CITY_REGEN_COOLDOWN | 100s |
| Geyser | GEYSER_HP / CLAIM_TIME | 300 / 5s |
| Terrain | WATER_THRESHOLD | 0.35 |
| Terrain | HILLS_THRESHOLD | 0.65 |
| AI | AI_TICK_INTERVAL | 1000ms |
| Diplomacy | GIFT_COST / BONUS | 1000 / 20 |
| Diplomacy | INSULT_PENALTY | 15 |
| Diplomacy | COOLDOWN / DECAY | 10s / 1/tick |

## Civ Colors

| Civ | Color | Role |
|-----|-------|------|
| 0 | Blue (0x4488ff) | Player |
| 1 | Red (0xff4444) | AI Rusher |
| 2 | Green (0x44cc44) | AI Balanced |
| 3 | Orange (0xffaa00) | AI Balanced |
| 4 | Purple (0xcc44cc) | AI Economist |

## Version History

- **V0.1** (2026-03-31): Core gameplay — flat map, fixed positions, 9 systems
- **V0.2** (2026-04-03): Terrain system — procedural map generation, A* pathfinding, entity placement, minimap terrain, diplomacy panel with gifts/insults, civ elimination (geysers unclaimed on death)
