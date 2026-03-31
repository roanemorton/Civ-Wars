// Main game scene — handles world simulation and rendering
import Phaser from 'phaser';
import { state } from '../state.js';
import { City } from '../entities/City.js';
import { Geyser } from '../entities/Geyser.js';
import { Unit } from '../entities/Unit.js';
import { initAI, updateAI } from '../ai/AI.js';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  MAP_BG_COLOR,
  CIV_COLORS,
  CITY_POSITIONS,
  GEYSER_POSITIONS,
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
    this.drawMap();
    this.initCivs();
    this.createTerritoryLayers();
    this.spawnGeysers();
    this.spawnCities();
    this.setupCamera();
    this.setupPanning();
    this.setupClickHandler();
    initAI();

    state.isRunning = true;
    this.drawTerritory();

    this.scene.launch('UIScene');
  }

  // Draws the flat map background
  drawMap() {
    const bg = this.add.graphics();
    bg.fillStyle(MAP_BG_COLOR, 1);
    bg.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
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

  // Creates one city per civ at the predefined positions
  spawnCities() {
    for (let i = 0; i < state.civs.length; i++) {
      const [x, y] = CITY_POSITIONS[i];
      new City(this, x, y, state.civs[i]);
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

  // Creates geysers at predefined positions across the map
  spawnGeysers() {
    for (const [x, y] of GEYSER_POSITIONS) {
      new Geyser(this, x, y);
    }
  }

  // Configures the camera bounds and centers on the player city
  setupCamera() {
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    const playerCity = state.player.cities[0];
    this.cameras.main.centerOn(playerCity.x, playerCity.y);
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
    new Unit(this, city.x, city.y, state.player);
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
