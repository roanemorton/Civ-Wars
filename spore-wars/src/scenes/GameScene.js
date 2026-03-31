// Main game scene — handles world simulation and rendering
import Phaser from 'phaser';
import { state } from '../state.js';
import { City } from '../entities/City.js';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  MAP_BG_COLOR,
  CIV_COLORS,
  CITY_POSITIONS,
  STARTING_SPOREBUCKS,
  PAN_THRESHOLD,
} from '../constants.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
  }

  // Sets up the map, civs, cities, camera, and input
  create() {
    this.drawMap();
    this.initCivs();
    this.spawnCities();
    this.setupCamera();
    this.setupPanning();

    state.isRunning = true;

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

    this.input.on('pointerup', () => {
      // isDragging stays true until next pointerdown so click handlers can check it
    });
  }

  // Runs each frame — updates game time
  update(time, delta) {
    if (!state.isRunning || state.isPaused) return;
    state.gameTime += delta / 1000;
  }
}
