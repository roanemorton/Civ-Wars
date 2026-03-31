// Debug overlay — toggled with backtick key, displays game state info
import { state } from '../state.js';
import { CITY_HP, GEYSER_HP, UNIT_HP } from '../constants.js';

const DEBUG_FONT_SIZE = 14;
const DEBUG_PADDING = 10;
const DEBUG_BG_ALPHA = 0.7;

let debugText = null;
let debugBg = null;
let debugVisible = false;

// Creates the debug text overlay and registers the backtick toggle key
export function createDebugOverlay(scene) {
  debugBg = scene.add.rectangle(
    DEBUG_PADDING,
    DEBUG_PADDING,
    1,
    1,
    0x000000,
    DEBUG_BG_ALPHA
  );
  debugBg.setOrigin(0, 0);
  debugBg.setVisible(false);
  debugBg.setScrollFactor(0);

  debugText = scene.add.text(
    DEBUG_PADDING + 6,
    DEBUG_PADDING + 4,
    '',
    {
      fontSize: `${DEBUG_FONT_SIZE}px`,
      fontFamily: 'monospace',
      color: '#00ff00',
      lineSpacing: 4,
    }
  );
  debugText.setVisible(false);
  debugText.setScrollFactor(0);

  scene.input.keyboard.on('keydown-BACKTICK', () => {
    debugVisible = !debugVisible;
    debugText.setVisible(debugVisible);
    debugBg.setVisible(debugVisible);
  });
}

// Reads from state and updates the debug text each frame
export function updateDebugOverlay() {
  if (!debugVisible || !debugText) return;

  const lines = [];

  lines.push(`Game Time: ${state.gameTime.toFixed(1)}s`);
  lines.push('');

  // Civ info
  for (const civ of state.civs) {
    const label = civ === state.player ? 'PLAYER' : `AI ${civ.id}`;
    lines.push(`[Civ ${civ.id}] ${label} | Sporebucks: ${Math.floor(civ.sporebucks)} | Units: ${civ.units.length}`);
  }
  lines.push('');

  // City info
  for (const city of state.cities) {
    const conquestPct = ((CITY_HP - city.currentHP) / CITY_HP * 100).toFixed(1);
    const regenStatus = city.regenActive ? 'REGEN' : 'NO_REGEN';
    lines.push(
      `[City ${city.id}] Owner: Civ ${city.owner.id} | HP: ${city.currentHP}/${CITY_HP} | Conquest: ${conquestPct}% | ${regenStatus}`
    );
  }

  lines.push('');

  // Unit info
  for (const civ of state.civs) {
    for (const unit of civ.units) {
      lines.push(
        `[Unit ${unit.id}] Owner: Civ ${unit.owner.id} | HP: ${unit.currentHP}/${UNIT_HP} | ${unit.unitState} | Pos: (${Math.round(unit.x)}, ${Math.round(unit.y)})`
      );
    }
  }
  lines.push('');

  // Geyser info
  for (const geyser of state.geysers) {
    const ownerLabel = geyser.owner ? `Civ ${geyser.owner.id}` : 'none';
    lines.push(
      `[Geyser ${geyser.id}] Owner: ${ownerLabel} | HP: ${geyser.currentHP}/${GEYSER_HP} | ${geyser.claimState}`
    );
  }

  debugText.setText(lines.join('\n'));

  // Resize background to fit text
  debugBg.width = debugText.width + 12;
  debugBg.height = debugText.height + 8;
}
