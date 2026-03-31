// Represents a city that can be owned, conquered, and produces units
import Phaser from 'phaser';
import { state } from '../state.js';
import {
  CITY_SPRITE_RADIUS,
  CITY_HP,
  CONQUEST_BAR_WIDTH,
  CONQUEST_BAR_HEIGHT,
  CONQUEST_BAR_OFFSET_Y,
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

    return g;
  }

  // Creates the dark background bar for the conquest meter
  createConquestBarBackground() {
    const barX = this.x - CONQUEST_BAR_WIDTH / 2;
    const barY = this.y + CONQUEST_BAR_OFFSET_Y;
    return this.scene.add.rectangle(
      barX + CONQUEST_BAR_WIDTH / 2,
      barY + CONQUEST_BAR_HEIGHT / 2,
      CONQUEST_BAR_WIDTH,
      CONQUEST_BAR_HEIGHT,
      0x333333,
      0.8
    );
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
