// Represents a movable unit that can attack, claim, and defend
import { state } from '../state.js';
import {
  UNIT_HP,
  UNIT_SPEED,
  UNIT_COST,
  UNIT_SPRITE_RADIUS,
  UNIT_DAMAGE_PER_SECOND,
  ATTACK_RANGE,
  DEPTH_UNIT,
} from '../constants.js';

let nextUnitId = 0;

export class Unit {
  // Creates a unit at the given position, owned by the given civ
  constructor(scene, x, y, ownerCiv) {
    this.id = nextUnitId++;
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.owner = ownerCiv;
    this.currentHP = UNIT_HP;
    this.unitState = 'idle';
    this.targetX = null;
    this.targetY = null;
    this.attackTarget = null;
    this.claimTarget = null;
    this.attackTimer = 0;
    this.isAlive = true;

    this.container = this.createVisuals();

    ownerCiv.sporebucks -= UNIT_COST;
    this.register();
  }

  // Creates the unit's visual elements grouped in a container
  createVisuals() {
    // Outline circle (darker)
    const outline = this.scene.add.circle(0, 0, UNIT_SPRITE_RADIUS, this.darkenColor(this.owner.color));

    // Body circle (civ color)
    const body = this.scene.add.circle(0, 0, UNIT_SPRITE_RADIUS - 2, this.owner.color);

    // Selection ring (hidden by default)
    this.selectionRing = this.scene.add.circle(0, 0, UNIT_SPRITE_RADIUS + 4);
    this.selectionRing.setStrokeStyle(2, 0xffffff, 1);
    this.selectionRing.setFillStyle(0x000000, 0);
    this.selectionRing.setVisible(false);

    const container = this.scene.add.container(this.x, this.y, [
      this.selectionRing,
      outline,
      body,
    ]);
    container.setDepth(DEPTH_UNIT);

    return container;
  }

  // Cancels any current action and cleans up associated state
  cancelCurrentAction() {
    if (this.claimTarget) {
      this.claimTarget.resetHP();
      this.claimTarget = null;
    }
    this.attackTarget = null;
    this.attackTimer = 0;
  }

  // Sets the unit's movement target, cancelling any current action
  moveTo(x, y) {
    this.cancelCurrentAction();
    this.targetX = x;
    this.targetY = y;
    this.unitState = 'moving';
  }

  // Orders this unit to attack a target entity (Unit or City)
  attackEntity(target) {
    this.cancelCurrentAction();
    this.attackTarget = target;
    this.unitState = 'moving';
  }

  // Orders this unit to claim a geyser
  claimGeyser(geyser) {
    this.cancelCurrentAction();
    this.claimTarget = geyser;
    this.unitState = 'moving';
  }

