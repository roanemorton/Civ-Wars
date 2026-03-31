// HUD scene — displays UI, minimap, and buttons (reads state only, never modifies it)
import Phaser from 'phaser';
import { createDebugOverlay, updateDebugOverlay } from '../utils/debug.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  // Initializes UI elements and the debug overlay
  create() {
    createDebugOverlay(this);
  }

  // Updates UI elements each frame
  update() {
    updateDebugOverlay();
  }
}
