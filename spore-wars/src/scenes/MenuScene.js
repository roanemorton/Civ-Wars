// Menu scene — handles win/lose/start screens
import Phaser from 'phaser';
import { state, resetState } from '../state.js';
import { resetAI } from '../ai/AI.js';
import { resetRelationships } from '../ai/Relationships.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  // Creates the victory or defeat screen based on the result data
  create(data) {
    const result = data.result;
    const isWin = result === 'win';

    // Semi-transparent overlay
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7);

    // Title
    const titleText = isWin ? 'VICTORY' : 'DEFEAT';
    const titleColor = isWin ? '#44ff44' : '#ff4444';
    this.add.text(640, 200, titleText, {
      fontSize: '64px',
      fontFamily: 'monospace',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Stats (win only)
    if (isWin) {
      const minutes = Math.floor(state.gameTime / 60);
      const seconds = Math.floor(state.gameTime % 60);
      const timeStr = `Time: ${minutes}m ${seconds}s`;

      this.add.text(640, 280, timeStr, {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#ffffff',
      }).setOrigin(0.5, 0.5);

      this.add.text(640, 310, `Units Lost: ${state.unitsLost}`, {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#ffffff',
      }).setOrigin(0.5, 0.5);
    }

    // Start Over button
    this.createButton(640, 400, 'Start Over', () => {
      this.restartGame();
    });

    // Quit button
    this.createButton(640, 460, 'Quit', () => {
      window.location.reload();
    });
  }

  // Creates a clickable button with background and label
  createButton(x, y, text, callback) {
    const bg = this.add.rectangle(x, y, 200, 40, 0x333333, 0.9);
    bg.setStrokeStyle(2, 0x888888);
    bg.setInteractive();

    const label = this.add.text(x, y, text, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ffffff',
    });
    label.setOrigin(0.5, 0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x555555, 0.9);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x333333, 0.9);
    });
    bg.on('pointerdown', callback);
  }

  // Restarts the game with a clean state
  restartGame() {
    this.scene.stop('UIScene');
    resetState();
    resetAI();
    resetRelationships();
    // start('GameScene') restarts it; stop MenuScene last since we're running in it
    this.scene.start('GameScene');
    this.scene.stop('MenuScene');
  }
}
