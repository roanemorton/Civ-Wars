// Entry point — creates the Phaser game instance with config
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { MenuScene } from './scenes/MenuScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scene: [GameScene, UIScene, MenuScene],
  // Only GameScene auto-starts (first in array).
  // UIScene is launched from GameScene.create() after state is populated.
  // MenuScene stays inactive until needed.
};

const game = new Phaser.Game(config);
