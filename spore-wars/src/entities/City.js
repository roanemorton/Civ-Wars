// Represents a city that can be owned, conquered, and produces units
import { state } from '../state.js';
import {
  CITY_SPRITE_RADIUS,
  CITY_HP,
  CITY_REGEN_RATE,
  CITY_REGEN_COOLDOWN,
  CONQUEST_BAR_WIDTH,
  CONQUEST_BAR_HEIGHT,
  CONQUEST_BAR_OFFSET_Y,
  DEPTH_CITY,
} from '../constants.js';

let nextCityId = 0;

export class City {
  // Creates a city at the given position, owned by the given civ
  constructor(scene, x, y, ownerCiv) {
    this.id = nextCityId++;
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.owner = ownerCiv;
    this.currentHP = CITY_HP;
    this.lastAttackedTime = 0;
    this.regenActive = false;

    this.graphics = this.createGraphics();
    this.conquestBarBg = this.createConquestBarBackground();
    this.conquestBarFill = this.createConquestBarFill();

    this.register();
  }

  // Draws the city circle and placeholder buildings
  createGraphics() {
    const g = this.scene.add.graphics();
    this.drawCity(g);
    g.setDepth(DEPTH_CITY);
    return g;
  }

  // Draws the city shape using the current owner's color
  drawCity(g) {
    // Outer ring (darker shade)
    g.fillStyle(this.darkenColor(this.owner.color), 1);
    g.fillCircle(this.x, this.y, CITY_SPRITE_RADIUS);

    // Inner fill
    g.fillStyle(this.owner.color, 1);
    g.fillCircle(this.x, this.y, CITY_SPRITE_RADIUS - 3);

    // Placeholder buildings — small rectangles inside the circle
    const bldgColor = this.darkenColor(this.owner.color);
    g.fillStyle(bldgColor, 0.7);
    g.fillRect(this.x - 12, this.y - 10, 10, 14);
    g.fillRect(this.x + 2, this.y - 6, 10, 10);
    g.fillRect(this.x - 5, this.y + 2, 10, 8);
  }

  // Redraws the city graphics in the current owner's color
  redraw() {
    this.graphics.clear();
    this.drawCity(this.graphics);
  }

  // Creates the dark background bar for the conquest meter
  createConquestBarBackground() {
    const barX = this.x - CONQUEST_BAR_WIDTH / 2;
    const barY = this.y + CONQUEST_BAR_OFFSET_Y;
    const bg = this.scene.add.rectangle(
      barX + CONQUEST_BAR_WIDTH / 2,
      barY + CONQUEST_BAR_HEIGHT / 2,
      CONQUEST_BAR_WIDTH,
      CONQUEST_BAR_HEIGHT,
      0x333333,
      0.8
    );
    bg.setDepth(DEPTH_CITY);
    return bg;
  }

  // Creates the colored fill bar showing conquest progress
  createConquestBarFill() {
    const barX = this.x - CONQUEST_BAR_WIDTH / 2;
    const barY = this.y + CONQUEST_BAR_OFFSET_Y;
    const fill = this.scene.add.rectangle(
      barX,
      barY + CONQUEST_BAR_HEIGHT / 2,
      0,
      CONQUEST_BAR_HEIGHT,
      0xff0000,
      0.9
    );
    fill.setOrigin(0, 0.5);
    fill.setDepth(DEPTH_CITY);
    return fill;
  }

  // Returns the conquest percentage (0–100)
  getConquestPercent() {
    return ((CITY_HP - this.currentHP) / CITY_HP) * 100;
  }

  // Updates the conquest bar width to reflect current HP
  updateBar() {
    const pct = this.getConquestPercent() / 100;
    this.conquestBarFill.width = CONQUEST_BAR_WIDTH * pct;
  }

  // Reduces city HP and triggers capture if HP reaches 0
  takeDamage(amount, attackerCiv) {
    this.currentHP -= amount;
    this.lastAttackedTime = state.gameTime;
    this.regenActive = false;

    if (this.currentHP <= 0) {
      this.currentHP = 0;
      this.capture(attackerCiv);
    }

    this.updateBar();
  }

  // Transfers city ownership to a new civ
  capture(newOwner) {
    const oldOwner = this.owner;

    // Remove from old owner
    oldOwner.cities = oldOwner.cities.filter((c) => c !== this);

    // Assign to new owner
    this.owner = newOwner;
    newOwner.cities.push(this);

    // Reset city state
    this.currentHP = CITY_HP;
    this.lastAttackedTime = 0;
    this.regenActive = false;
    this.updateBar();
    this.redraw();

    // If old owner has no cities left, kill all their units and unclaim geysers
    if (oldOwner.cities.length === 0) {
      for (const unit of oldOwner.units) {
        unit.isAlive = false;
      }
      for (const geyser of [...oldOwner.geysers]) {
        geyser.unclaim();
      }
    }
  }

  // Checks regen cooldown and regenerates HP if active
  updateRegen(delta) {
    if (this.currentHP >= CITY_HP) return;

    // Check if cooldown has elapsed to activate regen
    if (!this.regenActive && this.lastAttackedTime > 0) {
      if (state.gameTime - this.lastAttackedTime >= CITY_REGEN_COOLDOWN) {
        this.regenActive = true;
      }
    }

    // Apply regen
    if (this.regenActive) {
      this.currentHP = Math.min(CITY_HP, this.currentHP + CITY_REGEN_RATE * (delta / 1000));
      this.updateBar();
    }
  }

  // Darkens a hex color by reducing each channel
  darkenColor(color) {
    const r = Math.max(0, ((color >> 16) & 0xff) - 40);
    const g = Math.max(0, ((color >> 8) & 0xff) - 40);
    const b = Math.max(0, (color & 0xff) - 40);
    return (r << 16) | (g << 8) | b;
  }

  // Registers this city in the central state and owner's city list
  register() {
    state.cities.push(this);
    this.owner.cities.push(this);
  }

  // Removes this city from the central state and owner's city list
  deregister() {
    state.cities = state.cities.filter((c) => c !== this);
    this.owner.cities = this.owner.cities.filter((c) => c !== this);
  }

  // Cleans up all graphics and deregisters from state
  destroy() {
    this.graphics.destroy();
    this.conquestBarBg.destroy();
    this.conquestBarFill.destroy();
    this.deregister();
  }
}
