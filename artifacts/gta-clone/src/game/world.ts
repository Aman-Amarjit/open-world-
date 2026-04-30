// Procedural city map. Tile-based grid with road/sidewalk/building/grass tiles.
import { mulberry32, rand, randInt, pick } from "./utils";

export const TILE = 64; // px per tile
export const MAP_TILES = 80; // 80x80 tiles = 5120x5120 px world

export type TileType =
  | "road"
  | "roadH" // horizontal lane markings
  | "roadV"
  | "intersection"
  | "sidewalk"
  | "building"
  | "grass"
  | "water"
  | "crosswalk"
  | "parking"
  | "plaza"
  | "sand";

export type District =
  | "downtown"
  | "commercial"
  | "residential"
  | "industrial"
  | "park"
  | "waterfront";

export interface Tile {
  type: TileType;
  // building specific
  buildingId?: number;
  // road specific
  roadDir?: "h" | "v" | "x";
  // grass variant
  variant?: number;
  // bridge over water (still a road)
  isBridge?: boolean;
  // district zone for color/style differentiation
  district?: District;
}

export interface Building {
  id: number;
  x: number; // tile coords
  y: number;
  w: number;
  h: number;
  color: string;
  roofColor: string;
  windowColor: string;
  height: number; // for fake-3d shadow length and isometric extrude
  hasNeon: boolean;
  neonColor: string;
  shopId?: number;
}

export type ShopKind =
  | "hospital"
  | "gun_shop"
  | "pay_n_spray"
  | "food"
  | "safehouse"
  | "ammu";

export interface Shop {
  id: number;
  kind: ShopKind;
  name: string;
  buildingId: number;
  // Door tile (sidewalk in front of building) in pixel coords (tile center).
  doorX: number;
  doorY: number;
  // Direction the door faces ("n","e","s","w") — outward from building.
  facing: "n" | "e" | "s" | "w";
  // Sign color used by the door + neon sign.
  color: string;
}

export interface RoadNode {
  x: number;
  y: number;
  neighbors: number[];
  // directional neighbors: index of neighbor in N,E,S,W direction or -1
  dir: { n: number; e: number; s: number; w: number };
  gridCol: number;
  gridRow: number;
}

export interface WorldData {
  tiles: Tile[][];
  buildings: Building[];
  shops: Shop[];
  roadGraph: RoadNode[];
  sidewalkNodes: { x: number; y: number }[];
  roadHorizontals: number[]; // tile y coords of major horizontal roads (top of road band)
  roadVerticals: number[]; // tile x coords of major vertical roads
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
}

