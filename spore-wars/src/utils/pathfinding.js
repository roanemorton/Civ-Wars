// A* pathfinding on the terrain tile grid with line-of-sight smoothing

const SQRT2 = Math.sqrt(2);

// 8-directional neighbors: [dcol, drow, cost]
const DIRS = [
  [0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1],           // cardinal
  [-1, -1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [1, 1, SQRT2], // diagonal
];

// Octile distance heuristic
function heuristic(c1, r1, c2, r2) {
  const dx = Math.abs(c1 - c2);
  const dy = Math.abs(r1 - r2);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

// Builds a set of obstacle tile keys from cities and geysers
export function buildObstacles(terrain, cities, geysers, tileSize, spriteRadii) {
  const obstacles = new Set();
  const entities = [
    ...cities.map(c => ({ x: c.x, y: c.y, r: spriteRadii.city })),
    ...geysers.map(g => ({ x: g.x, y: g.y, r: spriteRadii.geyser })),
  ];
  for (const e of entities) {
    const center = terrain.worldToTile(e.x, e.y);
    const tileRadius = Math.ceil(e.r / tileSize);
    for (let dr = -tileRadius; dr <= tileRadius; dr++) {
      for (let dc = -tileRadius; dc <= tileRadius; dc++) {
        const c = center.col + dc;
        const r = center.row + dr;
        if (c >= 0 && c < terrain.cols && r >= 0 && r < terrain.rows) {
          obstacles.add(r * terrain.cols + c);
        }
      }
    }
  }
  return obstacles;
}

// Finds an A* path from world coords to world coords
// obstacles is an optional Set of tile keys to treat as impassable
export function findPath(terrain, startX, startY, endX, endY, obstacles) {
  let start = terrain.worldToTile(startX, startY);
  let end = terrain.worldToTile(endX, endY);

  // Snap start/end to nearest walkable tile if they're in water
  start = snapToWalkable(terrain, start.col, start.row);
  end = snapToWalkable(terrain, end.col, end.row);
  if (!start || !end) return null;

  // Same tile — just go directly
  if (start.col === end.col && start.row === end.row) {
    return [{ x: endX, y: endY }];
  }

  const cols = terrain.cols;
  const key = (c, r) => r * cols + c;

  const openSet = new MinHeap();
  const gScore = new Map();
  const cameFrom = new Map();

  const startKey = key(start.col, start.row);
  gScore.set(startKey, 0);
  openSet.push(startKey, heuristic(start.col, start.row, end.col, end.row));

  while (openSet.size > 0) {
    const currentKey = openSet.pop();
    const cr = Math.floor(currentKey / cols);
    const cc = currentKey % cols;

    if (cc === end.col && cr === end.row) {
      // Reconstruct path
      const tilePath = reconstructPath(cameFrom, currentKey, cols);
      // Convert to world coords
      const worldPath = tilePath.map(k => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        return terrain.tileToWorld(c, r);
      });
      // Replace last waypoint with exact destination
      worldPath[worldPath.length - 1] = { x: endX, y: endY };
      // Smooth the path
      return smoothPath(terrain, startX, startY, worldPath);
    }

    const currentG = gScore.get(currentKey);

    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;

      if (!terrain.isWalkable(nc, nr)) continue;

      // Skip obstacle tiles (cities/geysers) unless it's the destination
      const nKey = key(nc, nr);
      if (obstacles && obstacles.has(nKey) && !(nc === end.col && nr === end.row)) continue;

      // No corner-cutting: for diagonals, both adjacent cardinal tiles must be walkable
      if (dc !== 0 && dr !== 0) {
        if (!terrain.isWalkable(cc + dc, cr) || !terrain.isWalkable(cc, cr + dr)) continue;
      }

      const tentativeG = currentG + cost;

      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        gScore.set(nKey, tentativeG);
        cameFrom.set(nKey, currentKey);
        const f = tentativeG + heuristic(nc, nr, end.col, end.row);
        openSet.push(nKey, f);
      }
    }
  }

  return null; // No path found
}

