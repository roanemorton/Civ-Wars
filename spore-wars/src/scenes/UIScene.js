// HUD scene — displays UI, minimap, and buttons (reads state only, never modifies game logic)
import Phaser from 'phaser';
import { state } from '../state.js';
import { createDebugOverlay, updateDebugOverlay } from '../utils/debug.js';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  MINIMAP_X,
  MINIMAP_Y,
  MINIMAP_BG_COLOR,
  TERRITORY_CITY_RADIUS,
  TERRITORY_GEYSER_RADIUS,
  GEYSER_COLOR,
  FAST_FORWARD_SPEED,
} from '../constants.js';

const SCALE_X = MINIMAP_WIDTH / MAP_WIDTH;
const SCALE_Y = MINIMAP_HEIGHT / MAP_HEIGHT;

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  // Initializes all UI elements
  create() {
    this.createMinimap();
    this.createSpeedButtons();
    this.createSporebucksCounter();
    this.createPlaceholderTabs();
    createDebugOverlay(this);
  }

  // Creates the minimap background, graphics layer, and click handler
  createMinimap() {
    // Background
    this.minimapBg = this.add.rectangle(
      MINIMAP_X + MINIMAP_WIDTH / 2,
      MINIMAP_Y + MINIMAP_HEIGHT / 2,
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
      MINIMAP_BG_COLOR,
      0.9
    );
    this.minimapBg.setStrokeStyle(1, 0x888888);

    // Graphics layer for drawing territory, cities, geysers
    this.minimapGfx = this.add.graphics();

    // Viewport rectangle (white outline showing current camera view)
    this.minimapViewport = this.add.graphics();

    // Interactive hit area for click-to-jump
    this.minimapHit = this.add.rectangle(
      MINIMAP_X + MINIMAP_WIDTH / 2,
      MINIMAP_Y + MINIMAP_HEIGHT / 2,
      MINIMAP_WIDTH,
      MINIMAP_HEIGHT,
      0x000000,
      0
    );
    this.minimapHit.setInteractive();
    this.minimapHit.on('pointerdown', (pointer) => {
      this.handleMinimapClick(pointer);
    });
  }

  // Handles a click on the minimap — jumps camera to that world position
  handleMinimapClick(pointer) {
    state.uiClicked = true;
    const localX = pointer.x - MINIMAP_X;
    const localY = pointer.y - MINIMAP_Y;
    const worldX = (localX / MINIMAP_WIDTH) * MAP_WIDTH;
    const worldY = (localY / MINIMAP_HEIGHT) * MAP_HEIGHT;

    const gameScene = this.scene.get('GameScene');
    gameScene.cameras.main.centerOn(worldX, worldY);
  }

  // Redraws the minimap contents each frame
  updateMinimap() {
    this.minimapGfx.clear();

    // Draw territory circles (scaled down)
    for (const civ of state.civs) {
      this.minimapGfx.fillStyle(civ.color, 0.4);
      for (const city of civ.cities) {
        const mx = MINIMAP_X + city.x * SCALE_X;
        const my = MINIMAP_Y + city.y * SCALE_Y;
        this.minimapGfx.fillCircle(mx, my, TERRITORY_CITY_RADIUS * SCALE_X);
      }
      for (const geyser of civ.geysers) {
        const mx = MINIMAP_X + geyser.x * SCALE_X;
        const my = MINIMAP_Y + geyser.y * SCALE_Y;
        this.minimapGfx.fillCircle(mx, my, TERRITORY_GEYSER_RADIUS * SCALE_X);
      }
    }

    // Draw city dots
    for (const city of state.cities) {
      this.minimapGfx.fillStyle(city.owner.color, 1);
      const mx = MINIMAP_X + city.x * SCALE_X;
      const my = MINIMAP_Y + city.y * SCALE_Y;
      this.minimapGfx.fillCircle(mx, my, 4);
    }

    // Draw geyser dots
    for (const geyser of state.geysers) {
      const color = geyser.owner ? geyser.owner.color : GEYSER_COLOR;
      this.minimapGfx.fillStyle(color, 1);
      const mx = MINIMAP_X + geyser.x * SCALE_X;
      const my = MINIMAP_Y + geyser.y * SCALE_Y;
      this.minimapGfx.fillCircle(mx, my, 2);
    }

    // Draw camera viewport rectangle
    this.minimapViewport.clear();
    const gameScene = this.scene.get('GameScene');
    if (gameScene && gameScene.cameras.main) {
      const cam = gameScene.cameras.main;
      const vx = MINIMAP_X + cam.scrollX * SCALE_X;
      const vy = MINIMAP_Y + cam.scrollY * SCALE_Y;
      const vw = cam.width * SCALE_X;
      const vh = cam.height * SCALE_Y;
      this.minimapViewport.lineStyle(1, 0xffffff, 0.8);
      this.minimapViewport.strokeRect(vx, vy, vw, vh);
    }
  }

  // Creates play, pause, and fast-forward buttons at the top right
  createSpeedButtons() {
    const btnY = 20;
    const btnW = 36;
    const btnH = 28;
    const btnGap = 6;
    const startX = 1280 - (btnW * 3 + btnGap * 2) - 10;

    this.speedButtons = [];

    const labels = ['▶', '⏸', '⏩'];
    const actions = [
      () => { state.isPaused = false; state.gameSpeed = 1; },
      () => { state.isPaused = true; },
      () => { state.isPaused = false; state.gameSpeed = FAST_FORWARD_SPEED; },
    ];

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (btnW + btnGap) + btnW / 2;

      const bg = this.add.rectangle(x, btnY, btnW, btnH, 0x333333, 0.9);
      bg.setStrokeStyle(1, 0x888888);
      bg.setInteractive();

      const label = this.add.text(x, btnY, labels[i], {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#ffffff',
      });
      label.setOrigin(0.5, 0.5);

      bg.on('pointerdown', () => {
        state.uiClicked = true;
        actions[i]();
      });

      this.speedButtons.push({ bg, label, index: i });
    }
  }

  // Updates the visual highlight on speed buttons to show active state
  updateSpeedButtons() {
    for (const btn of this.speedButtons) {
      let isActive = false;
      if (btn.index === 0) isActive = !state.isPaused && state.gameSpeed === 1;
      if (btn.index === 1) isActive = state.isPaused;
      if (btn.index === 2) isActive = !state.isPaused && state.gameSpeed === FAST_FORWARD_SPEED;

      btn.bg.setFillStyle(isActive ? 0x4488ff : 0x333333, 0.9);
    }
  }

  // Creates the Sporebucks counter below the minimap
  createSporebucksCounter() {
    this.sporebucksText = this.add.text(
      MINIMAP_X,
      MINIMAP_Y + MINIMAP_HEIGHT + 8,
      'Sporebucks: 0',
      {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: '#ffdd44',
      }
    );
  }

  // Updates the Sporebucks counter display
  updateSporebucksCounter() {
    if (state.player) {
      this.sporebucksText.setText(`Sporebucks: ${Math.floor(state.player.sporebucks)}`);
    }
  }

  // Creates the 4 placeholder tab headers at the top left
  createPlaceholderTabs() {
    const tabNames = ['Dropdowns', 'News', 'Priorities', 'Ongoing Effects'];
    const tabX = 10;
    const tabStartY = 10;
    const tabH = 24;
    const tabGap = 4;

    for (let i = 0; i < tabNames.length; i++) {
      const y = tabStartY + i * (tabH + tabGap);

      const bg = this.add.rectangle(tabX + 70, y + tabH / 2, 140, tabH, 0x333333, 0.7);
      bg.setStrokeStyle(1, 0x666666);
      bg.setOrigin(0.5, 0.5);

      this.add.text(tabX + 8, y + 4, tabNames[i], {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#aaaaaa',
      });
    }
  }

  // Updates all UI elements each frame
  update() {
    this.updateMinimap();
    this.updateSpeedButtons();
    this.updateSporebucksCounter();
    updateDebugOverlay();
  }
}
