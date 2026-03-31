// Central game state — single source of truth for all game data
export const state = {
  civs: [],
  cities: [],
  geysers: [],
  player: null,
  gameTime: 0,
  isRunning: false,
  isPaused: false,
  isDragging: false,
};
