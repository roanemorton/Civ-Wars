// Terrain grid — generates multi-continent map with water, plains, hills
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  WATER_THRESHOLD,
  HILLS_THRESHOLD,
  CONTINENTS,
} from '../constants.js';

// Tile type constants
export const WATER = 0;
export const PLAINS = 1;
export const HILLS = 2;

// --- Simplex noise (minimal 2D implementation) ---

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const grad3 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function buildPermTable(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

function simplex2D(perm, x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    const g = grad3[perm[ii + perm[jj]] % 8];
    n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    const g = grad3[perm[ii + i1 + perm[jj + j1]] % 8];
    n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    const g = grad3[perm[ii + 1 + perm[jj + 1]] % 8];
    n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
  }

  return 70 * (n0 + n1 + n2);
}

// --- Terrain Grid ---

export class TerrainGrid {
  constructor() {
    this.tiles = null;
    this.elevation = null;
    this.continentMap = null;  // Int8Array: continent id per tile (-1 = water/none)
    this.cols = GRID_COLS;
    this.rows = GRID_ROWS;
  }

  generateTerrain(seed) {
    seed = seed || Math.floor(Math.random() * 2147483647);
    const perm = buildPermTable(seed);

    this.tiles = new Uint8Array(this.cols * this.rows);
    this.elevation = new Float32Array(this.cols * this.rows);
    this.continentMap = new Int8Array(this.cols * this.rows).fill(-1);

    const freq1 = 0.08;
    const freq2 = 0.18;
    const weight1 = 0.65;
    const weight2 = 0.35;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        // Two octaves of noise
        const n1 = simplex2D(perm, col * freq1, row * freq1);
        const n2 = simplex2D(perm, col * freq2, row * freq2);
        let noise = (n1 * weight1 + n2 * weight2 + 1) / 2; // normalize to 0-1

        // Find the best continent influence for this tile
        let bestInfluence = 0;
        let bestContinent = -1;

        for (let ci = 0; ci < CONTINENTS.length; ci++) {
          const c = CONTINENTS[ci];
          // Elliptical distance (0 at center, 1 at edge)
          const dx = (col - c.cx) / c.rx;
          const dy = (row - c.cy) / c.ry;
          const ellipDist = Math.sqrt(dx * dx + dy * dy);

          if (ellipDist < 1.3) { // Only consider tiles within ~130% of continent radius
            // Smooth falloff: 1 at center, 0 at edge
            const influence = 1 - Math.pow(Math.min(ellipDist, 1), 2.0);
            if (influence > bestInfluence) {
              bestInfluence = influence;
              bestContinent = ci;
            }
          }
        }

        // Combine: continent influence shapes the land, noise adds coastline variation
        const value = bestInfluence * (0.5 + noise * 0.5);

        this.elevation[row * this.cols + col] = value;

        if (value < WATER_THRESHOLD) {
          this.tiles[row * this.cols + col] = WATER;
        } else if (value < HILLS_THRESHOLD) {
          this.tiles[row * this.cols + col] = PLAINS;
          this.continentMap[row * this.cols + col] = bestContinent;
        } else {
          this.tiles[row * this.cols + col] = HILLS;
          this.continentMap[row * this.cols + col] = bestContinent;
        }
      }
    }

    // Per-continent flood fill — keep largest landmass per continent
    this.enforcePerContinent();
  }

  // For each continent, flood-fill to find its largest connected land region,
  // convert disconnected tiles to water
  enforcePerContinent() {
    for (let ci = 0; ci < CONTINENTS.length; ci++) {
      const visited = new Uint8Array(this.cols * this.rows);
      let bestRegion = null;
      let bestSize = 0;

      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          const idx = row * this.cols + col;
          if (visited[idx]) continue;
          if (this.tiles[idx] === WATER) continue;
          if (this.continentMap[idx] !== ci) continue;

          // BFS flood fill within this continent
          const region = [];
          const queue = [[col, row]];
          visited[idx] = 1;

          while (queue.length > 0) {
            const [c, r] = queue.shift();
            region.push(r * this.cols + c);

            for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
              const nc = c + dc;
              const nr = r + dr;
              if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
              const ni = nr * this.cols + nc;
              if (visited[ni]) continue;
              if (this.tiles[ni] === WATER) continue;
              if (this.continentMap[ni] !== ci) continue;
              visited[ni] = 1;
              queue.push([nc, nr]);
            }
          }

          if (region.length > bestSize) {
            bestSize = region.length;
            bestRegion = region;
          }
        }
      }

      // Convert all non-largest tiles for this continent to water
      if (!bestRegion) continue;
      const keepSet = new Set(bestRegion);
      for (let i = 0; i < this.tiles.length; i++) {
        if (this.continentMap[i] === ci && this.tiles[i] !== WATER && !keepSet.has(i)) {
          this.tiles[i] = WATER;
          this.continentMap[i] = -1;
          this.elevation[i] = Math.min(this.elevation[i], WATER_THRESHOLD - 0.05);
        }
      }
    }
  }

  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return WATER;
    return this.tiles[row * this.cols + col];
  }

  getElevation(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    return this.elevation[row * this.cols + col];
  }

  isWalkable(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.tiles[row * this.cols + col] !== WATER;
  }

  // Returns continent id (0, 1, 2) or -1 for water/none
  getContinentAt(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
    return this.continentMap[row * this.cols + col];
  }

  // Returns continent id for world coordinates
  getContinentForWorld(x, y) {
    const { col, row } = this.worldToTile(x, y);
    return this.getContinentAt(col, row);
  }

  worldToTile(x, y) {
    return {
      col: Math.floor(x / TILE_SIZE),
      row: Math.floor(y / TILE_SIZE),
    };
  }

  tileToWorld(col, row) {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,
      y: row * TILE_SIZE + TILE_SIZE / 2,
    };
  }
}
