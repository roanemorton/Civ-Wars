// HUD scene — displays UI, minimap, and buttons (reads state only, never modifies game logic)
import Phaser from 'phaser';
import { state } from '../state.js';
import { createDebugOverlay, updateDebugOverlay } from '../utils/debug.js';
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  MINIMAP_X,
  MINIMAP_Y,
  TERRITORY_CITY_RADIUS,
  TERRITORY_GEYSER_RADIUS,
  GEYSER_COLOR,
  FAST_FORWARD_SPEED,
  CIV_COLORS,
} from '../constants.js';
import { WATER, PLAINS, HILLS } from '../terrain/TerrainGrid.js';
import {
  getHostility, getRelationshipLabel, getRelationshipColor, getRelationshipTier,
  applyDiplomacy, declareWar, calculateAssistCost, areAtWar,
} from '../ai/Relationships.js';
import { executeHireAssist } from '../ai/AI.js';
import { OPENING_MESSAGES, ACTION_RESPONSES, TIER_ACTIONS, ACTION_LABELS } from '../data/dialogue.js';
import {
  GIFT_COST,
  GIFT_DIPLOMACY_BONUS,
  INSULT_DIPLOMACY_PENALTY,
  DIPLOMACY_COOLDOWN,
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
    this.createDiplomacyPanel();
    createDebugOverlay(this);
  }

  // Creates the minimap background, graphics layer, and click handler
  createMinimap() {
    // Terrain background — drawn once from the terrain grid
    this.minimapTerrainGfx = this.add.graphics();
    this.drawMinimapTerrain();
    // Border
    const border = this.add.graphics();
    border.lineStyle(1, 0x888888, 1);
    border.strokeRect(MINIMAP_X, MINIMAP_Y, MINIMAP_WIDTH, MINIMAP_HEIGHT);

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

  // Draws terrain colors onto the minimap (called once at creation)
  drawMinimapTerrain() {
    const terrain = state.terrain;
    if (!terrain) return;

    const g = this.minimapTerrainGfx;
    const tileW = MINIMAP_WIDTH / GRID_COLS;
    const tileH = MINIMAP_HEIGHT / GRID_ROWS;
    const gameScene = this.scene.get('GameScene');

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const tile = terrain.getTile(col, row);
        const elev = terrain.getElevation(col, row);
        const color = gameScene.getTileColor(tile, elev);
        g.fillStyle(color, 1);
        g.fillRect(
          MINIMAP_X + col * tileW,
          MINIMAP_Y + row * tileH,
          Math.ceil(tileW),
          Math.ceil(tileH)
        );
      }
    }
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

  // Creates the Diplomacy toggle button and expandable panel at bottom-right
  createDiplomacyPanel() {
    const civNames = ['Blue', 'Red', 'Green', 'Orange', 'Purple'];
    const btnW = 120;
    const btnH = 32;
    const btnX = 1280 - btnW - 10;
    const btnY = 720 - btnH - 10;

    this.diplomacyOpen = false;
    this.commTarget = null; // civ index of open communication panel
    this.diplomacyCooldowns = { 1: -Infinity, 2: -Infinity, 3: -Infinity, 4: -Infinity };

    // Toggle button
    this.diplomacyBtn = this.add.rectangle(
      btnX + btnW / 2, btnY + btnH / 2, btnW, btnH, 0x333333, 0.85
    );
    this.diplomacyBtn.setStrokeStyle(1, 0x888888);
    this.diplomacyBtn.setInteractive();

    this.diplomacyBtnLabel = this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'Diplomacy', {
      fontSize: '13px', fontFamily: 'monospace', color: '#cccccc',
    }).setOrigin(0.5, 0.5);

    this.diplomacyBtn.on('pointerdown', () => {
      state.uiClicked = true;
      this.diplomacyOpen = !this.diplomacyOpen;
      this.setDiplomacyVisible(this.diplomacyOpen);
      if (!this.diplomacyOpen) this.closeCommPanel();
    });

    // Main panel — expands upward from button
    const rowH = 36;
    const panelW = 300;
    const panelH = rowH * 4 + 16;
    const panelX = 1280 - panelW - 10;
    const panelY = btnY - panelH - 4;

    this.diplomacyPanelBg = this.add.rectangle(
      panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x1a1a2e, 0.92
    );
    this.diplomacyPanelBg.setStrokeStyle(1, 0x666666);
    this.diplomacyPanelBg.setVisible(false);

    // One row per AI civ
    this.diplomacyRows = [];
    for (let i = 1; i < 5; i++) {
      const rowY = panelY + 8 + (i - 1) * rowH;
      const row = {};
      row.civIndex = i;

      // Color dot
      row.dot = this.add.circle(panelX + 16, rowY + 18, 7, CIV_COLORS[i]);

      // Civ name
      row.name = this.add.text(panelX + 30, rowY + 4, civNames[i], {
        fontSize: '11px', fontFamily: 'monospace', color: '#cccccc',
      });

      // Relationship label
      row.relLabel = this.add.text(panelX + 30, rowY + 18, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#aaaaaa',
      });

      // Stats text
      row.stats = this.add.text(panelX + 140, rowY + 10, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#888888',
      });

      // Talk button
      const talkX = panelX + panelW - 50;
      const talkY = rowY + 18;
      row.talkBg = this.add.rectangle(talkX, talkY, 44, 24, 0x444444, 0.9);
      row.talkBg.setStrokeStyle(1, 0x777777);
      row.talkBg.setInteractive();
      row.talkLabel = this.add.text(talkX, talkY, 'Talk', {
        fontSize: '10px', fontFamily: 'monospace', color: '#cccccc',
      }).setOrigin(0.5, 0.5);

      row.talkBg.on('pointerdown', () => {
        state.uiClicked = true;
        this.openCommPanel(i);
      });

      // Store all elements for visibility toggling
      row.elements = [row.dot, row.name, row.relLabel, row.stats, row.talkBg, row.talkLabel];
      for (const el of row.elements) el.setVisible(false);

      this.diplomacyRows.push(row);
    }

    // Communication sub-panel (created once, repositioned when opened)
    this.commPanel = this.createCommPanel();
  }

  // Creates the communication sub-panel (hidden by default, rebuilt each open)
  createCommPanel() {
    const panel = {};
    const w = 220;
    const maxH = 320;

    panel.container = this.add.container(0, 0);
    panel.container.setVisible(false);
    panel.w = w;
    panel.maxH = maxH;

    // Background (resized dynamically)
    panel.bg = this.add.rectangle(w / 2, 0, w, maxH, 0x222222, 0.95);
    panel.bg.setOrigin(0.5, 0);
    panel.bg.setStrokeStyle(2, 0xffffff);
    panel.container.add(panel.bg);

    // Header bar
    panel.headerBar = this.add.rectangle(w / 2, 14, w - 4, 26, 0xffffff, 0.2);
    panel.container.add(panel.headerBar);

    // Header text
    panel.headerText = this.add.text(10, 5, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
    });
    panel.container.add(panel.headerText);

    // Close button
    panel.closeBtn = this.add.text(w - 16, 4, 'x', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5, 0);
    panel.closeBtn.setInteractive();
    panel.closeBtn.on('pointerdown', () => {
      state.uiClicked = true;
      this.closeCommPanel();
    });
    panel.container.add(panel.closeBtn);

    // Opening message text (word-wrapped)
    panel.messageText = this.add.text(10, 32, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#cccccc',
      wordWrap: { width: w - 20 },
    });
    panel.container.add(panel.messageText);

    // Dynamic action buttons (created/destroyed per open)
    panel.actionButtons = [];

    // Response text (shown after action, replaces buttons)
    panel.responseText = this.add.text(w / 2, 80, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffdd88',
      wordWrap: { width: w - 20 }, align: 'center',
    }).setOrigin(0.5, 0);
    panel.responseText.setVisible(false);
    panel.container.add(panel.responseText);

    // Cooldown text
    panel.cooldownText = this.add.text(w / 2, 0, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5, 0);
    panel.container.add(panel.cooldownText);

    // Response auto-close timer
    panel.responseTimer = null;

    return panel;
  }

  // Opens the communication sub-panel for a specific civ
  openCommPanel(civIndex) {
    this.commTarget = civIndex;
    this.commPage = 'actions'; // 'actions' or 'target_picker'
    const civNames = ['Blue', 'Red', 'Green', 'Orange', 'Purple'];
    const civ = state.civs[civIndex];
    const color = CIV_COLORS[civIndex];
    const tier = getRelationshipTier(civ, state.player);

    // Clean up old action buttons
    for (const btn of this.commPanel.actionButtons) {
      btn.bg.destroy();
      btn.label.destroy();
    }
    this.commPanel.actionButtons = [];
    this.commPanel.responseText.setVisible(false);
    if (this.commPanel.responseTimer) {
      clearTimeout(this.commPanel.responseTimer);
      this.commPanel.responseTimer = null;
    }

    // Color-code
    this.commPanel.bg.setStrokeStyle(2, color);
    this.commPanel.headerBar.setFillStyle(color, 0.25);
    this.commPanel.headerText.setText(`Talk to ${civNames[civIndex]}`);
    this.commPanel.headerText.setColor('#' + color.toString(16).padStart(6, '0'));

    // Opening message
    const civType = civ.civType || 'military';
    const msg = OPENING_MESSAGES[civType]?.[tier] || 'Hmm.';
    this.commPanel.messageText.setText(`"${msg}"`);

    // Create action buttons based on tier
    const actions = TIER_ACTIONS[tier] || [];
    const onCooldown = this.isOnCooldown(civIndex);
    const btnW = 190;
    const btnH = 24;
    let y = 32 + this.commPanel.messageText.height + 12;

    for (const action of actions) {
      const actionLabel = ACTION_LABELS[action] || action;
      const isGift = action === 'offer_gift';
      const isInsult = action === 'insult';
      const isWar = action === 'declare_war';
      const isMilAssist = action === 'request_military_assistance';

      let disabled = onCooldown;
      if (isGift && state.player.sporebucks < GIFT_COST) disabled = true;
      if (isWar && areAtWar(state.player, civ)) disabled = true;

      const btnColor = isWar ? 0x663333 : isInsult ? 0x554433 : isGift ? 0x336633 : 0x333366;
      const btnColorDisabled = 0x444444;
      const textColor = disabled ? '#666666' : '#cccccc';

      const bg = this.add.rectangle(this.commPanel.w / 2, y, btnW, btnH, disabled ? btnColorDisabled : btnColor, 0.9);
      bg.setStrokeStyle(1, 0x666666);
      if (!disabled) bg.setInteractive();

      let labelStr = actionLabel;
      if (isGift) labelStr += ` (${GIFT_COST})`;
      const label = this.add.text(this.commPanel.w / 2, y, labelStr, {
        fontSize: '10px', fontFamily: 'monospace', color: textColor,
      }).setOrigin(0.5, 0.5);

      bg.on('pointerdown', () => {
        state.uiClicked = true;
        this.handleCommAction(action);
      });

      this.commPanel.container.add(bg);
      this.commPanel.container.add(label);
      this.commPanel.actionButtons.push({ bg, label });

      y += btnH + 4;
    }

    // Cooldown text position
    this.commPanel.cooldownText.setY(y + 4);
    this.commPanel.cooldownText.setText(onCooldown
      ? `Cooldown: ${Math.ceil(DIPLOMACY_COOLDOWN - (state.gameTime - this.diplomacyCooldowns[civIndex]))}s`
      : '');

    // Resize background
    const totalH = y + 24;
    this.commPanel.bg.setSize(this.commPanel.w, totalH);

    // Position to the left of the diplomacy panel
    const mainPanelW = 300;
    const mainPanelX = 1280 - mainPanelW - 10;
    const commX = mainPanelX - this.commPanel.w - 8;

    const rowIndex = civIndex - 1;
    const rowH = 36;
    const btnY2 = 720 - 32 - 10;
    const mainPanelH = rowH * 4 + 16;
    const mainPanelY = btnY2 - mainPanelH - 4;
    let commY = mainPanelY + 8 + rowIndex * rowH - 40;
    commY = Math.max(10, Math.min(commY, 720 - totalH - 10));

    this.commPanel.container.setPosition(commX, commY);
    this.commPanel.container.setVisible(true);
  }

  // Handles a dialogue action
  handleCommAction(action) {
    if (this.commTarget === null) return;
    const target = state.civs[this.commTarget];
    if (!target) return;
    if (this.isOnCooldown(this.commTarget)) return;

    const tier = getRelationshipTier(target, state.player);
    const civType = target.civType || 'military';

    if (action === 'offer_gift') {
      if (state.player.sporebucks < GIFT_COST) return;
      state.player.sporebucks -= GIFT_COST;
      applyDiplomacy(state.player.id, target.id, GIFT_DIPLOMACY_BONUS);
    } else if (action === 'insult') {
      applyDiplomacy(state.player.id, target.id, -INSULT_DIPLOMACY_PENALTY);
    } else if (action === 'declare_war') {
      if (areAtWar(state.player, target)) return;
      declareWar(state.player, target);
    } else if (action === 'request_military_assistance') {
      this.openTargetPicker();
      return; // Don't show response yet — target picker handles it
    }

    this.diplomacyCooldowns[this.commTarget] = state.gameTime;
    this.showResponse(action, civType, tier);
  }

  // Opens the target picker for military assistance (page 2)
  openTargetPicker() {
    const civIndex = this.commTarget;
    const hiredCiv = state.civs[civIndex];
    const civNames = ['Blue', 'Red', 'Green', 'Orange', 'Purple'];

    // Hide action buttons
    for (const btn of this.commPanel.actionButtons) {
      btn.bg.setVisible(false);
      btn.label.setVisible(false);
    }
    this.commPanel.messageText.setText('Choose a target:');
    this.commPanel.cooldownText.setText('');

    // Show target civ buttons
    let y = 32 + this.commPanel.messageText.height + 12;
    const btnW = 190;
    const btnH = 24;

    for (let i = 0; i < state.civs.length; i++) {
      if (i === 0 || i === civIndex) continue; // skip player and hired civ
      const targetCiv = state.civs[i];
      if (targetCiv.cities.length === 0) continue;

      const cost = calculateAssistCost(state.player, hiredCiv, targetCiv);
      if (cost === null) continue;

      const canAfford = state.player.sporebucks >= cost;
      const textColor = canAfford ? '#cccccc' : '#666666';

      const bg = this.add.rectangle(this.commPanel.w / 2, y, btnW, btnH, canAfford ? 0x333366 : 0x444444, 0.9);
      bg.setStrokeStyle(1, 0x666666);
      if (canAfford) bg.setInteractive();

      const label = this.add.text(this.commPanel.w / 2, y, `${civNames[i]} (${cost})`, {
        fontSize: '10px', fontFamily: 'monospace', color: textColor,
      }).setOrigin(0.5, 0.5);

      bg.on('pointerdown', () => {
        state.uiClicked = true;
        this.executeAssist(civIndex, i, cost);
      });

      this.commPanel.container.add(bg);
      this.commPanel.container.add(label);
      this.commPanel.actionButtons.push({ bg, label });

      y += btnH + 4;
    }

    // Cancel button
    const cancelBg = this.add.rectangle(this.commPanel.w / 2, y, btnW, btnH, 0x444444, 0.9);
    cancelBg.setStrokeStyle(1, 0x666666);
    cancelBg.setInteractive();
    const cancelLabel = this.add.text(this.commPanel.w / 2, y, 'Cancel', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5, 0.5);
    cancelBg.on('pointerdown', () => {
      state.uiClicked = true;
      this.openCommPanel(civIndex); // Reopen to go back to page 1
    });
    this.commPanel.container.add(cancelBg);
    this.commPanel.container.add(cancelLabel);
    this.commPanel.actionButtons.push({ bg: cancelBg, label: cancelLabel });

    // Resize
    const totalH = y + btnH + 16;
    this.commPanel.bg.setSize(this.commPanel.w, totalH);
  }

  // Executes military assistance
  executeAssist(hiredCivIndex, targetCivIndex, cost) {
    const hiredCiv = state.civs[hiredCivIndex];
    const targetCiv = state.civs[targetCivIndex];
    const gameScene = this.scene.get('GameScene');

    executeHireAssist(hiredCiv, targetCiv, cost, gameScene);
    this.diplomacyCooldowns[this.commTarget] = state.gameTime;

    const tier = getRelationshipTier(hiredCiv, state.player);
    const civType = hiredCiv.civType || 'military';
    this.showResponse('request_military_assistance', civType, tier);
  }

  // Shows the AI response text and auto-closes after 2 seconds
  showResponse(action, civType, tier) {
    const response = ACTION_RESPONSES[action]?.[civType]?.[tier] || 'Hmm.';

    // Hide action buttons
    for (const btn of this.commPanel.actionButtons) {
      btn.bg.setVisible(false);
      btn.label.setVisible(false);
    }
    this.commPanel.cooldownText.setText('');

    // Show response
    this.commPanel.responseText.setText(`"${response}"`);
    this.commPanel.responseText.setY(32 + this.commPanel.messageText.height + 12);
    this.commPanel.responseText.setVisible(true);

    // Auto-close after 2 seconds
    if (this.commPanel.responseTimer) clearTimeout(this.commPanel.responseTimer);
    this.commPanel.responseTimer = setTimeout(() => {
      this.closeCommPanel();
    }, 2000);
  }

  // Closes the communication sub-panel
  closeCommPanel() {
    this.commTarget = null;
    this.commPanel.container.setVisible(false);
    this.commPanel.responseText.setVisible(false);
    // Clean up dynamic buttons
    for (const btn of this.commPanel.actionButtons) {
      btn.bg.destroy();
      btn.label.destroy();
    }
    this.commPanel.actionButtons = [];
    if (this.commPanel.responseTimer) {
      clearTimeout(this.commPanel.responseTimer);
      this.commPanel.responseTimer = null;
    }
  }

  // Checks if a civ is on diplomacy cooldown
  isOnCooldown(civIndex) {
    return state.gameTime - this.diplomacyCooldowns[civIndex] < DIPLOMACY_COOLDOWN;
  }

  // Toggles visibility of all diplomacy panel elements
  setDiplomacyVisible(visible) {
    this.diplomacyPanelBg.setVisible(visible);
    for (const row of this.diplomacyRows) {
      for (const el of row.elements) el.setVisible(visible);
    }
  }

  // Updates diplomacy panel contents each frame
  updateDiplomacyPanel() {
    if (!this.diplomacyOpen || !state.player) return;

    for (const row of this.diplomacyRows) {
      const civ = state.civs[row.civIndex];
      if (!civ) continue;

      const eliminated = civ.cities.length === 0 && civ.units.filter(u => u.isAlive).length === 0;

      // Relationship
      const h = getHostility(civ, state.player);
      const label = getRelationshipLabel(h);
      const color = getRelationshipColor(h);
      row.relLabel.setText(label);
      row.relLabel.setColor(color);

      // Stats
      const units = civ.units.filter(u => u.isAlive).length;
      row.stats.setText(`C:${civ.cities.length} U:${units} G:${civ.geysers.length}`);

      // Dim eliminated civs
      const alpha = eliminated ? 0.35 : 1;
      for (const el of row.elements) el.setAlpha(alpha);

      // Disable talk button for eliminated civs
      if (eliminated) {
        row.talkBg.disableInteractive();
      } else {
        row.talkBg.setInteractive();
      }
    }

    // Close communication sub-panel if target is eliminated
    if (this.commTarget !== null) {
      const target = state.civs[this.commTarget];
      const eliminated = !target || (target.cities.length === 0 && target.units.filter(u => u.isAlive).length === 0);
      if (eliminated) this.closeCommPanel();
    }
  }

  // Updates all UI elements each frame
  update() {
    this.updateMinimap();
    this.updateSpeedButtons();
    this.updateSporebucksCounter();
    this.updateDiplomacyPanel();
    updateDebugOverlay();
  }
}
