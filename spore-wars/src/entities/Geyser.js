// Represents a spice geyser resource point that generates income
import { state } from '../state.js';
import {
  GEYSER_HP,
  GEYSER_SPRITE_RADIUS,
  GEYSER_COLOR,
  GEYSER_BAR_WIDTH,
  GEYSER_BAR_HEIGHT,
  GEYSER_BAR_OFFSET_Y,
  DEPTH_GEYSER,
} from '../constants.js';

let nextGeyserId = 0;

export class Geyser {
  // Creates a geyser at the given position, initially unclaimed
  constructor(scene, x, y) {
    this.id = nextGeyserId++;
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.owner = null;
    this.currentHP = GEYSER_HP;
    this.claimState = 'unclaimed';

    this.graphics = this.createGraphics();
    this.hpBarBg = this.createHPBarBackground();
    this.hpBarFill = this.createHPBarFill();

    this.register();
  }

  // Returns the 4 vertices of the diamond shape
  getDiamondPoints(radius) {
    return [
      { x: this.x, y: this.y - radius },
      { x: this.x + radius, y: this.y },
      { x: this.x, y: this.y + radius },
      { x: this.x - radius, y: this.y },
    ];
  }

  // Draws the diamond shape with outline
  createGraphics() {
    const g = this.scene.add.graphics();
    g.setDepth(DEPTH_GEYSER);
    this.drawDiamond(g);
    return g;
  }

  // Fills the diamond shape with current color (unclaimed or owner color)
  drawDiamond(g) {
    const color = this.owner ? this.owner.color : GEYSER_COLOR;
    const darkColor = this.darkenColor(color);

    // Outer diamond (outline)
    const outerPoints = this.getDiamondPoints(GEYSER_SPRITE_RADIUS);
    g.fillStyle(darkColor, 1);
    g.fillPoints(outerPoints, true);

    // Inner diamond (fill)
    const innerPoints = this.getDiamondPoints(GEYSER_SPRITE_RADIUS - 3);
    g.fillStyle(color, 1);
    g.fillPoints(innerPoints, true);
  }

  // Creates the dark background bar for the HP meter
  createHPBarBackground() {
    const barX = this.x - GEYSER_BAR_WIDTH / 2;
    const barY = this.y + GEYSER_BAR_OFFSET_Y;
    const bg = this.scene.add.rectangle(
      barX + GEYSER_BAR_WIDTH / 2,
      barY + GEYSER_BAR_HEIGHT / 2,
      GEYSER_BAR_WIDTH,
      GEYSER_BAR_HEIGHT,
      0x333333,
      0.8
    );
    bg.setDepth(DEPTH_GEYSER);
    return bg;
  }

  // Creates the colored fill bar showing remaining HP
  createHPBarFill() {
    const barX = this.x - GEYSER_BAR_WIDTH / 2;
    const barY = this.y + GEYSER_BAR_OFFSET_Y;
    const fill = this.scene.add.rectangle(
      barX,
      barY + GEYSER_BAR_HEIGHT / 2,
      GEYSER_BAR_WIDTH,
      GEYSER_BAR_HEIGHT,
      0x44dd44,
      0.9
    );
    fill.setOrigin(0, 0.5);
    fill.setDepth(DEPTH_GEYSER);
    return fill;
  }

  // Updates the HP bar fill width to reflect current HP
  updateBar() {
    const pct = this.currentHP / GEYSER_HP;
    this.hpBarFill.width = GEYSER_BAR_WIDTH * pct;
  }

  // Reduces HP and returns true if the geyser is ready to be claimed
  takeDamage(amount) {
    this.currentHP -= amount;
    this.claimState = 'claiming';
    this.updateBar();
    return this.currentHP <= 0;
  }

  // Transfers ownership to the claiming civ
  claim(newOwner) {
    // Remove from old owner if previously claimed
    if (this.owner) {
      this.owner.geysers = this.owner.geysers.filter((g) => g !== this);
    }

    // Assign new owner
    this.owner = newOwner;
    newOwner.geysers.push(this);

    // Reset state
    this.currentHP = GEYSER_HP;
    this.claimState = 'claimed';
    this.updateBar();
    this.redraw();
  }

  // Resets HP to full when a claiming unit abandons the geyser
  resetHP() {
    this.currentHP = GEYSER_HP;
    // Only reset to unclaimed if not already owned
    if (!this.owner) {
      this.claimState = 'unclaimed';
    } else {
      this.claimState = 'claimed';
    }
    this.updateBar();
  }

  // Redraws the diamond graphic when ownership changes
  redraw() {
    this.graphics.clear();
    this.drawDiamond(this.graphics);
  }

  // Darkens a hex color by reducing each channel
  darkenColor(color) {
    const r = Math.max(0, ((color >> 16) & 0xff) - 40);
    const g = Math.max(0, ((color >> 8) & 0xff) - 40);
    const b = Math.max(0, (color & 0xff) - 40);
    return (r << 16) | (g << 8) | b;
  }

  // Registers this geyser in the central state
  register() {
    state.geysers.push(this);
  }

  // Removes this geyser from the central state
  deregister() {
    state.geysers = state.geysers.filter((g) => g !== this);
    if (this.owner) {
      this.owner.geysers = this.owner.geysers.filter((g) => g !== this);
    }
  }

  // Cleans up all graphics and deregisters from state
  destroy() {
    this.graphics.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.deregister();
  }
}