export function generateWorld(seed: number): WorldData {
  const rng = mulberry32(seed);
  const W = MAP_TILES;
  const H = MAP_TILES;

  // ---- DISTRICT ZONES ----
  // Divide map into a 4×4 grid of districts (each ~20×20 tiles)
  const DZ = 20;
  const DCOLS = Math.ceil(W / DZ);
  const DROWS = Math.ceil(H / DZ);
  const districtKinds: District[][] = [];
  // Curated layout: bay/waterfront on the south-east, downtown center,
  // residential outskirts, an industrial pocket, park district top-left.
  const layout: District[][] = [
    ["park",        "residential", "commercial", "downtown"],
    ["residential", "downtown",    "downtown",   "commercial"],
    ["residential", "commercial",  "downtown",   "industrial"],
    ["park",        "residential", "industrial", "waterfront"],
  ];
  for (let dr = 0; dr < DROWS; dr++) {
    const row: District[] = [];
    for (let dc = 0; dc < DCOLS; dc++) {
      const r = layout[dr] ?? layout[layout.length - 1]!;
      row.push(r[dc] ?? r[r.length - 1]!);
    }
    districtKinds.push(row);
  }
  const districtAt = (tx: number, ty: number): District => {
    const dc = Math.min(DCOLS - 1, Math.floor(tx / DZ));
    const dr = Math.min(DROWS - 1, Math.floor(ty / DZ));
    return districtKinds[dr]![dc]!;
  };

  // Initialize all to grass tagged with district
  const tiles: Tile[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < W; x++) {
      row.push({
        type: "grass",
        variant: Math.floor(rng() * 4),
        district: districtAt(x, y),
      });
    }
    tiles.push(row);
  }

  // Carve a grid of roads. Major roads every 10 tiles.
  const majorSpacing = 10;
  const roadHorizontals: number[] = [];
  const roadVerticals: number[] = [];

  for (let y = 4; y < H - 2; y += majorSpacing) {
    roadHorizontals.push(y);
    for (let yi = 0; yi < 4; yi++) {
      for (let x = 0; x < W; x++) {
        tiles[y + yi]![x] = { type: "road", roadDir: "h", district: districtAt(x, y + yi) };
      }
    }
  }
  for (let x = 4; x < W - 2; x += majorSpacing) {
    roadVerticals.push(x);
    for (let xi = 0; xi < 4; xi++) {
      for (let y = 0; y < H; y++) {
        const existing = tiles[y]![x + xi]!;
        if (existing.type === "road") {
          tiles[y]![x + xi] = { type: "intersection", roadDir: "x", district: districtAt(x + xi, y) };
        } else {
          tiles[y]![x + xi] = { type: "road", roadDir: "v", district: districtAt(x + xi, y) };
        }
      }
    }
  }

  // ---- RIVER + BRIDGES ----
  // Carve a horizontal river band; vertical roads cross it as bridges.
  const RIVER_Y = 39; // tile row where river starts
  const RIVER_H = 5; // 5-tile-wide water band
  for (let yi = 0; yi < RIVER_H; yi++) {
    const ry = RIVER_Y + yi;
    if (ry < 0 || ry >= H) continue;
    for (let x = 0; x < W; x++) {
      const t = tiles[ry]![x]!;
      // If this tile is part of a vertical road, keep the road as a BRIDGE.
      const onVerticalRoad = roadVerticals.some((vx) => x >= vx && x < vx + 4);
      if (onVerticalRoad) {
        tiles[ry]![x] = {
          type: "road",
          roadDir: "v",
          isBridge: true,
          district: t.district,
        };
      } else {
        tiles[ry]![x] = { type: "water", district: t.district };
      }
    }
  }
  // Sandy beach strip adjacent to water on shores (waterfront / park districts)
  for (let x = 0; x < W; x++) {
    for (const sy of [RIVER_Y - 1, RIVER_Y + RIVER_H]) {
      if (sy < 0 || sy >= H) continue;
      const t = tiles[sy]![x]!;
      if (t.type === "grass") {
        tiles[sy]![x] = { type: "sand", district: t.district };
      }
    }
  }

  // ---- SIDEWALKS ----
  // Sidewalk strip just adjacent to every road tile (skip water shores)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cur = tiles[y]![x]!;
      if (cur.type !== "grass" && cur.type !== "sand") continue;
      const neighbors = [
        tiles[y - 1]?.[x]?.type,
        tiles[y + 1]?.[x]?.type,
        tiles[y]?.[x - 1]?.type,
        tiles[y]?.[x + 1]?.type,
      ];
      if (neighbors.some((n) => n === "road" || n === "intersection")) {
        tiles[y]![x] = { type: "sidewalk", district: cur.district };
      }
    }
  }

  // ---- BUILDINGS (district-aware) ----
  const buildings: Building[] = [];
  const palettes: Record<District, Array<{ wall: string; roof: string; window: string }>> = {
    downtown: [
      { wall: "#3a4658", roof: "#1f2630", window: "#a8e0ff" },
      { wall: "#2a3850", roof: "#101822", window: "#ffd87a" },
      { wall: "#4a5066", roof: "#28304a", window: "#88c4f0" },
      { wall: "#1f2a40", roof: "#0c1220", window: "#ffaa50" },
    ],
    commercial: [
      { wall: "#8a4a4a", roof: "#5a2a2a", window: "#cce8ff" },
      { wall: "#a08a70", roof: "#705a40", window: "#ffe6a0" },
      { wall: "#5a6a7a", roof: "#3a4a5a", window: "#ffd87a" },
      { wall: "#9a7a4a", roof: "#604020", window: "#a8d4ff" },
    ],
    residential: [
      { wall: "#c8a880", roof: "#8a4a3a", window: "#ffe0a8" },
      { wall: "#a89070", roof: "#5a3a2a", window: "#ffd890" },
      { wall: "#b8a890", roof: "#7a4030", window: "#fff0c0" },
      { wall: "#9aa090", roof: "#3a4a3a", window: "#fff0d0" },
      { wall: "#d4b8a0", roof: "#7a3030", window: "#ffe5b0" },
    ],
    industrial: [
      { wall: "#6a6258", roof: "#3a342a", window: "#88a0a0" },
      { wall: "#5a5048", roof: "#2a241a", window: "#a0a098" },
      { wall: "#7a6a5a", roof: "#4a3a2a", window: "#909090" },
    ],
    park: [
      { wall: "#a89070", roof: "#604030", window: "#ffd890" },
    ],
    waterfront: [
      { wall: "#d8c8a8", roof: "#a06848", window: "#a8e0e8" },
      { wall: "#c4b890", roof: "#7a4a2a", window: "#bfe8f0" },
    ],
  };
  const neonColors = ["#ff3a8a", "#3affc8", "#ffe048", "#7a3aff", "#ff7a30", "#40e0ff"];

  // District-specific build params
  const districtParams: Record<
    District,
    { heightMin: number; heightMax: number; neon: number; parkChance: number; subdivide: number; buildChance: number }
  > = {
    downtown:    { heightMin: 30, heightMax: 60, neon: 0.55, parkChance: 0.05, subdivide: 0.25, buildChance: 1 },
    commercial:  { heightMin: 16, heightMax: 32, neon: 0.45, parkChance: 0.10, subdivide: 0.45, buildChance: 1 },
    residential: { heightMin: 8,  heightMax: 18, neon: 0.05, parkChance: 0.15, subdivide: 0.65, buildChance: 1 },
    industrial:  { heightMin: 10, heightMax: 22, neon: 0.10, parkChance: 0.05, subdivide: 0.20, buildChance: 1 },
    park:        { heightMin: 8,  heightMax: 16, neon: 0.05, parkChance: 0.85, subdivide: 0.30, buildChance: 1 },
    waterfront:  { heightMin: 8,  heightMax: 18, neon: 0.20, parkChance: 0.30, subdivide: 0.50, buildChance: 1 },
  };

  let bid = 1;
  const placeBuilding = (
    bx: number,
    by: number,
    bw: number,
    bh: number,
    district: District,
  ) => {
    const pal = pick(palettes[district]);
    const params = districtParams[district];
    const heightR = params.heightMin + Math.floor(rng() * (params.heightMax - params.heightMin));
    const useNeon = rng() < params.neon;
    const b: Building = {
      id: bid++,
      x: bx,
      y: by,
      w: bw,
      h: bh,
      color: pal.wall,
      roofColor: pal.roof,
      windowColor: pal.window,
      height: heightR,
      hasNeon: useNeon,
      neonColor: pick(neonColors),
    };
    buildings.push(b);
    for (let yi = 0; yi < bh; yi++)
      for (let xi = 0; xi < bw; xi++) {
        tiles[by + yi]![bx + xi] = {
          type: "building",
          buildingId: b.id,
          district,
        };
      }
  };

  // Find rectangular grass blocks bounded by sidewalks
  for (let by = 0; by < H - 2; by++) {
    for (let bx = 0; bx < W - 2; bx++) {
      if (tiles[by]![bx]!.type !== "grass") continue;
      let maxW = 0;
      while (bx + maxW < W && tiles[by]![bx + maxW]!.type === "grass" && maxW < 8) maxW++;
      let maxH = 0;
      while (by + maxH < H && tiles[by + maxH]![bx]!.type === "grass" && maxH < 8) {
        let fullRow = true;
        for (let xi = 0; xi < maxW; xi++) {
          if (tiles[by + maxH]![bx + xi]!.type !== "grass") {
            fullRow = false;
            break;
          }
        }
        if (!fullRow) break;
        maxH++;
      }
      if (maxW < 2 || maxH < 2) continue;

      const district = districtAt(bx + Math.floor(maxW / 2), by + Math.floor(maxH / 2));
      const params = districtParams[district];

      // Some blocks become parks (district-tuned chance)
      if (rng() < params.parkChance) {
        for (let yi = 0; yi < maxH; yi++)
          for (let xi = 0; xi < maxW; xi++) {
            tiles[by + yi]![bx + xi] = {
              type: "grass",
              variant: Math.floor(rng() * 4) + 4,
              district,
            };
          }
        // Plaza marker in the center for fountain placement
        if (maxW >= 3 && maxH >= 3) {
          const cx = bx + Math.floor(maxW / 2);
          const cy = by + Math.floor(maxH / 2);
          tiles[cy]![cx] = { type: "plaza", district };
        }
        continue;
      }

      // Subdivide larger blocks into 2 buildings with a 1-tile alley
      if (maxW >= 5 && maxH >= 3 && rng() < params.subdivide && maxW >= maxH) {
        const splitAt = 2 + Math.floor(rng() * (maxW - 4)); // ensure both halves ≥2
        // left building
        placeBuilding(bx, by, splitAt, maxH, district);
        // alley column
        for (let yi = 0; yi < maxH; yi++) {
          tiles[by + yi]![bx + splitAt] = { type: "sidewalk", district };
        }
        // right building (skip the alley column)
        if (maxW - splitAt - 1 >= 2) {
          placeBuilding(bx + splitAt + 1, by, maxW - splitAt - 1, maxH, district);
        }
        continue;
      }
      if (maxH >= 5 && maxW >= 3 && rng() < params.subdivide) {
        const splitAt = 2 + Math.floor(rng() * (maxH - 4));
        placeBuilding(bx, by, maxW, splitAt, district);
        for (let xi = 0; xi < maxW; xi++) {
          tiles[by + splitAt]![bx + xi] = { type: "sidewalk", district };
        }
        if (maxH - splitAt - 1 >= 2) {
          placeBuilding(bx, by + splitAt + 1, maxW, maxH - splitAt - 1, district);
        }
        continue;
      }

      placeBuilding(bx, by, maxW, maxH, district);
    }
  }

  // Crosswalks at intersections
  for (const ry of roadHorizontals) {
    for (const rx of roadVerticals) {
      // crosswalk tile in 4 directions outside intersection
      // We'll just mark special crosswalk type - render handles it
      tiles[ry]?.[rx - 1] && (tiles[ry]![rx - 1]!.type !== "grass") &&
        (tiles[ry]![rx - 1] = { type: "crosswalk" });
      tiles[ry + 3]?.[rx + 4] && (tiles[ry + 3]![rx + 4]!.type !== "grass") &&
        (tiles[ry + 3]![rx + 4] = { type: "crosswalk" });
    }
  }

  // Build a road graph for AI navigation - one node per intersection
  const roadGraph: RoadNode[] = [];
  const cols = roadVerticals.length;
  const rows = roadHorizontals.length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ry = roadHorizontals[r]!;
      const rx = roadVerticals[c]!;
      roadGraph.push({
        x: (rx + 2) * TILE,
        y: (ry + 2) * TILE,
        neighbors: [],
        dir: { n: -1, e: -1, s: -1, w: -1 },
        gridCol: c,
        gridRow: r,
      });
    }
  }
  for (let i = 0; i < roadGraph.length; i++) {
    const node = roadGraph[i]!;
    const col = node.gridCol;
    const row = node.gridRow;
    if (col > 0) {
      const idx = i - 1;
      node.neighbors.push(idx);
      node.dir.w = idx;
    }
    if (col < cols - 1) {
      const idx = i + 1;
      node.neighbors.push(idx);
      node.dir.e = idx;
    }
    if (row > 0) {
      const idx = i - cols;
      node.neighbors.push(idx);
      node.dir.n = idx;
    }
    if (row < rows - 1) {
      const idx = i + cols;
      node.neighbors.push(idx);
      node.dir.s = idx;
    }
  }

  // Sidewalk waypoints — one per sidewalk tile, used for pedestrian wandering
  const sidewalkNodes: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tiles[y]![x]!.type === "sidewalk") {
        sidewalkNodes.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
      }
    }
  }

  // ---- SHOPS (enterable buildings) ----
  // Pick a roster of buildings spread across districts and tag them as shops.
  const shops: Shop[] = [];
  const shopMeta: Record<ShopKind, { name: string; color: string }> = {
    hospital:    { name: "HOSPITAL",     color: "#ff5050" },
    gun_shop:    { name: "AMMU-NATION",  color: "#a8e0ff" },
    pay_n_spray: { name: "PAY 'N' SPRAY", color: "#3affc8" },
    food:        { name: "BURGER SHOT",  color: "#ffd048" },
    safehouse:   { name: "SAFEHOUSE",    color: "#80ff80" },
    ammu:        { name: "GUN STORE",    color: "#ff7a30" },
  };
  // For each shop kind, find a candidate building somewhere reasonable on the map
  // (must have a sidewalk tile next to it, prefer big-enough footprint).
  const shopRoster: { kind: ShopKind; preferred: District[] }[] = [
    { kind: "hospital",    preferred: ["downtown", "commercial"] },
    { kind: "hospital",    preferred: ["residential"] },
    { kind: "pay_n_spray", preferred: ["industrial"] },
    { kind: "pay_n_spray", preferred: ["commercial"] },
    { kind: "gun_shop",    preferred: ["downtown"] },
    { kind: "gun_shop",    preferred: ["industrial"] },
    { kind: "ammu",        preferred: ["industrial", "commercial"] },
    { kind: "food",        preferred: ["commercial"] },
    { kind: "food",        preferred: ["downtown"] },
    { kind: "food",        preferred: ["residential"] },
    { kind: "safehouse",   preferred: ["residential"] },
    { kind: "safehouse",   preferred: ["waterfront"] },
    { kind: "safehouse",   preferred: ["residential"] },
  ];
  const usedBuildings = new Set<number>();
  const shopTiles = new Map<string, number>(); // key "x,y" → shopId
  let shopId = 1;
  for (const slot of shopRoster) {
    // Score buildings by district preference + footprint size, then take best unused.
    let best: { b: Building; door: { x: number; y: number; facing: "n" | "e" | "s" | "w" }; score: number } | null = null;
    for (const b of buildings) {
      if (usedBuildings.has(b.id)) continue;
      if (b.w * b.h < 4) continue;
      // Find a sidewalk tile bordering this building.
      const candidates: Array<{ x: number; y: number; facing: "n" | "e" | "s" | "w" }> = [];
      // North edge
      const ny = b.y - 1;
      if (ny >= 0) {
        const nx = b.x + Math.floor(b.w / 2);
        if (tiles[ny]?.[nx]?.type === "sidewalk") {
          candidates.push({ x: nx, y: ny, facing: "n" });
        }
      }
      // South edge
      const sy = b.y + b.h;
      if (sy < H) {
        const sx = b.x + Math.floor(b.w / 2);
        if (tiles[sy]?.[sx]?.type === "sidewalk") {
          candidates.push({ x: sx, y: sy, facing: "s" });
        }
      }
      // West edge
      const wx = b.x - 1;
      if (wx >= 0) {
        const wy = b.y + Math.floor(b.h / 2);
        if (tiles[wy]?.[wx]?.type === "sidewalk") {
          candidates.push({ x: wx, y: wy, facing: "w" });
        }
      }
      // East edge
      const ex = b.x + b.w;
      if (ex < W) {
        const ey = b.y + Math.floor(b.h / 2);
        if (tiles[ey]?.[ex]?.type === "sidewalk") {
          candidates.push({ x: ex, y: ey, facing: "e" });
        }
      }
      if (candidates.length === 0) continue;
      const door = candidates[Math.floor(rng() * candidates.length)]!;
      // Avoid placing two shops on the same sidewalk tile.
      const key = `${door.x},${door.y}`;
      if (shopTiles.has(key)) continue;
      // Score: footprint + district preference + a tiny bit of randomness.
      const dist = tiles[b.y]?.[b.x]?.district;
      const distBonus = dist && slot.preferred.includes(dist) ? 100 : 0;
      const score = b.w * b.h + distBonus + rng() * 5;
      if (!best || score > best.score) {
        best = { b, door, score };
      }
    }
    if (!best) continue;
    const meta = shopMeta[slot.kind];
    const shop: Shop = {
      id: shopId++,
      kind: slot.kind,
      name: meta.name,
      buildingId: best.b.id,
      doorX: best.door.x * TILE + TILE / 2,
      doorY: best.door.y * TILE + TILE / 2,
      facing: best.door.facing,
      color: meta.color,
    };
    shops.push(shop);
    best.b.shopId = shop.id;
    usedBuildings.add(best.b.id);
    shopTiles.set(`${best.door.x},${best.door.y}`, shop.id);
  }

  return {
    tiles,
    buildings,
    shops,
    roadGraph,
    sidewalkNodes,
    roadHorizontals,
    roadVerticals,
    width: W,
    height: H,
    pixelWidth: W * TILE,
    pixelHeight: H * TILE,
  };
}

export function tileAt(world: WorldData, px: number, py: number): Tile | null {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return null;
  return world.tiles[ty]![tx]!;
}

export function isSolidAt(world: WorldData, px: number, py: number): boolean {
  const t = tileAt(world, px, py);
  if (!t) return true;
  return t.type === "building" || t.type === "water";
}

export function findNearestRoad(
  world: WorldData,
  px: number,
  py: number,
): { x: number; y: number } {
  // Try the player's tile and outward rings
  for (let r = 0; r < 8; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = px + dx * TILE;
        const ny = py + dy * TILE;
        const t = tileAt(world, nx, ny);
        if (
          t &&
          (t.type === "road" ||
            t.type === "intersection" ||
            t.type === "crosswalk")
        ) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return { x: px, y: py };
}
