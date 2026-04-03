// Central game state — single source of truth for all game data

const DEFAULTS = {
  civs: [],
  cities: [],
  geysers: [],
  player: null,
  gameTime: 0,
  isRunning: false,
  isPaused: false,
  isDragging: false,
  selectedUnit: null,
  gameSpeed: 1,
  uiClicked: false,
  unitsLost: 0,
  terrain: null,
};

export const state = { ...DEFAULTS };

// Resets all state fields to their initial values
export function resetState() {
  Object.assign(state, {
    civs: [],
    cities: [],
    geysers: [],
    player: null,
    gameTime: 0,
    isRunning: false,
    isPaused: false,
    isDragging: false,
    selectedUnit: null,
    gameSpeed: 1,
    uiClicked: false,
    unitsLost: 0,
    terrain: null,
  });
}