  // Returns the distance from this unit to a point
  distanceTo(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Advances the unit's state each frame — handles movement, combat, and claiming
  update(delta) {
    if (!this.isAlive) return;

    if (this.unitState === 'moving') {
      this.updateMoving(delta);
    } else if (this.unitState === 'attacking') {
      this.updateAttacking(delta);
    } else if (this.unitState === 'claiming') {
      this.updateClaiming(delta);
    }
  }

  // Handles movement toward a target or destination
  updateMoving(delta) {
    let destX, destY;

    if (this.attackTarget) {
      // Check if attack target is still alive or now friendly
      if (this.attackTarget.isAlive === false || this.attackTarget.owner === this.owner) {
        this.attackTarget = null;
        this.unitState = 'idle';
        return;
      }
      destX = this.attackTarget.x;
      destY = this.attackTarget.y;

      // Check if within attack range
      if (this.distanceTo(destX, destY) <= ATTACK_RANGE) {
        this.unitState = 'attacking';
        this.attackTimer = 0;
        return;
      }
    } else if (this.claimTarget) {
      destX = this.claimTarget.x;
      destY = this.claimTarget.y;

      // Check if within range of geyser
      if (this.distanceTo(destX, destY) <= ATTACK_RANGE) {
        this.unitState = 'claiming';
        this.attackTimer = 0;
        return;
      }
    } else {
      destX = this.targetX;
      destY = this.targetY;
    }

    if (destX === null || destY === null) {
      this.unitState = 'idle';
      return;
    }

    // Move toward destination
    const dx = destX - this.x;
    const dy = destY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = UNIT_SPEED * (delta / 1000);

    if (dist <= moveAmount) {
      this.x = destX;
      this.y = destY;
      // Only go idle if plain movement (no attack/claim target)
      if (!this.attackTarget && !this.claimTarget) {
        this.targetX = null;
        this.targetY = null;
        this.unitState = 'idle';
      }
    } else {
      const ratio = moveAmount / dist;
      this.x += dx * ratio;
      this.y += dy * ratio;
    }

    this.container.setPosition(this.x, this.y);
  }

  // Handles attacking an enemy unit or city
  updateAttacking(delta) {
    // Check if target is dead
    if (this.attackTarget.isAlive === false) {
      this.attackTarget = null;
      this.unitState = 'idle';
      return;
    }

    // Stop attacking if target is now owned by the same civ (e.g. city was captured)
    if (this.attackTarget.owner === this.owner) {
      this.attackTarget = null;
      this.unitState = 'idle';
      return;
    }

    // If target moved out of range, chase it
    if (this.distanceTo(this.attackTarget.x, this.attackTarget.y) > ATTACK_RANGE) {
      this.unitState = 'moving';
      return;
    }

    // Accumulate attack timer and deal damage per second
    this.attackTimer += delta;
    while (this.attackTimer >= 1000) {
      this.attackTimer -= 1000;

      // Deal damage to target
      if (this.attackTarget instanceof Unit) {
        this.attackTarget.takeDamage(UNIT_DAMAGE_PER_SECOND);
        // Target deals damage back
        if (this.attackTarget.isAlive) {
          this.takeDamage(UNIT_DAMAGE_PER_SECOND);
        }
      } else {
        // Attacking a city
        this.attackTarget.takeDamage(UNIT_DAMAGE_PER_SECOND, this.owner);
      }
    }
  }

  // Handles claiming a geyser
  updateClaiming(delta) {
    // Accumulate timer and deal damage to geyser per second
    this.attackTimer += delta;
    while (this.attackTimer >= 1000) {
      this.attackTimer -= 1000;

      const claimed = this.claimTarget.takeDamage(UNIT_DAMAGE_PER_SECOND);
      if (claimed) {
        this.claimTarget.claim(this.owner);
        this.claimTarget = null;
        this.unitState = 'idle';
        return;
      }
    }
  }

  // Reduces HP and marks as dead if HP reaches 0
  takeDamage(amount) {
    this.currentHP -= amount;
    if (this.currentHP <= 0) {
      this.currentHP = 0;
      this.isAlive = false;
    }
  }

  // Shows the selection highlight ring
  select() {
    this.selectionRing.setVisible(true);
  }

  // Hides the selection highlight ring
  deselect() {
    this.selectionRing.setVisible(false);
  }

  // Darkens a hex color by reducing each channel
  darkenColor(color) {
    const r = Math.max(0, ((color >> 16) & 0xff) - 40);
    const g = Math.max(0, ((color >> 8) & 0xff) - 40);
    const b = Math.max(0, (color & 0xff) - 40);
    return (r << 16) | (g << 8) | b;
  }

  // Registers this unit in the owner's unit list
  register() {
    this.owner.units.push(this);
  }

  // Removes this unit from the owner's unit list
  deregister() {
    this.owner.units = this.owner.units.filter((u) => u !== this);
    if (state.selectedUnit === this) {
      state.selectedUnit = null;
    }
  }

  // Cleans up all visuals and deregisters from state
  destroy() {
    this.isAlive = false;
    if (this.owner === state.player) {
      state.unitsLost++;
    }
    this.container.destroy();
    this.deregister();
  }
}
