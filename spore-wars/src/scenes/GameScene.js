// Main game scene — handles world simulation and rendering
import Phaser from 'phaser';
import { state } from '../state.js';
import { City } from '../entities/City.js';
import { Geyser } from '../entities/Geyser.js';
import { Unit } from '../entities/Unit.js';
import { initAI, updateAI } from '../ai/AI.js';
import { TerrainGrid, WATER, PLAINS, HILLS } from '../terrain/TerrainGrid.js';
import {
  MAP_SEED,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  CIV_COLORS,
  CONTINENT_GEYSERS,
  OCEAN_GEYSERS,
  CIV_CONTINENTS,
  CITY_MIN_DISTANCE,
  CITY_WATER_BUFFER,
  GEYSER_MIN_CITY_DIST,
  GEYSER_MIN_GEYSER_DIST,
  STARTING_SPOREBUCKS,
  PAN_THRESHOLD,
  UNIT_COST,
  UNIT_CAP,
  UNIT_SPRITE_RADIUS,
  CITY_SPRITE_RADIUS,
  GEYSER_SPRITE_RADIUS,
  GEYSER_INCOME,
  TERRITORY_CITY_RADIUS,
  TERRITORY_GEYSER_RADIUS,
  TERRITORY_ALPHA,
  DEPTH_TERRITORY,
  DEPTH_UI,
} from '../constants.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.spawnPopup = null;
    this.spawnPopupCity = null;
    this.territoryLayers = [];
  }

  // Sets up the map, civs, cities, camera, and input
  create() {
    this.generateAndDrawTerrain();
    this.initCivs();
    this.createTerritoryLayers();
    this.spawnCities();
    this.spawnGeysers();
    this.setupCamera();
    this.setupPanning();
    this.setupClickHandler();
    initAI();

    state.isRunning = true;
    this.drawTerritory();

    this.scene.launch('UIScene');
  }

  // Generates terrain and draws it as colored tiles (once at startup)
  generateAndDrawTerrain() {
    const terrain = new TerrainGrid();
    terrain.generateTerrain(MAP_SEED);
    state.terrain = terrain;

    const bg = this.add.graphics();
    bg.setDepth(-1);
    this.terrainGfx = bg;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const tile = terrain.getTile(col, row);
        const elev = terrain.getElevation(col, row);
        const color = this.getTileColor(tile, elev);
        bg.fillStyle(color, 1);
        bg.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Coastline borders — darker edge on water tiles adjacent to land
    bg.lineStyle(1, 0x2a5a8a, 0.6);
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (terrain.getTile(col, row) !== WATER) continue;
        const hasLandNeighbor =
          terrain.isWalkable(col - 1, row) || terrain.isWalkable(col + 1, row) ||
          terrain.isWalkable(col, row - 1) || terrain.isWalkable(col, row + 1);
        if (hasLandNeighbor) {
          bg.strokeRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // Returns a hex color for a tile based on type and elevation
  getTileColor(tile, elev) {
    if (tile === WATER) {
      const t = elev / 0.32;
      const r = Math.floor(30 + t * 30);
      const g = Math.floor(60 + t * 50);
      const b = Math.floor(120 + t * 60);
      return (r << 16) | (g << 8) | b;
    } else if (tile === PLAINS) {
      const t = (elev - 0.32) / 0.33;
      const r = Math.floor(80 + (1 - t) * 50);
      const g = Math.floor(140 + (1 - t) * 40);
      const b = Math.floor(60 + (1 - t) * 20);
      return (r << 16) | (g << 8) | b;
    } else {
      const t = (elev - 0.65) / 0.35;
      const r = Math.floor(140 - t * 40);
      const g = Math.floor(120 - t * 35);
      const b = Math.floor(70 - t * 25);
      return (r << 16) | (g << 8) | b;
    }
  }

  // Creates the 5 civ objects and stores them in state
  initCivs() {
    for (let i = 0; i < CIV_COLORS.length; i++) {
      const civ = {
        id: i,
        color: CIV_COLORS[i],
        sporebucks: STARTING_SPOREBUCKS,
        units: [],
        cities: [],
        geysers: [],
        personality: null,
      };
      state.civs.push(civ);
    }
    state.player = state.civs[0];
  }

  // Returns world-coord bounding box for a continent (cached in terrain)
  getContinentBounds(ci) {
    return state.terrain.continentBounds[ci];
  }

  // Places cities on their assigned continents (2-2-1 distribution)
  spawnCities() {
    const terrain = state.terrain;
    const placed = [];

    for (let i = 0; i < state.civs.length; i++) {
      const ci = CIV_CONTINENTS[i];
      const bounds = this.getContinentBounds(ci);
      const wcx = bounds.cx;
      const wcy = bounds.cy;
      const wrx = bounds.hw;
      const wry = bounds.hh;

      let bestPos = null;

      for (let pass = 0; pass < 2 && !bestPos; pass++) {
        const buffer = pass === 0 ? CITY_WATER_BUFFER : 0;
        const minDist = pass === 0 ? CITY_MIN_DISTANCE : CITY_MIN_DISTANCE * 0.5;

        for (let attempt = 0; attempt < 500; attempt++) {
          const x = wcx + (Math.random() * 2 - 1) * wrx * 0.7;
          const y = wcy + (Math.random() * 2 - 1) * wry * 0.7;
          const { col, row } = terrain.worldToTile(x, y);

          if (!terrain.isWalkable(col, row)) continue;
          if (terrain.getContinentAt(col, row) !== ci) continue;

          // Water buffer check
          let tooCloseToWater = false;
          if (buffer > 0) {
            for (let dr = -buffer; dr <= buffer && !tooCloseToWater; dr++) {
              for (let dc = -buffer; dc <= buffer; dc++) {
                if (!terrain.isWalkable(col + dc, row + dr)) {
                  tooCloseToWater = true;
                  break;
                }
              }
            }
          }
          if (tooCloseToWater) continue;

          // Min distance from other cities on same continent
          const tooClose = placed.some(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            return Math.sqrt(dx * dx + dy * dy) < minDist;
          });
          if (tooClose) continue;

          bestPos = { x, y };
          break;
        }
      }

      if (!bestPos) {
        console.warn(`Could not place city for civ ${i} on continent ${ci}, using center fallback`);
        bestPos = { x: wcx, y: wcy };
      }

      const city = new City(this, bestPos.x, bestPos.y, state.civs[i]);
      city.continentId = ci;
      placed.push(bestPos);
    }
  }

  // Creates one territory Graphics object per civ at low alpha
  createTerritoryLayers() {
    for (const civ of state.civs) {
      const g = this.add.graphics();
      g.setDepth(DEPTH_TERRITORY);
      g.setAlpha(TERRITORY_ALPHA);
      this.territoryLayers[civ.id] = g;
    }
  }

  // Redraws all territory circles for all civs
  drawTerritory() {
    for (const civ of state.civs) {
      const g = this.territoryLayers[civ.id];
      g.clear();
      g.fillStyle(civ.color, 1);

      for (const city of civ.cities) {
        g.fillCircle(city.x, city.y, TERRITORY_CITY_RADIUS);
      }

      for (const geyser of civ.geysers) {
        g.fillCircle(geyser.x, geyser.y, TERRITORY_GEYSER_RADIUS);
      }
    }
  }

  // Places geysers per continent (5-5-3 distribution)
  spawnGeysers() {
    const terrain = state.terrain;
    const placed = [];

    for (let ci = 0; ci < CONTINENT_GEYSERS.length; ci++) {
      const count = CONTINENT_GEYSERS[ci];
      const bounds = this.getContinentBounds(ci);
      const wcx = bounds.cx;
      const wcy = bounds.cy;
      const wrx = bounds.hw;
      const wry = bounds.hh;

      for (let g = 0; g < count; g++) {
        let bestPos = null;

        for (let attempt = 0; attempt < 500; attempt++) {
          const x = wcx + (Math.random() * 2 - 1) * wrx * 0.8;
          const y = wcy + (Math.random() * 2 - 1) * wry * 0.8;
          const { col, row } = terrain.worldToTile(x, y);

          if (!terrain.isWalkable(col, row)) continue;
          if (terrain.getContinentAt(col, row) !== ci) continue;

          const tooCloseToCity = state.cities.some(c => {
            const dx = c.x - x;
            const dy = c.y - y;
            return Math.sqrt(dx * dx + dy * dy) < GEYSER_MIN_CITY_DIST;
          });
          if (tooCloseToCity) continue;

          const tooCloseToGeyser = placed.some(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            return Math.sqrt(dx * dx + dy * dy) < GEYSER_MIN_GEYSER_DIST;
          });
          if (tooCloseToGeyser) continue;

          bestPos = { x, y };
          break;
        }

        if (bestPos) {
          const geyser = new Geyser(this, bestPos.x, bestPos.y);
          geyser.continentId = ci;
          placed.push(bestPos);
        }
      }
    }

    // Ocean geysers — placed on water tiles, unclaimed until boats exist
    for (let i = 0; i < OCEAN_GEYSERS; i++) {
      let bestPos = null;

      for (let attempt = 0; attempt < 500; attempt++) {
        const x = TILE_SIZE * 5 + Math.random() * (MAP_WIDTH - TILE_SIZE * 10);
        const y = TILE_SIZE * 5 + Math.random() * (MAP_HEIGHT - TILE_SIZE * 10);
        const { col, row } = terrain.worldToTile(x, y);

        // Must be on water
        if (terrain.isWalkable(col, row)) continue;

        // Min distance from land (at least 3 tiles from any coast)
        let tooCloseToLand = false;
        for (let dr = -3; dr <= 3 && !tooCloseToLand; dr++) {
          for (let dc = -3; dc <= 3; dc++) {
            if (terrain.isWalkable(col + dc, row + dr)) {
              tooCloseToLand = true;
              break;
            }
          }
        }
        if (tooCloseToLand) continue;

        // Min distance from other geysers
        const tooClose = placed.some(p => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.sqrt(dx * dx + dy * dy) < GEYSER_MIN_GEYSER_DIST * 2;
        });
        if (tooClose) continue;

        bestPos = { x, y };
        break;
      }

      if (bestPos) {
        const geyser = new Geyser(this, bestPos.x, bestPos.y);
        geyser.continentId = -1; // ocean
        placed.push(bestPos);
      }
    }
  }

  // Configures the camera bounds, zoom, and centers on the player city
  setupCamera() {
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    const playerCity = state.player.cities[0];
    this.cameras.main.centerOn(playerCity.x, playerCity.y);

    // Mouse wheel zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const cam = this.cameras.main;
      const oldZoom = cam.zoom;
      const newZoom = Phaser.Math.Clamp(oldZoom - deltaY * 0.001, 0.4, 2.0);
      cam.setZoom(newZoom);
    });
  }

  // Sets up click-and-drag panning with a threshold to distinguish clicks from drags
  setupPanning() {
    this.input.on('pointerdown', (pointer) => {
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      state.isDragging = false;
      state.uiClicked = false;
    });

    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;

      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > PAN_THRESHOLD) {
        state.isDragging = true;
      }

      if (state.isDragging) {
        const cam = this.cameras.main;
        cam.scrollX -= (pointer.x - this.lastPointerX);
        cam.scrollY -= (pointer.y - this.lastPointerY);
      }

      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
    });
  }

  // Sets up the main click handler for unit selection, movement, and combat
  setupClickHandler() {
    this.input.on('pointerup', (pointer) => {
      if (state.isDragging) return;
      if (state.uiClicked) return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const wx = worldPoint.x;
      const wy = worldPoint.y;

      // 1. Handle spawn popup
      if (this.spawnPopup) {
        if (this.isClickOnPopup(wx, wy)) {
          this.handlePopupClick();
          return;
        }
        this.destroySpawnPopup();
      }

      // 2. Click on player unit → select
      const clickedPlayerUnit = this.findPlayerUnitAt(wx, wy);
      if (clickedPlayerUnit) {
        this.selectUnit(clickedPlayerUnit);
        return;
      }

      // 3. Click on player city → spawn popup
      const clickedPlayerCity = this.findPlayerCityAt(wx, wy);
      if (clickedPlayerCity) {
        this.deselectUnit();
        this.showSpawnPopup(clickedPlayerCity);
        return;
      }

      // 4-7. Actions that require a selected unit
      if (state.selectedUnit) {
        // Click on enemy unit → attack
        const enemyUnit = this.findEnemyUnitAt(wx, wy);
        if (enemyUnit) {
          state.selectedUnit.attackEntity(enemyUnit);
          this.deselectUnit();
          return;
        }

        // Click on enemy city → attack
        const enemyCity = this.findEnemyCityAt(wx, wy);
        if (enemyCity) {
          state.selectedUnit.attackEntity(enemyCity);
          this.deselectUnit();
          return;
        }

        // Click on geyser → claim
        const geyser = this.findGeyserAt(wx, wy);
        if (geyser) {
          state.selectedUnit.claimGeyser(geyser);
          this.deselectUnit();
          return;
        }

        // Click on empty ground → move
        state.selectedUnit.moveTo(wx, wy);
        this.deselectUnit();
        return;
      }
    });
  }

  // Returns the player unit at the given world position, or null
  findPlayerUnitAt(wx, wy) {
    for (const unit of state.player.units) {
      if (!unit.isAlive) continue;
      const dx = wx - unit.x;
      const dy = wy - unit.y;
      if (Math.sqrt(dx * dx + dy * dy) <= UNIT_SPRITE_RADIUS) {
        return unit;
      }
    }
    return null;
  }

  // Returns an enemy unit at the given world position, or null
  findEnemyUnitAt(wx, wy) {
    for (const civ of state.civs) {
      if (civ === state.player) continue;
      for (const unit of civ.units) {
        if (!unit.isAlive) continue;
        const dx = wx - unit.x;
        const dy = wy - unit.y;
        if (Math.sqrt(dx * dx + dy * dy) <= UNIT_SPRITE_RADIUS) {
          return unit;
        }
      }
    }
    return null;
  }

  // Returns a player-owned city at the given world position, or null
  findPlayerCityAt(wx, wy) {
    for (const city of state.cities) {
      if (city.owner !== state.player) continue;
      const dx = wx - city.x;
      const dy = wy - city.y;
      if (Math.sqrt(dx * dx + dy * dy) <= CITY_SPRITE_RADIUS) {
        return city;
      }
    }
    return null;
  }

  // Returns an enemy city at the given world position, or null
  findEnemyCityAt(wx, wy) {
    for (const city of state.cities) {
      if (city.owner === state.player) continue;
      const dx = wx - city.x;
      const dy = wy - city.y;
      if (Math.sqrt(dx * dx + dy * dy) <= CITY_SPRITE_RADIUS) {
        return city;
      }
    }
    return null;
  }

  // Returns a geyser at the given world position, or null
  findGeyserAt(wx, wy) {
    for (const geyser of state.geysers) {
      const dx = wx - geyser.x;
      const dy = wy - geyser.y;
      if (Math.sqrt(dx * dx + dy * dy) <= GEYSER_SPRITE_RADIUS) {
        return geyser;
      }
    }
    return null;
  }

  // Selects a unit and deselects any previously selected unit
  selectUnit(unit) {
    this.deselectUnit();
    unit.select();
    state.selectedUnit = unit;
  }

  // Deselects the currently selected unit
  deselectUnit() {
    if (state.selectedUnit) {
      state.selectedUnit.deselect();
      state.selectedUnit = null;
    }
  }

  // Shows a spawn popup above the given city
  showSpawnPopup(city) {
    this.destroySpawnPopup();

    const popupX = city.x;
    const popupY = city.y - CITY_SPRITE_RADIUS - 40;
    const canSpawn = state.player.sporebucks >= UNIT_COST && state.player.units.length < UNIT_CAP;

    // Background
    const bg = this.add.rectangle(0, 0, 120, 36, 0x222222, 0.9);
    bg.setStrokeStyle(1, 0x888888);

    // Button text
    const textColor = canSpawn ? '#ffffff' : '#666666';
    const label = this.add.text(0, 0, 'Spawn Unit', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: textColor,
    });
    label.setOrigin(0.5, 0.5);

    this.spawnPopup = this.add.container(popupX, popupY, [bg, label]);
    this.spawnPopup.setDepth(DEPTH_UI);
    this.spawnPopupCity = city;
  }

  // Checks if the given world coordinates are within the spawn popup bounds
  isClickOnPopup(wx, wy) {
    if (!this.spawnPopup) return false;
    const px = this.spawnPopup.x;
    const py = this.spawnPopup.y;
    const halfW = 60;
    const halfH = 18;
    return wx >= px - halfW && wx <= px + halfW && wy >= py - halfH && wy <= py + halfH;
  }

  // Handles a click on the spawn popup button
  handlePopupClick() {
    const canSpawn = state.player.sporebucks >= UNIT_COST && state.player.units.length < UNIT_CAP;
    if (!canSpawn) return;

    const city = this.spawnPopupCity;
    const angle = Math.random() * Math.PI * 2;
    const dist = CITY_SPRITE_RADIUS + UNIT_SPRITE_RADIUS + 5;
    new Unit(this, city.x + Math.cos(angle) * dist, city.y + Math.sin(angle) * dist, state.player);
    this.destroySpawnPopup();
  }

  // Destroys the spawn popup if it exists
  destroySpawnPopup() {
    if (this.spawnPopup) {
      this.spawnPopup.destroy();
      this.spawnPopup = null;
      this.spawnPopupCity = null;
    }
  }

  // Cleans up dead units after all updates have been processed
  cleanupDeadUnits() {
    for (const civ of state.civs) {
      const dead = civ.units.filter((u) => !u.isAlive);
      for (const unit of dead) {
        unit.destroy();
      }
    }
  }

  // Runs each frame — updates game time, units, and city regen
  update(time, delta) {
    if (!state.isRunning || state.isPaused) return;

    // Apply game speed multiplier to delta
    const scaledDelta = delta * state.gameSpeed;
    state.gameTime += scaledDelta / 1000;

    // Update all units across all civs
    for (const civ of state.civs) {
      for (const unit of civ.units) {
        unit.update(scaledDelta);
      }
    }

    // Clean up dead units after all updates
    this.cleanupDeadUnits();

    // Update city regen
    for (const city of state.cities) {
      city.updateRegen(scaledDelta);
    }

    // Geyser income tick — GEYSER_INCOME per minute converted to per-second
    for (const geyser of state.geysers) {
      if (geyser.owner) {
        geyser.owner.sporebucks += (GEYSER_INCOME / 60) * (scaledDelta / 1000);
      }
    }

    // AI decision loop
    updateAI(scaledDelta, this);

    // Redraw territory each frame
    this.drawTerritory();

    // Check win/lose conditions
    this.checkWinLose();
  }

  // Checks if the player has won or lost
  checkWinLose() {
    // Win: all cities owned by player
    if (state.cities.every((c) => c.owner === state.player)) {
      state.isRunning = false;
      this.scene.launch('MenuScene', { result: 'win' });
      this.scene.pause('GameScene');
      this.scene.pause('UIScene');
      return;
    }

    // Lose: player has no cities
    if (state.player.cities.length === 0) {
      state.isRunning = false;
      this.scene.launch('MenuScene', { result: 'lose' });
      this.scene.pause('GameScene');
      this.scene.pause('UIScene');
      return;
    }
  }
}