// Returns approximate path distance (in tiles) between two world points, or Infinity if unreachable
export function pathDistance(terrain, startX, startY, endX, endY, obstacles) {
  const path = findPath(terrain, startX, startY, endX, endY, obstacles);
  if (!path) return Infinity;
  let dist = 0;
  let px = startX, py = startY;
  for (const wp of path) {
    const dx = wp.x - px;
    const dy = wp.y - py;
    dist += Math.sqrt(dx * dx + dy * dy);
    px = wp.x;
    py = wp.y;
  }
  return dist;
}

function reconstructPath(cameFrom, endKey, cols) {
  const path = [endKey];
  let current = endKey;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.push(current);
  }
  path.reverse();
  // Remove the start tile (unit is already there)
  path.shift();
  return path;
}

// Snap to nearest walkable tile via BFS spiral search
function snapToWalkable(terrain, col, row) {
  if (terrain.isWalkable(col, row)) return { col, row };

  const visited = new Set();
  const queue = [[col, row]];
  visited.add(row * terrain.cols + col);

  while (queue.length > 0) {
    const [c, r] = queue.shift();
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nc = c + dc;
      const nr = r + dr;
      const k = nr * terrain.cols + nc;
      if (nc < 0 || nc >= terrain.cols || nr < 0 || nr >= terrain.rows) continue;
      if (visited.has(k)) continue;
      visited.add(k);
      if (terrain.isWalkable(nc, nr)) return { col: nc, row: nr };
      queue.push([nc, nr]);
    }
  }
  return null;
}

// Line-of-sight path smoothing — removes unnecessary waypoints
function smoothPath(terrain, startX, startY, worldPath) {
  if (worldPath.length <= 1) return worldPath;

  const result = [];
  let currentX = startX;
  let currentY = startY;
  let i = 0;

  while (i < worldPath.length) {
    // Look ahead: find the farthest waypoint we can reach in a straight line
    let farthest = i;
    for (let j = i + 1; j < worldPath.length; j++) {
      if (hasLineOfSight(terrain, currentX, currentY, worldPath[j].x, worldPath[j].y)) {
        farthest = j;
      }
    }
    result.push(worldPath[farthest]);
    currentX = worldPath[farthest].x;
    currentY = worldPath[farthest].y;
    i = farthest + 1;
  }

  return result;
}

// Checks if a straight line between two world points crosses only walkable tiles
// Uses Bresenham-style tile traversal
function hasLineOfSight(terrain, x1, y1, x2, y2) {
  const s = terrain.worldToTile(x1, y1);
  const e = terrain.worldToTile(x2, y2);

  let col = s.col;
  let row = s.row;
  const endCol = e.col;
  const endRow = e.row;

  const dcol = Math.abs(endCol - col);
  const drow = Math.abs(endRow - row);
  const stepCol = col < endCol ? 1 : -1;
  const stepRow = row < endRow ? 1 : -1;

  let err = dcol - drow;

  while (true) {
    if (!terrain.isWalkable(col, row)) return false;
    if (col === endCol && row === endRow) break;

    const e2 = 2 * err;
    if (e2 > -drow) {
      err -= drow;
      col += stepCol;
    }
    if (e2 < dcol) {
      err += dcol;
      row += stepRow;
    }
  }

  return true;
}

// Minimal binary heap for A* open set
class MinHeap {
  constructor() {
    this.data = [];
    this.size = 0;
  }

  push(key, priority) {
    this.data.push({ key, priority });
    this.size++;
    this._bubbleUp(this.size - 1);
  }

  pop() {
    const top = this.data[0].key;
    this.size--;
    if (this.size > 0) {
      this.data[0] = this.data.pop();
      this._sinkDown(0);
    } else {
      this.data.pop();
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].priority >= this.data[parent].priority) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  _sinkDown(i) {
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < this.size && this.data[left].priority < this.data[smallest].priority) smallest = left;
      if (right < this.size && this.data[right].priority < this.data[smallest].priority) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}
