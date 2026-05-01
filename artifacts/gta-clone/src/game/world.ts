// Procedural city map. Tile-based grid with road/sidewalk/building/grass tiles.
import { mulberry32, rand, randInt, pick } from "./utils";

export const TILE = 64; // px per tile
export const MAP_TILES = 160; // 160x160 tiles = 10240x10240 px world

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
  | "waterfront"
  | "forest"
  | "port";

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
  | "ammu"
  | "gym";

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
  // 8×8 blocks of 20×20 tiles — redesigned for a believable GTA-style city.
  //
  //  col →  0          1          2          3          4          5          6          7
  // row 0: forest    | forest    | forest    | forest    | forest    | forest    | forest   | forest
  // row 1: forest    | park      | park      | residential| forest  | forest    | forest   | forest
  // row 2: forest    | residential|commercial| commercial | residential|forest   | forest   | forest
  // row 3: industrial| residential|commercial| downtown   | downtown  |commercial| forest   | forest
  // row 4: industrial| residential|commercial| downtown   | downtown  |waterfront|waterfront| forest
  // row 5: industrial| industrial |residential| commercial | waterfront|waterfront|waterfront|waterfront
  // row 6: port      | industrial | industrial| residential| commercial|waterfront|waterfront|waterfront
  // row 7: port      | port       | industrial| industrial | waterfront|waterfront|waterfront|waterfront
  //
  // Results in: large downtown core (center), residential ring around it,
  // industrial/port on the west/south-west, large harbor bay on east/south-east,
  // nature reserves in the north.
  const DZ = 20;
  const DCOLS = Math.ceil(W / DZ); // 8
  const DROWS = Math.ceil(H / DZ); // 8
  const layout: District[][] = [
    ["forest",      "forest",      "forest",      "forest",      "forest",      "forest",      "forest",      "forest"],
    ["forest",      "park",        "park",        "residential", "forest",      "forest",      "forest",      "forest"],
    ["forest",      "residential", "commercial",  "commercial",  "residential", "forest",      "forest",      "forest"],
    ["industrial",  "residential", "commercial",  "downtown",    "downtown",    "commercial",  "forest",      "forest"],
    ["industrial",  "residential", "commercial",  "downtown",    "downtown",    "waterfront",  "waterfront",  "forest"],
    ["industrial",  "industrial",  "residential", "commercial",  "waterfront",  "waterfront",  "waterfront",  "waterfront"],
    ["industrial",  "industrial",  "industrial",  "residential", "commercial",  "waterfront",  "waterfront",  "waterfront"],
    ["industrial",  "industrial",  "industrial",  "industrial",  "waterfront",  "waterfront",  "waterfront",  "waterfront"],
  ];
  const districtKinds: District[][] = [];
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

  // Initialize all to grass
  const tiles: Tile[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < W; x++) {
      row.push({ type: "grass", variant: Math.floor(rng() * 4), district: districtAt(x, y) });
    }
    tiles.push(row);
  }

  // ---- ROAD GRID ----
  // Roads every 10 tiles starting at 4 — keep this fixed (AI + story depend on it).
  const roadHorizontals: number[] = [];
  const roadVerticals: number[] = [];
  for (let y = 4; y < H - 2; y += 10) {
    roadHorizontals.push(y);
    for (let yi = 0; yi < 4; yi++)
      for (let x = 0; x < W; x++)
        tiles[y + yi]![x] = { type: "road", roadDir: "h", district: districtAt(x, y + yi) };
  }
  for (let x = 4; x < W - 2; x += 10) {
    roadVerticals.push(x);
    for (let xi = 0; xi < 4; xi++)
      for (let y = 0; y < H; y++) {
        const existing = tiles[y]![x + xi]!;
        tiles[y]![x + xi] = existing.type === "road"
          ? { type: "intersection", roadDir: "x", district: districtAt(x + xi, y) }
          : { type: "road", roadDir: "v", district: districtAt(x + xi, y) };
      }
  }

  // ---- NORTH FOREST RIVER ----
  // A natural river snaking through the northern forest only (y = 0..85).
  // Narrower and cleaner than before (5 tiles wide, stronger curvature).
  const RIVER_CX_BASE = 18; // horizontal center of river at y=0
  for (let y = 0; y < H; y++) {
    // River gradually curves east then turns south and fades; only visible in north.
    const fade = Math.max(0, 1 - y / 80); // disappears below y=80
    if (fade <= 0) break;
    const cx = RIVER_CX_BASE + Math.sin(y * 0.09) * 9 + Math.cos(y * 0.04) * 5;
    const halfW = 2; // 5-tile-wide river
    for (let dx = -halfW; dx <= halfW; dx++) {
      const rx = Math.round(cx + dx);
      if (rx < 1 || rx >= W - 1) continue;
      const onHRoad = roadHorizontals.some(hy => y >= hy && y < hy + 4);
      const onVRoad = roadVerticals.some(vx => rx >= vx && rx < vx + 4);
      if (onVRoad) continue; // never overwrite vertical roads
      tiles[y]![rx] = onHRoad
        ? { type: "road", roadDir: "h", isBridge: true, district: tiles[y]![rx]!.district }
        : { type: "water", district: tiles[y]![rx]!.district };
    }
  }

  // ---- HARBOR BAY ----
  // Carve a large L-shaped harbor in the east/south-east quadrant.
  // The bay's interior is determined by a simple signed-distance shape.
  // Shape: water fills the region east of x≈100 AND south of y≈85,
  //        with a curved inlet that reaches northwest up to about x=80, y=110.
  const inHarbor = (tx: number, ty: number): boolean => {
    // Main open-sea block in the far east (right edge)
    if (tx >= 115 && ty >= 60) return true;
    // Northern inlet arm (a narrow channel cutting west from open sea)
    if (tx >= 95 && ty >= 60 && ty <= 90) return true;
    // Southern bay body
    if (tx >= 85 && ty >= 85) return true;
    // Curved inlet: a concave bay pushed into the city
    const inletDist = Math.hypot(tx - 80, ty - 100);
    if (inletDist < 18 && tx > 70 && ty > 80) return true;
    // Beach peninsula exclusion: strip of land at around x=90-100, y=100-120
    if (tx >= 88 && tx <= 98 && ty >= 98 && ty <= 118) return false;
    return false;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inHarbor(x, y)) continue;
      const onHRoad = roadHorizontals.some(hy => y >= hy && y < hy + 4);
      const onVRoad = roadVerticals.some(vx => x >= vx && x < vx + 4);
      if (onHRoad || onVRoad) continue; // roads stay as bridges implicitly
      tiles[y]![x] = { type: "water", district: districtAt(x, y) };
    }
  }

  // Mark roads crossing water as bridges
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tiles[y]![x]!;
      if (t.type !== "road" && t.type !== "intersection") continue;
      // Check neighbors for water
      const hasWaterNeighbor =
        tiles[y - 1]?.[x]?.type === "water" || tiles[y + 1]?.[x]?.type === "water" ||
        tiles[y]?.[x - 1]?.type === "water" || tiles[y]?.[x + 1]?.type === "water";
      if (hasWaterNeighbor) {
        tiles[y]![x] = { ...t, isBridge: true };
      }
    }
  }

  // ---- SANDY BEACH STRIP ----
  // One tile of sand between grass/sidewalk and any water body.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (tiles[y]![x]!.type !== "grass") continue;
      const neighbours = [
        tiles[y-1]![x]!.type, tiles[y+1]![x]!.type,
        tiles[y]![x-1]!.type, tiles[y]![x+1]!.type,
      ];
      if (neighbours.some(t => t === "water")) {
        tiles[y]![x] = { type: "sand", district: tiles[y]![x]!.district };
      }
    }
  }

  // ---- SIDEWALKS ----
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cur = tiles[y]![x]!;
      if (cur.type !== "grass" && cur.type !== "sand") continue;
      const nbrs = [
        tiles[y-1]?.[x]?.type, tiles[y+1]?.[x]?.type,
        tiles[y]?.[x-1]?.type, tiles[y]?.[x+1]?.type,
      ];
      if (nbrs.some(n => n === "road" || n === "intersection")) {
        tiles[y]![x] = { type: "sidewalk", district: cur.district };
      }
    }
  }

  // ---- PARKING LOTS ----
  // Replace some grass blocks in commercial / industrial districts with parking.
  // Parking blocks must be at least 2×3 to read clearly.
  for (let by = 2; by < H - 2; by++) {
    for (let bx = 2; bx < W - 2; bx++) {
      if (tiles[by]![bx]!.type !== "grass") continue;
      const d = districtAt(bx, by);
      if (d !== "commercial" && d !== "industrial" && d !== "port") continue;
      if (rng() > 0.18) continue; // ~18% of eligible grass becomes parking
      // Measure block
      let pw = 0, ph = 0;
      while (bx + pw < W && tiles[by]![bx + pw]!.type === "grass" && pw < 6) pw++;
      while (by + ph < H && tiles[by + ph]![bx]!.type === "grass" && ph < 4) ph++;
      if (pw < 2 || ph < 2) continue;
      // Only create parking if the whole measured block is grass
      let allGrass = true;
      for (let yi = 0; yi < ph && allGrass; yi++)
        for (let xi = 0; xi < pw && allGrass; xi++)
          if (tiles[by + yi]![bx + xi]!.type !== "grass") allGrass = false;
      if (!allGrass) continue;
      for (let yi = 0; yi < ph; yi++)
        for (let xi = 0; xi < pw; xi++)
          tiles[by + yi]![bx + xi] = { type: "parking", district: d };
    }
  }

  // ---- BUILDINGS ----
  const buildings: Building[] = [];
  const palettes: Record<District, Array<{ wall: string; roof: string; window: string }>> = {
    downtown: [
      { wall: "#2e3d52", roof: "#161e2a", window: "#a8e0ff" },
      { wall: "#243450", roof: "#0d1828", window: "#ffd87a" },
      { wall: "#3a4a64", roof: "#1e2840", window: "#88c4f0" },
      { wall: "#1c2840", roof: "#080e1c", window: "#ffaa50" },
      { wall: "#304060", roof: "#182030", window: "#60d0ff" },
      { wall: "#223858", roof: "#101c2c", window: "#ffe080" },
    ],
    commercial: [
      { wall: "#7a3a3a", roof: "#4a1e1e", window: "#cce8ff" },
      { wall: "#9a7a50", roof: "#604020", window: "#ffe6a0" },
      { wall: "#4e5e6e", roof: "#2e3e4e", window: "#ffd87a" },
      { wall: "#8a6a3a", roof: "#50300a", window: "#a8d4ff" },
      { wall: "#6e4a4a", roof: "#3a1a1a", window: "#d8f0ff" },
    ],
    residential: [
      { wall: "#c4a070", roof: "#7a3828", window: "#ffe0a8" },
      { wall: "#a88060", roof: "#4a2a18", window: "#ffd890" },
      { wall: "#b0a080", roof: "#682e20", window: "#fff0c0" },
      { wall: "#90988a", roof: "#303e30", window: "#fff0d0" },
      { wall: "#d0b090", roof: "#6a2828", window: "#ffe5b0" },
      { wall: "#b8987a", roof: "#5a3020", window: "#ffd8a0" },
      { wall: "#c8b098", roof: "#8a4830", window: "#fff2c0" },
    ],
    industrial: [
      { wall: "#5a5248", roof: "#2e2820", window: "#88a0a0" },
      { wall: "#484038", roof: "#20180e", window: "#a0a098" },
      { wall: "#686058", roof: "#382e20", window: "#909090" },
      { wall: "#404840", roof: "#181e18", window: "#808890" },
    ],
    park: [
      { wall: "#a08860", roof: "#504020", window: "#ffd890" },
      { wall: "#908070", roof: "#403028", window: "#e8e0b0" },
    ],
    waterfront: [
      { wall: "#d0c0a0", roof: "#906040", window: "#a8e0e8" },
      { wall: "#c0b080", roof: "#703c18", window: "#bfe8f0" },
      { wall: "#b8a898", roof: "#604838", window: "#c8f0e8" },
    ],
    forest: [
      { wall: "#504030", roof: "#281808", window: "#a8d4ff" },
      { wall: "#403828", roof: "#200e00", window: "#ffd87a" },
    ],
    port: [
      { wall: "#4a4e52", roof: "#1e2226", window: "#7a90a8" },
      { wall: "#3d4246", roof: "#161a1e", window: "#88a0b0" },
    ],
  };
  const getPalette = (d: District) => palettes[d] ?? palettes.industrial;

  const neonColors = ["#ff3a8a", "#3affc8", "#ffe048", "#7a3aff", "#ff7a30", "#40e0ff", "#ff5520", "#00ffaa"];

  type BuildParams = { heightMin: number; heightMax: number; neon: number; parkChance: number; subdivide: number; buildChance: number; fillChance: number };
  const districtParams: Record<District, BuildParams> = {
    downtown:    { heightMin: 35, heightMax: 70, neon: 0.6,  parkChance: 0.04, subdivide: 0.20, buildChance: 1,    fillChance: 0.98 },
    commercial:  { heightMin: 14, heightMax: 30, neon: 0.50, parkChance: 0.10, subdivide: 0.50, buildChance: 1,    fillChance: 0.90 },
    residential: { heightMin: 7,  heightMax: 16, neon: 0.04, parkChance: 0.18, subdivide: 0.70, buildChance: 1,    fillChance: 0.85 },
    industrial:  { heightMin: 10, heightMax: 24, neon: 0.08, parkChance: 0.04, subdivide: 0.20, buildChance: 1,    fillChance: 0.80 },
    park:        { heightMin: 6,  heightMax: 12, neon: 0.04, parkChance: 0.90, subdivide: 0.25, buildChance: 0.4,  fillChance: 0.40 },
    waterfront:  { heightMin: 8,  heightMax: 20, neon: 0.22, parkChance: 0.28, subdivide: 0.55, buildChance: 0.7,  fillChance: 0.70 },
    forest:      { heightMin: 5,  heightMax: 10, neon: 0.00, parkChance: 0.96, subdivide: 0.05, buildChance: 0.06, fillChance: 0.06 },
    port:        { heightMin: 12, heightMax: 25, neon: 0.10, parkChance: 0.02, subdivide: 0.15, buildChance: 0.9,  fillChance: 0.85 },
  };

  let bid = 1;
  const placeBuilding = (bx: number, by: number, bw: number, bh: number, district: District) => {
    const pal = pick(getPalette(district));
    const params = districtParams[district];
    const h = params.heightMin + Math.floor(rng() * (params.heightMax - params.heightMin));
    const useNeon = rng() < params.neon;
    const b: Building = {
      id: bid++, x: bx, y: by, w: bw, h: bh,
      color: pal.wall, roofColor: pal.roof, windowColor: pal.window,
      height: h, hasNeon: useNeon, neonColor: pick(neonColors),
    };
    buildings.push(b);
    for (let yi = 0; yi < bh; yi++)
      for (let xi = 0; xi < bw; xi++)
        tiles[by + yi]![bx + xi] = { type: "building", buildingId: b.id, district };
  };

  // Scan grass blocks and place buildings
  for (let by = 0; by < H - 2; by++) {
    for (let bx = 0; bx < W - 2; bx++) {
      if (tiles[by]![bx]!.type !== "grass") continue;
      // Measure available rectangle
      let maxW = 0;
      while (bx + maxW < W && tiles[by]![bx + maxW]!.type === "grass" && maxW < 8) maxW++;
      let maxH = 0;
      outer: while (by + maxH < H && maxH < 8) {
        for (let xi = 0; xi < maxW; xi++) {
          if (tiles[by + maxH]![bx + xi]!.type !== "grass") break outer;
        }
        maxH++;
      }
      if (maxW < 2 || maxH < 2) continue;

      const midDistrict = districtAt(bx + Math.floor(maxW / 2), by + Math.floor(maxH / 2));
      const params = districtParams[midDistrict] ?? districtParams.forest;

      // Skip if this block should remain open (park/forest chance)
      if (rng() > params.fillChance) {
        // Make it a nice park / open area
        if (rng() < params.parkChance) {
          for (let yi = 0; yi < maxH; yi++)
            for (let xi = 0; xi < maxW; xi++)
              tiles[by + yi]![bx + xi] = { type: "grass", variant: 4 + Math.floor(rng() * 4), district: midDistrict };
          // Plaza marker for fountain
          if (maxW >= 3 && maxH >= 3) {
            const cx = bx + Math.floor(maxW / 2);
            const cy = by + Math.floor(maxH / 2);
            tiles[cy]![cx] = { type: "plaza", district: midDistrict };
          }
        }
        continue;
      }

      // Park blocks stay open
      if (rng() < params.parkChance) {
        for (let yi = 0; yi < maxH; yi++)
          for (let xi = 0; xi < maxW; xi++)
            tiles[by + yi]![bx + xi] = { type: "grass", variant: 4 + Math.floor(rng() * 4), district: midDistrict };
        if (maxW >= 3 && maxH >= 3) {
          tiles[by + Math.floor(maxH/2)]![bx + Math.floor(maxW/2)] = { type: "plaza", district: midDistrict };
        }
        continue;
      }

      // Subdivide wider blocks with an alley between two buildings
      if (maxW >= 5 && maxH >= 3 && rng() < params.subdivide && maxW >= maxH) {
        const splitAt = 2 + Math.floor(rng() * (maxW - 4));
        placeBuilding(bx, by, splitAt, maxH, midDistrict);
        for (let yi = 0; yi < maxH; yi++)
          tiles[by + yi]![bx + splitAt] = { type: "sidewalk", district: midDistrict };
        if (maxW - splitAt - 1 >= 2)
          placeBuilding(bx + splitAt + 1, by, maxW - splitAt - 1, maxH, midDistrict);
        continue;
      }
      if (maxH >= 5 && maxW >= 3 && rng() < params.subdivide) {
        const splitAt = 2 + Math.floor(rng() * (maxH - 4));
        placeBuilding(bx, by, maxW, splitAt, midDistrict);
        for (let xi = 0; xi < maxW; xi++)
          tiles[by + splitAt]![bx + xi] = { type: "sidewalk", district: midDistrict };
        if (maxH - splitAt - 1 >= 2)
          placeBuilding(bx, by + splitAt + 1, maxW, maxH - splitAt - 1, midDistrict);
        continue;
      }

      placeBuilding(bx, by, maxW, maxH, midDistrict);
    }
  }

  // ---- CENTRAL PARK LANDMARK ----
  // Explicitly carve out a central park in the downtown area (tiles ~60-72, ~55-67).
  // This overrides any buildings in that exact block to green space.
  {
    const pkX = 63, pkY = 54, pkW = 7, pkH = 7;
    for (let yi = 0; yi < pkH; yi++) {
      for (let xi = 0; xi < pkW; xi++) {
        const tx = pkX + xi, ty = pkY + yi;
        if (tiles[ty]![tx]!.type === "road" || tiles[ty]![tx]!.type === "intersection" || tiles[ty]![tx]!.type === "sidewalk") continue;
        tiles[ty]![tx] = { type: "grass", variant: 4 + Math.floor(rng() * 4), district: "park" };
      }
    }
    // Fountain in the center
    tiles[pkY + 3]![pkX + 3] = { type: "plaza", district: "park" };
    // Remove any building that overlapped
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i]!;
      if (b.x >= pkX && b.x < pkX + pkW && b.y >= pkY && b.y < pkY + pkH) {
        buildings.splice(i, 1);
      }
    }
  }

  // ---- ZEBRA CROSSINGS ----
  for (const ry of roadHorizontals) {
    for (const rx of roadVerticals) {
      const paint = (tx: number, ty: number, dir: "h" | "v") => {
        const t = tiles[ty]?.[tx];
        if (!t) return;
        if (t.type !== "road" && t.type !== "intersection") return;
        if (t.isBridge) return;
        tiles[ty]![tx] = { type: "crosswalk", roadDir: dir, district: t.district };
      };
      for (let i = 0; i < 4; i++) paint(rx + i, ry - 1, "v");  // north approach
      for (let i = 0; i < 4; i++) paint(rx + i, ry + 4, "v");  // south approach
      for (let i = 0; i < 4; i++) paint(rx - 1, ry + i, "h");  // west approach
      for (let i = 0; i < 4; i++) paint(rx + 4, ry + i, "h");  // east approach
    }
  }

  // ---- ROAD GRAPH ----
  const roadGraph: RoadNode[] = [];
  const cols = roadVerticals.length;
  const rows = roadHorizontals.length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      roadGraph.push({
        x: (roadVerticals[c]! + 2) * TILE,
        y: (roadHorizontals[r]! + 2) * TILE,
        neighbors: [],
        dir: { n: -1, e: -1, s: -1, w: -1 },
        gridCol: c,
        gridRow: r,
      });
    }
  }
  for (let i = 0; i < roadGraph.length; i++) {
    const node = roadGraph[i]!;
    const col = node.gridCol, row = node.gridRow;
    if (col > 0)        { node.neighbors.push(i - 1);    node.dir.w = i - 1; }
    if (col < cols - 1) { node.neighbors.push(i + 1);    node.dir.e = i + 1; }
    if (row > 0)        { node.neighbors.push(i - cols); node.dir.n = i - cols; }
    if (row < rows - 1) { node.neighbors.push(i + cols); node.dir.s = i + cols; }
  }

  // ---- SIDEWALK WAYPOINTS ----
  const sidewalkNodes: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (tiles[y]![x]!.type === "sidewalk")
        sidewalkNodes.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });

  // ---- SHOPS ----
  const shops: Shop[] = [];
  const shopMeta: Record<ShopKind, { name: string; color: string }> = {
    hospital:  { name: "HOSPITAL",     color: "#ff5050" },
    gun_shop:  { name: "AMMU-NATION",  color: "#a8e0ff" },
    pay_n_spray:{ name: "PAY 'N' SPRAY",color: "#3affc8" },
    food:      { name: "BURGER SHOT",  color: "#ffd048" },
    safehouse: { name: "SAFEHOUSE",    color: "#80ff80" },
    ammu:      { name: "GUN STORE",    color: "#ff7a30" },
    gym:       { name: "IRON WILL GYM",color: "#ff6030" },
  };
  const shopRoster: { kind: ShopKind; preferred: District[] }[] = [
    { kind: "hospital",   preferred: ["downtown", "commercial"] },
    { kind: "hospital",   preferred: ["residential"] },
    { kind: "pay_n_spray",preferred: ["industrial"] },
    { kind: "pay_n_spray",preferred: ["commercial"] },
    { kind: "gun_shop",   preferred: ["downtown"] },
    { kind: "gun_shop",   preferred: ["industrial"] },
    { kind: "ammu",       preferred: ["industrial", "commercial"] },
    { kind: "food",       preferred: ["commercial"] },
    { kind: "food",       preferred: ["downtown"] },
    { kind: "food",       preferred: ["residential"] },
    { kind: "safehouse",  preferred: ["residential"] },
    { kind: "safehouse",  preferred: ["waterfront"] },
    { kind: "safehouse",  preferred: ["residential"] },
    { kind: "gym",        preferred: ["commercial", "residential"] },
    { kind: "gym",        preferred: ["downtown", "industrial"] },
  ];
  const usedBuildings = new Set<number>();
  const shopTiles = new Map<string, number>();
  let shopId = 1;
  for (const slot of shopRoster) {
    let best: { b: Building; door: { x: number; y: number; facing: "n"|"e"|"s"|"w" }; score: number } | null = null;
    for (const b of buildings) {
      if (usedBuildings.has(b.id)) continue;
      if (b.w * b.h < 4) continue;
      const candidates: Array<{ x: number; y: number; facing: "n"|"e"|"s"|"w" }> = [];
      const checkDoor = (tx: number, ty: number, f: "n"|"e"|"s"|"w") => {
        if (ty < 0 || ty >= H || tx < 0 || tx >= W) return;
        if (tiles[ty]?.[tx]?.type === "sidewalk") candidates.push({ x: tx, y: ty, facing: f });
      };
      checkDoor(b.x + Math.floor(b.w / 2), b.y - 1, "n");
      checkDoor(b.x + Math.floor(b.w / 2), b.y + b.h, "s");
      checkDoor(b.x - 1, b.y + Math.floor(b.h / 2), "w");
      checkDoor(b.x + b.w, b.y + Math.floor(b.h / 2), "e");
      if (candidates.length === 0) continue;
      const door = candidates[Math.floor(rng() * candidates.length)]!;
      const key = `${door.x},${door.y}`;
      if (shopTiles.has(key)) continue;
      const dist = tiles[b.y]?.[b.x]?.district;
      const distBonus = dist && slot.preferred.includes(dist) ? 100 : 0;
      const score = b.w * b.h + distBonus + rng() * 5;
      if (!best || score > best.score) best = { b, door, score };
    }
    if (!best) continue;
    const meta = shopMeta[slot.kind];
    const shop: Shop = {
      id: shopId++, kind: slot.kind, name: meta.name,
      buildingId: best.b.id,
      doorX: best.door.x * TILE + TILE / 2,
      doorY: best.door.y * TILE + TILE / 2,
      facing: best.door.facing, color: meta.color,
    };
    shops.push(shop);
    best.b.shopId = shop.id;
    usedBuildings.add(best.b.id);
    shopTiles.set(`${best.door.x},${best.door.y}`, shop.id);
  }

  return {
    tiles, buildings, shops, roadGraph, sidewalkNodes,
    roadHorizontals, roadVerticals,
    width: W, height: H,
    pixelWidth: W * TILE, pixelHeight: H * TILE,
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
  for (let r = 0; r < 10; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = px + dx * TILE;
        const ny = py + dy * TILE;
        const t = tileAt(world, nx, ny);
        if (t && (t.type === "road" || t.type === "intersection" || t.type === "crosswalk"))
          return { x: nx, y: ny };
      }
    }
  }
  return { x: px, y: py };
}
