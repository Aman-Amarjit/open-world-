// Rendering: world tiles, buildings, weather, lighting overlays
import type { GameState, Particle, Animal, Prop, BirdFlock } from "./types";
import type { WorldData, Building } from "./world";
import { TILE } from "./world";
import { shadeHex } from "./utils";
import { drawCar, drawCarShadow, drawHuman, drawHumanShadow } from "./sprites";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  world: WorldData;
  state: GameState;
  viewW: number;
  viewH: number;
}

function timeFilter(time: GameState["timeOfDay"], hex: string): string {
  if (time === "day") return hex;
  if (time === "dusk") return shadeHex(hex, -25);
  return shadeHex(hex, -55);
}

export function renderWorld(rc: RenderContext) {
  const { ctx, world, state } = rc;
  const cam = state.camera;

  // Apply camera shake (rounded to whole pixels to avoid sub-pixel jitter)
  const shakeX = cam.shake > 0.3 ? Math.round((Math.random() - 0.5) * cam.shake) : 0;
  const shakeY = cam.shake > 0.3 ? Math.round((Math.random() - 0.5) * cam.shake) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(rc.viewW / 2 - cam.x * cam.zoom + shakeX, rc.viewH / 2 - cam.y * cam.zoom + shakeY);
  ctx.scale(cam.zoom, cam.zoom);

  // Visible tile range
  const minX = Math.max(0, Math.floor((cam.x - rc.viewW / 2 / cam.zoom) / TILE) - 1);
  const minY = Math.max(0, Math.floor((cam.y - rc.viewH / 2 / cam.zoom) / TILE) - 1);
  const maxX = Math.min(
    world.width - 1,
    Math.ceil((cam.x + rc.viewW / 2 / cam.zoom) / TILE) + 1,
  );
  const maxY = Math.min(
    world.height - 1,
    Math.ceil((cam.y + rc.viewH / 2 / cam.zoom) / TILE) + 1,
  );

  // Draw tiles
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = world.tiles[y]![x]!;
      const px = x * TILE;
      const py = y * TILE;
      // Per-tile deterministic hash → stable RNG without flicker. Cheap
      // bit-mixed function (no allocation), then we just `% N` it for picks.
      const seed = (x * 73856093) ^ (y * 19349663);
      const h1 = (seed * 2654435761) >>> 0;
      const h2 = ((seed ^ 0xa5a5a5a5) * 1597334677) >>> 0;
      const h3 = ((seed + 0x9e3779b9) * 0x85ebca6b) >>> 0;
      switch (t.type) {
        case "grass": {
          // ── Clean GTA-style lawn: solid green base with fine speckle for
          //    texture. No fake-grunge blobs that look ugly at zoom. ──
          const lush = t.variant! >= 4;
          const base = timeFilter(state.timeOfDay, lush ? "#5a8a3a" : "#4a7a3f");
          ctx.fillStyle = base;
          ctx.fillRect(px, py, TILE, TILE);
          // Slightly darker speckle for grass-blade texture
          ctx.fillStyle = shadeHex(base, -8);
          for (let i = 0; i < 8; i++) {
            const sx = px + ((h1 >> (i * 2)) % TILE);
            const sy = py + ((h2 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          // Lighter speckle (highlight)
          ctx.fillStyle = shadeHex(base, 10);
          for (let i = 0; i < 5; i++) {
            const sx = px + ((h2 >> (i * 2)) % TILE);
            const sy = py + ((h3 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          break;
        }
        case "sidewalk": {
          // ── GTA-style 4-up concrete slabs: tan base, per-slab tone shifts,
          //    crisp dark grout joints. NO weathering blobs or oil stains. ──
          const baseSw = timeFilter(state.timeOfDay, "#beb09a");
          // Per-slab tone variation (subtle, ±4)
          for (let qy = 0; qy < 2; qy++) {
            for (let qx = 0; qx < 2; qx++) {
              const qHash = (h1 >> (qx * 4 + qy * 8)) & 0xff;
              const tone = ((qHash % 9) - 4); // -4..+4
              ctx.fillStyle = shadeHex(baseSw, tone);
              ctx.fillRect(px + qx * (TILE / 2), py + qy * (TILE / 2), TILE / 2, TILE / 2);
            }
          }
          // Crisp dark grout joints between slabs (the "GTA tile lines")
          ctx.fillStyle = timeFilter(state.timeOfDay, "#6e6354");
          ctx.fillRect(px, py + TILE / 2 - 0.5, TILE, 1);
          ctx.fillRect(px + TILE / 2 - 0.5, py, 1, TILE);
          // Tiny aggregate speckle for concrete texture (subtle, no blobs)
          ctx.fillStyle = shadeHex(baseSw, -12);
          for (let i = 0; i < 5; i++) {
            const sx = px + ((h1 >> (i * 2)) % TILE);
            const sy = py + ((h2 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          ctx.fillStyle = shadeHex(baseSw, 8);
          for (let i = 0; i < 4; i++) {
            const sx = px + ((h2 >> (i * 2)) % TILE);
            const sy = py + ((h3 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          // Per-tile street furniture (deterministic by hash so it's stable).
          const swFurniture = h3 & 0x3f;
          if (swFurniture === 0) {
            // Manhole cover (cast iron disk with cross pattern)
            const mcx = px + TILE / 2;
            const mcy = py + TILE / 2;
            ctx.fillStyle = timeFilter(state.timeOfDay, "#3a342c");
            ctx.beginPath();
            ctx.arc(mcx, mcy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = timeFilter(state.timeOfDay, "#1a1714");
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.arc(mcx, mcy, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = timeFilter(state.timeOfDay, "#2a241c");
            ctx.fillRect(mcx - 4, mcy - 0.4, 8, 0.8);
            ctx.fillRect(mcx - 0.4, mcy - 4, 0.8, 8);
          } else if (swFurniture === 1) {
            // Fire hydrant (small red post near the curb edge)
            const hx = px + 4 + (h1 % 4);
            const hy = py + 4 + (h2 % 4);
            ctx.fillStyle = timeFilter(state.timeOfDay, "#b53028");
            ctx.fillRect(hx - 1.5, hy - 2, 3, 5);
            ctx.fillStyle = timeFilter(state.timeOfDay, "#e84838");
            ctx.fillRect(hx - 1.2, hy - 1.7, 0.6, 4.5);
            ctx.fillStyle = timeFilter(state.timeOfDay, "#3a1a14");
            ctx.fillRect(hx - 2, hy + 3, 4, 0.6);
          } else if (swFurniture === 2) {
            // Accent slab — a darker stone block (decorative)
            ctx.fillStyle = shadeHex(baseSw, -22);
            ctx.fillRect(px + TILE / 2 - 6, py + TILE / 2 - 6, 12, 12);
            ctx.strokeStyle = timeFilter(state.timeOfDay, "#5e5446");
            ctx.lineWidth = 0.7;
            ctx.strokeRect(px + TILE / 2 - 6, py + TILE / 2 - 6, 12, 12);
          } else if (swFurniture === 3) {
            // Trash bin (small dark rectangle with rim)
            const tbx = px + TILE - 8;
            const tby = py + TILE - 10;
            ctx.fillStyle = timeFilter(state.timeOfDay, "#2a2a2a");
            ctx.fillRect(tbx, tby, 6, 8);
            ctx.fillStyle = timeFilter(state.timeOfDay, "#4a4a4a");
            ctx.fillRect(tbx, tby, 6, 1.2);
            ctx.fillStyle = timeFilter(state.timeOfDay, "#1a1a1a");
            ctx.fillRect(tbx + 2, tby + 2, 2, 1);
          }
          break;
        }
        case "road":
        case "intersection": {
          // ── GTA-style asphalt: clean medium gray with slight blue tint,
          //    minimal grain, NO blob-stains or patches. White lane lines. ──
          const asphalt = timeFilter(state.timeOfDay, "#4a4d52");
          ctx.fillStyle = asphalt;
          ctx.fillRect(px, py, TILE, TILE);
          // Light aggregate speckle (subtle, evenly distributed)
          ctx.fillStyle = timeFilter(state.timeOfDay, "#5c5f63");
          for (let i = 0; i < 6; i++) {
            const sx = px + ((h1 >> (i * 2)) % TILE);
            const sy = py + ((h2 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          // Darker speckle (variation)
          ctx.fillStyle = timeFilter(state.timeOfDay, "#3a3d42");
          for (let i = 0; i < 5; i++) {
            const sx = px + ((h2 >> (i * 2)) % TILE);
            const sy = py + ((h3 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          // Occasional manhole cover (cast iron disk) — adds road furniture
          if (((x * 13 + y * 23) % 47) === 0 && t.type === "road") {
            const mcx = px + TILE / 2;
            const mcy = py + TILE / 2;
            ctx.fillStyle = timeFilter(state.timeOfDay, "#26221d");
            ctx.beginPath();
            ctx.arc(mcx, mcy, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = timeFilter(state.timeOfDay, "#0e0c0a");
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(mcx, mcy, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = timeFilter(state.timeOfDay, "#1a1614");
            ctx.fillRect(mcx - 5, mcy - 0.5, 10, 1);
            ctx.fillRect(mcx - 0.5, mcy - 5, 1, 10);
          }
          // Stop line — solid white bar painted just before a crosswalk
          // approach. We check if the next tile in our travel direction is a
          // crosswalk; if so, draw the bar at the far edge of this tile.
          if (t.type === "road") {
            const stopColor =
              state.timeOfDay === "night"
                ? "#e8e8e0"
                : state.timeOfDay === "dusk"
                  ? "#ece9dc"
                  : "#f0eee4";
            if (t.roadDir === "h") {
              const eastTile = world.tiles[y]?.[x + 1];
              const westTile = world.tiles[y]?.[x - 1];
              if (eastTile?.type === "crosswalk") {
                ctx.fillStyle = stopColor;
                ctx.fillRect(px + TILE - 4, py + TILE / 2 + 1, 2.5, TILE / 2 - 4);
              } else if (westTile?.type === "crosswalk") {
                ctx.fillStyle = stopColor;
                ctx.fillRect(px + 1.5, py + 4, 2.5, TILE / 2 - 4);
              }
            } else if (t.roadDir === "v") {
              const southTile = world.tiles[y + 1]?.[x];
              const northTile = world.tiles[y - 1]?.[x];
              if (southTile?.type === "crosswalk") {
                ctx.fillStyle = stopColor;
                ctx.fillRect(px + 4, py + TILE - 4, TILE / 2 - 4, 2.5);
              } else if (northTile?.type === "crosswalk") {
                ctx.fillStyle = stopColor;
                ctx.fillRect(px + TILE / 2 + 1, py + 1.5, TILE / 2 - 4, 2.5);
              }
            }
          }
          // Tire skid (very rare — no oil stains, patches, cracks)
          if (((x * 17 + y * 11) % 89) === 0 && t.type === "road") {
            ctx.strokeStyle = timeFilter(state.timeOfDay, "rgba(20,20,20,0.55)");
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (t.roadDir === "h") {
              ctx.moveTo(px + 6, py + TILE * 0.4);
              ctx.lineTo(px + TILE - 6, py + TILE * 0.45);
              ctx.moveTo(px + 6, py + TILE * 0.55);
              ctx.lineTo(px + TILE - 6, py + TILE * 0.6);
            } else {
              ctx.moveTo(px + TILE * 0.4, py + 6);
              ctx.lineTo(px + TILE * 0.45, py + TILE - 6);
              ctx.moveTo(px + TILE * 0.55, py + 6);
              ctx.lineTo(px + TILE * 0.6, py + TILE - 6);
            }
            ctx.stroke();
          }
          // Lane markings — pure white dashes. Skip the time-of-day filter
          // because real road paint is reflective and reads as bright white
          // at night under headlights; without this they go beige and look
          // like old yellow paint.
          const laneColor =
            state.timeOfDay === "night"
              ? "#e8e8e0"
              : state.timeOfDay === "dusk"
                ? "#ece9dc"
                : "#f0eee4";
          if (t.type === "road" && t.roadDir === "h") {
            ctx.strokeStyle = laneColor;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([12, 8]);
            const rowInBlock = y % 10;
            if (rowInBlock === 5 || rowInBlock === 1) {
              ctx.beginPath();
              ctx.moveTo(px, py + TILE / 2);
              ctx.lineTo(px + TILE, py + TILE / 2);
              ctx.stroke();
            }
            ctx.setLineDash([]);
          } else if (t.type === "road" && t.roadDir === "v") {
            ctx.strokeStyle = laneColor;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([12, 8]);
            const colInBlock = x % 10;
            if (colInBlock === 5 || colInBlock === 1) {
              ctx.beginPath();
              ctx.moveTo(px + TILE / 2, py);
              ctx.lineTo(px + TILE / 2, py + TILE);
              ctx.stroke();
            }
            ctx.setLineDash([]);
          }
          break;
        }
        case "crosswalk": {
          // ── Clean white zebra stripes on asphalt base. No mottle, no
          //    fake wear shading — looks crisp at all zoom levels. ──
          ctx.fillStyle = timeFilter(state.timeOfDay, "#4a4d52");
          ctx.fillRect(px, py, TILE, TILE);
          // Stripes use the un-darkened paint color (reflective at night)
          ctx.fillStyle =
            state.timeOfDay === "night"
              ? "#e8e8e0"
              : state.timeOfDay === "dusk"
                ? "#ece9dc"
                : "#f0eee4";
          if (t.roadDir === "v") {
            // Horizontal stripes (cars going N/S)
            for (let i = 0; i < 6; i++) {
              ctx.fillRect(px + 4, py + 4 + i * 10, TILE - 8, 6);
            }
          } else {
            // Vertical stripes (cars going E/W)
            for (let i = 0; i < 6; i++) {
              ctx.fillRect(px + 4 + i * 10, py + 4, 6, TILE - 8);
            }
          }
          break;
        }
        case "building": {
          // skip - we draw buildings separately for proper extrusion
          ctx.fillStyle = timeFilter(state.timeOfDay, "#3a3a3a");
          ctx.fillRect(px, py, TILE, TILE);
          break;
        }
        case "water": {
          // ── Deeper-water look with two layers of waves and subtle caustics ──
          const tt = performance.now() / 1000;
          const base = timeFilter(state.timeOfDay, "#1f3d6a");
          const deep = timeFilter(state.timeOfDay, "#163058");
          // Vertical depth gradient (top slightly lighter from sky reflection)
          const wg = ctx.createLinearGradient(px, py, px, py + TILE);
          wg.addColorStop(0, shadeHex(base, 8));
          wg.addColorStop(1, deep);
          ctx.fillStyle = wg;
          ctx.fillRect(px, py, TILE, TILE);
          // Long lazy wave lines (back layer, lower opacity)
          ctx.strokeStyle = timeFilter(state.timeOfDay, "rgba(150,200,240,0.10)");
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let i = 0; i < 2; i++) {
            const offY = py + 16 + i * 28 + Math.sin(tt * 0.6 + (x + y) * 0.3 + i) * 2.5;
            ctx.moveTo(px, offY);
            ctx.bezierCurveTo(px + 16, offY - 3, px + 32, offY + 3, px + 48, offY - 1);
            ctx.lineTo(px + TILE, offY);
          }
          ctx.stroke();
          // Bright crisp ripples (front layer)
          ctx.strokeStyle = timeFilter(state.timeOfDay, "rgba(200,225,250,0.22)");
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const offY = py + 12 + i * 18 + Math.sin(tt + (x + y) * 0.4 + i) * 2;
            ctx.moveTo(px, offY);
            ctx.bezierCurveTo(px + 16, offY - 2, px + 32, offY + 2, px + 48, offY - 1);
            ctx.lineTo(px + TILE, offY);
          }
          ctx.stroke();
          // Sparkles (sun glints — animated drift)
          ctx.fillStyle = timeFilter(state.timeOfDay, "rgba(220,240,255,0.45)");
          for (let i = 0; i < 3; i++) {
            const sx = px + ((x * 23 + i * 17 + Math.floor(tt * 8)) % TILE);
            const sy = py + ((y * 19 + i * 11 + Math.floor(tt * 3)) % TILE);
            ctx.fillRect(sx, sy, 1.5, 1.5);
          }
          break;
        }
        case "sand": {
          // ── Beach sand: gradient base + ripple lines + mixed pebbles + shells ──
          const sandBase = timeFilter(state.timeOfDay, "#e8d49a");
          // Subtle gradient (varied across map for non-flat look)
          const sg = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
          sg.addColorStop(0, shadeHex(sandBase, 4));
          sg.addColorStop(1, shadeHex(sandBase, -6));
          ctx.fillStyle = sg;
          ctx.fillRect(px, py, TILE, TILE);
          // Ripple lines (gentle waves of darker sand)
          ctx.strokeStyle = timeFilter(state.timeOfDay, "rgba(170,140,90,0.25)");
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let i = 0; i < 2; i++) {
            const ry = py + 16 + i * 26 + ((h1 >> (i * 3)) & 0x7);
            ctx.moveTo(px, ry);
            ctx.quadraticCurveTo(px + TILE / 2, ry + 3, px + TILE, ry);
          }
          ctx.stroke();
          // Granular dots (many small)
          ctx.fillStyle = timeFilter(state.timeOfDay, "#c8a868");
          for (let i = 0; i < 7; i++) {
            const sx = px + ((h1 >> (i * 2)) % TILE);
            const sy = py + ((h2 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          // Lighter highlights
          ctx.fillStyle = timeFilter(state.timeOfDay, "#f0e0b0");
          for (let i = 0; i < 4; i++) {
            const sx = px + ((h2 >> (i * 2)) % TILE);
            const sy = py + ((h3 >> (i * 3)) % TILE);
            ctx.fillRect(sx, sy, 1, 1);
          }
          // Occasional shell or pebble
          if ((h3 & 0x1f) === 0) {
            ctx.fillStyle = timeFilter(state.timeOfDay, "#fff5e0");
            ctx.beginPath();
            ctx.ellipse(
              px + (h1 % (TILE - 6)) + 3,
              py + (h2 % (TILE - 6)) + 3,
              2.5,
              1.5,
              (h3 % 4) * 0.5,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.strokeStyle = timeFilter(state.timeOfDay, "rgba(140,110,80,0.6)");
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
          break;
        }
        case "plaza": {
          // ── GTA-style cut-stone plaza: 4 tone-varied quadrants with crisp
          //    dark grout joints. No transparent overlays, no fake highlights. ──
          const baseSt = timeFilter(state.timeOfDay, "#c8bfac");
          for (let qy = 0; qy < 2; qy++) {
            for (let qx = 0; qx < 2; qx++) {
              const qHash = (h1 >> (qx * 4 + qy * 8)) & 0xff;
              const tone = ((qHash % 11) - 5); // -5..+5
              ctx.fillStyle = shadeHex(baseSt, tone);
              ctx.fillRect(px + qx * (TILE / 2), py + qy * (TILE / 2), TILE / 2, TILE / 2);
              // Faint per-slab grain
              ctx.fillStyle = shadeHex(baseSt, tone - 14);
              for (let i = 0; i < 3; i++) {
                const ssx = px + qx * (TILE / 2) + ((qHash >> i) % (TILE / 2));
                const ssy = py + qy * (TILE / 2) + ((qHash >> (i + 2)) % (TILE / 2));
                ctx.fillRect(ssx, ssy, 1, 1);
              }
            }
          }
          // Crisp grout joints (dark line at slab boundaries)
          ctx.fillStyle = timeFilter(state.timeOfDay, "#6e6555");
          ctx.fillRect(px, py + TILE / 2 - 0.5, TILE, 1);
          ctx.fillRect(px + TILE / 2 - 0.5, py, 1, TILE);
          // Outer slab edge (one solid tile boundary)
          ctx.strokeStyle = timeFilter(state.timeOfDay, "#988e7a");
          ctx.lineWidth = 0.8;
          ctx.strokeRect(px + 0.4, py + 0.4, TILE - 0.8, TILE - 0.8);
          break;
        }
      }
      // BRIDGE RAILINGS — draw stone curbs on tiles flagged isBridge
      // along the long axis of the bridge (sides perpendicular to traffic).
      if (t.isBridge) {
        const above = world.tiles[y - 1]?.[x];
        const below = world.tiles[y + 1]?.[x];
        const left = world.tiles[y]?.[x - 1];
        const right = world.tiles[y]?.[x + 1];
        ctx.fillStyle = timeFilter(state.timeOfDay, "#aaa090");
        // For a vertical bridge, water is on left/right of the bridge column.
        if (left && left.type === "water") {
          ctx.fillRect(px, py, 3, TILE);
        }
        if (right && right.type === "water") {
          ctx.fillRect(px + TILE - 3, py, 3, TILE);
        }
        // For a horizontal bridge, water above/below.
        if (above && above.type === "water") {
          ctx.fillRect(px, py, TILE, 3);
        }
        if (below && below.type === "water") {
          ctx.fillRect(px, py + TILE - 3, TILE, 3);
        }
      }
    }
  }

  // Skid marks (drawn on road)
  ctx.fillStyle = "rgba(20,20,20,0.55)";
  for (const sk of state.skidMarks) {
    if (sk.x < cam.x - rc.viewW || sk.x > cam.x + rc.viewW) continue;
    if (sk.y < cam.y - rc.viewH || sk.y > cam.y + rc.viewH) continue;
    ctx.save();
    ctx.translate(sk.x, sk.y);
    ctx.rotate(sk.angle);
    ctx.globalAlpha = sk.alpha;
    ctx.fillRect(-2, -1, 4, 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Decals - blood, scorch
  for (const d of state.decals) {
    if (d.x < cam.x - rc.viewW || d.x > cam.x + rc.viewW) continue;
    if (d.y < cam.y - rc.viewH || d.y > cam.y + rc.viewH) continue;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);
    ctx.globalAlpha = d.alpha;
    if (d.kind === "blood") {
      ctx.fillStyle = "#7a0a10";
    } else if (d.kind === "scorch") {
      ctx.fillStyle = "#1a1a1a";
    } else {
      ctx.fillStyle = "#0a0a0a";
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, d.size, d.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // splatter dots
    if (d.kind === "blood") {
      for (let i = 0; i < 4; i++) {
        const ax = (Math.random() - 0.5) * d.size * 3;
        const ay = (Math.random() - 0.5) * d.size * 3;
        ctx.beginPath();
        ctx.arc(ax, ay, Math.random() * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Pickups - bobbing
  for (const p of state.pickups) {
    if (p.x < cam.x - rc.viewW || p.x > cam.x + rc.viewW) continue;
    if (p.y < cam.y - rc.viewH || p.y > cam.y + rc.viewH) continue;
    ctx.save();
    const bobY = Math.sin(p.bob) * 1.5;
    ctx.translate(p.x, p.y + bobY);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 4 - bobY, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // halo
    const haloColor =
      p.kind === "health"
        ? "#30c870"
        : p.kind === "ammo"
          ? "#3a90e8"
          : p.kind === "armor"
            ? "#a0a8b8"
            : p.kind === "wantedClear"
              ? "#e8d030"
              : "#e8503a";
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
    grd.addColorStop(0, haloColor + "cc");
    grd.addColorStop(1, haloColor + "00");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    // icon body
    ctx.fillStyle = haloColor;
    if (p.kind === "health") {
      ctx.fillRect(-3, -1, 6, 2);
      ctx.fillRect(-1, -3, 2, 6);
    } else if (p.kind === "ammo") {
      ctx.fillRect(-2, -3, 4, 6);
      ctx.fillStyle = "#ffd040";
      ctx.fillRect(-1, -3, 2, 2);
    } else if (p.kind === "armor") {
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(3, -1);
      ctx.lineTo(3, 2);
      ctx.lineTo(0, 4);
      ctx.lineTo(-3, 2);
      ctx.lineTo(-3, -1);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === "wantedClear") {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const x = Math.cos(a) * 4;
        const y = Math.sin(a) * 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a2) * 1.8, Math.sin(a2) * 1.8);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();
  }

  // Buildings - extruded with fake-3d offset top
  // Sort buildings so closer-to-bottom-of-screen draws later
  const visibleBuildings = world.buildings.filter((b) => {
    const bx = b.x * TILE;
    const by = b.y * TILE;
    return (
      bx + b.w * TILE >= cam.x - rc.viewW / 2 / cam.zoom &&
      by + b.h * TILE >= cam.y - rc.viewH / 2 / cam.zoom &&
      bx <= cam.x + rc.viewW / 2 / cam.zoom &&
      by <= cam.y + rc.viewH / 2 / cam.zoom
    );
  });
  // Building shadows first (long, NW lighting)
  for (const b of visibleBuildings) {
    drawBuildingShadow(ctx, b, state);
  }
  // Building bodies, sorted by y (front buildings cover back ones)
  visibleBuildings.sort((a, b) => a.y - b.y);
  for (const b of visibleBuildings) {
    drawBuilding(ctx, b, state);
  }
  // Shop doors + signs (drawn after buildings so they sit on top)
  for (const b of visibleBuildings) {
    if (b.shopId === undefined) continue;
    const shop = world.shops.find((s) => s.id === b.shopId);
    if (shop) drawShopFront(ctx, shop, b, state);
  }

  // Order entities by y for pseudo-depth
  type Drawable =
    | { y: number; draw: () => void }
    | { y: number; draw: () => void };
  const drawables: Drawable[] = [];
  const isNightOrDusk =
    state.timeOfDay === "night" || state.timeOfDay === "dusk";
  for (const v of state.vehicles) {
    drawables.push({
      y: v.y,
      draw: () => drawCar(rc.ctx, v, isNightOrDusk),
    });
  }
  for (const h of state.humans) {
    if (h.inVehicle) continue;
    drawables.push({
      y: h.y,
      draw: () => drawHuman(rc.ctx, h),
    });
  }
  for (const a of state.animals) {
    drawables.push({
      y: a.y,
      draw: () => drawAnimal(rc.ctx, a),
    });
  }
  for (const p of state.props) {
    // Cull off-screen props quickly
    if (
      p.x < cam.x - rc.viewW / 2 / cam.zoom - 60 ||
      p.x > cam.x + rc.viewW / 2 / cam.zoom + 60 ||
      p.y < cam.y - rc.viewH / 2 / cam.zoom - 60 ||
      p.y > cam.y + rc.viewH / 2 / cam.zoom + 60
    ) {
      continue;
    }
    drawables.push({
      y: p.y,
      draw: () => drawProp(rc.ctx, p, state),
    });
  }

  // Draw shadows first
  for (const v of state.vehicles) {
    drawCarShadow(ctx, v, 3, 4);
  }
  for (const h of state.humans) {
    if (h.inVehicle) continue;
    drawHumanShadow(ctx, h, 1.5, 2);
  }
  for (const a of state.animals) {
    drawAnimalShadow(ctx, a);
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Bird flocks fly above everything; draw their shadows on the ground first
  for (const f of state.birdFlocks) {
    drawBirdFlockShadow(ctx, f);
  }
  for (const f of state.birdFlocks) {
    drawBirdFlock(ctx, f);
  }

  // Bullets
  for (const bul of state.bullets) {
    ctx.save();
    ctx.strokeStyle = "#ffd040";
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "#ffaa20";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(bul.x, bul.y);
    ctx.lineTo(bul.x - bul.vx * 0.04, bul.y - bul.vy * 0.04);
    ctx.stroke();
    ctx.restore();
  }

  // Particles
  drawParticles(ctx, state.particles);

  // Weather rain - drawn in world space
  if (state.weather === "rain" || state.weather === "storm") {
    drawRain(ctx, state, rc);
  }

  // ----- TRAFFIC LIGHTS (world space) -----
  // Small light heads on each corner of every visible intersection. Color
  // reflects the city-wide trafficPhase: red/yellow/green per direction.
  drawTrafficLights(rc);

  // ----- MISSION MARKERS (world space) -----
  // Draw available mission pillars (pulsing column of light) and the active
  // mission target marker — these need to be in WORLD space so they appear
  // on the map, but we draw them BEFORE the night overlay so they punch
  // through with the lighter blend afterwards.
  drawMissionMarkers(rc);

  ctx.restore();

  // Day/night overlay - on top of everything in world but before HUD
  if (state.timeOfDay === "night") {
    // Multiplicative-style darkening: deep blue base + radial vignette around the
    // player so the immediate area still reads while edges feel oppressive.
    const base = ctx.createRadialGradient(
      rc.viewW / 2,
      rc.viewH / 2,
      Math.min(rc.viewW, rc.viewH) * 0.15,
      rc.viewW / 2,
      rc.viewH / 2,
      Math.max(rc.viewW, rc.viewH) * 0.75,
    );
    base.addColorStop(0, "rgba(8,12,32,0.55)");
    base.addColorStop(0.55, "rgba(6,10,26,0.7)");
    base.addColorStop(1, "rgba(2,4,16,0.85)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, rc.viewW, rc.viewH);
    // Lit windows on nearby buildings, streetlights and headlight cones —
    // all using "lighter" so they actually punch through the darkness.
    drawNightLights(rc);
  } else if (state.timeOfDay === "dusk") {
    const grd = ctx.createLinearGradient(0, 0, rc.viewW, rc.viewH);
    grd.addColorStop(0, "rgba(40,30,80,0.32)");
    grd.addColorStop(0.5, "rgba(120,60,40,0.28)");
    grd.addColorStop(1, "rgba(180,90,40,0.34)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, rc.viewW, rc.viewH);
    // Even at dusk, headlights start to read — draw a softer pass.
    drawNightLights(rc, 0.55);
  }
  if (state.weather === "fog") {
    ctx.fillStyle = "rgba(180,180,180,0.35)";
    ctx.fillRect(0, 0, rc.viewW, rc.viewH);
  }
  if (state.weather === "snow") {
    // bluish cool tint
    ctx.fillStyle = "rgba(220,235,255,0.18)";
    ctx.fillRect(0, 0, rc.viewW, rc.viewH);
  }
  if (state.weather === "storm") {
    // Lightning flash
    const t = performance.now() / 1000;
    const flash = Math.sin(t * 0.5) > 0.998 ? 0.6 : 0;
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, rc.viewW, rc.viewH);
    }
  }

  // Subtle screen vignette always-on for cinematic feel
  const vg = ctx.createRadialGradient(
    rc.viewW / 2,
    rc.viewH / 2,
    Math.min(rc.viewW, rc.viewH) * 0.35,
    rc.viewW / 2,
    rc.viewH / 2,
    Math.max(rc.viewW, rc.viewH) * 0.7,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, rc.viewW, rc.viewH);

  // Off-screen objective arrow always sits above all overlays
  drawObjectiveArrow(rc);
}

function drawBuildingShadow(
  ctx: CanvasRenderingContext2D,
  b: Building,
  state: GameState,
) {
  const px = b.x * TILE;
  const py = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const len = b.height * 0.4 * (state.timeOfDay === "night" ? 0.3 : 1);
  ctx.fillStyle = `rgba(0,0,0,${state.timeOfDay === "night" ? 0.25 : 0.45})`;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + w, py);
  ctx.lineTo(px + w + len, py + len);
  ctx.lineTo(px + w + len, py + h + len);
  ctx.lineTo(px + len, py + h + len);
  ctx.lineTo(px, py + h);
  ctx.closePath();
  ctx.fill();
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  state: GameState,
) {
  const px = b.x * TILE;
  const py = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const ext = b.height * 0.3; // extrusion height in px (toward NW)

  const wallColor = timeFilter(state.timeOfDay, b.color);
  const roofColor = timeFilter(state.timeOfDay, b.roofColor);
  const dark = shadeHex(wallColor, -30);
  const light = shadeHex(wallColor, 18);
  const isNight = state.timeOfDay === "night";

  // ---- WALL FACE TEXTURE (front face = south side at ground level) ----
  // Draw the visible "front" panel (the south face) to give a brick / stucco feel.
  // We fill the front strip below the roof with subtle horizontal bands.
  // Building style varies by id parity: brick vs panel vs concrete.
  const style = b.id % 3; // 0: brick, 1: concrete panel, 2: glass tower

  // Front face (sits on the ground rectangle). The "shape" of the building when
  // looked at from above is the px..px+w, py..py+h rectangle. We tint that to
  // emulate ground-floor wall texture. Use a subtle vertical gradient
  // (top slightly brighter from sky bounce → bottom darker from ground shadow)
  // so the wall doesn't look like a flat color.
  const wallGrad = ctx.createLinearGradient(px, py, px, py + h);
  wallGrad.addColorStop(0, shadeHex(wallColor, 6));
  wallGrad.addColorStop(0.7, wallColor);
  wallGrad.addColorStop(1, shadeHex(wallColor, -10));
  ctx.fillStyle = wallGrad;
  ctx.fillRect(px, py, w, h);

  // Texture overlay
  if (style === 0) {
    // ===== BRICK ===== courses with mortar shading + per-row colour variation
    const courseH = 8;
    const brickW = 16;
    for (let row = 0, y = py + 6; y < py + h; y += courseH, row++) {
      // Slight per-course tint variation
      const tint = (b.id * 7 + row * 17) % 11 - 5; // -5..+5
      ctx.fillStyle = shadeHex(wallColor, -12 + tint);
      ctx.fillRect(px, y, w, 1.2);
      // Per-brick verticals offset by row (running bond pattern)
      const off = row % 2 === 0 ? 0 : brickW / 2;
      ctx.fillStyle = shadeHex(wallColor, -22);
      for (let x = px + off; x < px + w; x += brickW) {
        ctx.fillRect(x, y - courseH + 1, 1, courseH - 1);
      }
      // Occasional darker "stained" brick
      if (((b.id + row) % 5) === 0) {
        const sx = px + off + ((b.id * 11) % Math.max(1, w - brickW));
        ctx.fillStyle = shadeHex(wallColor, -28);
        ctx.fillRect(sx + 1, y - courseH + 1, brickW - 2, courseH - 1);
      }
    }
    // Foundation course — slightly taller darker stones
    ctx.fillStyle = shadeHex(wallColor, -32);
    ctx.fillRect(px, py + h - 4, w, 4);
    ctx.fillStyle = shadeHex(wallColor, -22);
    for (let x = px; x < px + w; x += 6) {
      ctx.fillRect(x, py + h - 4, 0.6, 4);
    }
    // Corner pillars (slightly lighter quoins)
    ctx.fillStyle = shadeHex(wallColor, 12);
    ctx.fillRect(px, py, 2.5, h);
    ctx.fillRect(px + w - 2.5, py, 2.5, h);
  } else if (style === 1) {
    // ===== CONCRETE PANELS ===== vertical seams + horizontal floor lines + weathering
    ctx.strokeStyle = shadeHex(wallColor, -28);
    ctx.lineWidth = 1;
    for (let x = px + 16; x < px + w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x, py + h);
      ctx.stroke();
    }
    // Horizontal floor seam every 24px
    ctx.strokeStyle = shadeHex(wallColor, -20);
    for (let y = py + 24; y < py + h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + w, y);
      ctx.stroke();
    }
    // Weathering streaks under each seam (rust/dirt drips)
    ctx.fillStyle = "rgba(60,45,30,0.18)";
    for (let x = px + 16; x < px + w; x += 16) {
      const len = 6 + ((b.id * 13 + x) % 12);
      ctx.fillRect(x - 0.5, py + 24, 1.2, len);
    }
    // Vents at base
    ctx.fillStyle = shadeHex(wallColor, -38);
    for (let x = px + 4; x < px + w - 4; x += 32) {
      ctx.fillRect(x, py + h - 6, 6, 2);
      ctx.fillStyle = shadeHex(wallColor, -50);
      ctx.fillRect(x + 1, py + h - 5, 4, 0.5);
      ctx.fillStyle = shadeHex(wallColor, -38);
    }
    // Foundation
    ctx.fillStyle = shadeHex(wallColor, -28);
    ctx.fillRect(px, py + h - 3, w, 3);
  } else {
    // ===== GLASS TOWER ===== horizontal stripes + vertical mullion columns + reflection sheen
    ctx.fillStyle = isNight ? shadeHex(wallColor, -10) : shadeHex(wallColor, 15);
    for (let y = py + 4; y < py + h; y += 6) {
      ctx.fillRect(px, y, w, 2);
    }
    // Vertical mullion columns
    ctx.fillStyle = isNight ? shadeHex(wallColor, -32) : shadeHex(wallColor, -18);
    for (let x = px + 6; x < px + w; x += 12) {
      ctx.fillRect(x, py, 0.8, h);
    }
    // Strong vertical reflection band (one bright stripe)
    if (!isNight) {
      const refX = px + ((b.id * 17) % Math.max(1, w - 6));
      const refGrad = ctx.createLinearGradient(refX, py, refX + 4, py);
      refGrad.addColorStop(0, "rgba(255,255,255,0)");
      refGrad.addColorStop(0.5, "rgba(255,255,255,0.32)");
      refGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = refGrad;
      ctx.fillRect(refX, py, 4, h);
    }
    // Foundation strip
    ctx.fillStyle = shadeHex(wallColor, -35);
    ctx.fillRect(px, py + h - 4, w, 4);
  }

  // Universal subtle base shadow strip — simulates ambient occlusion
  // where the building meets the ground.
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(px, py + h - 1, w, 1);

  // Side walls extruded toward NW (camera looks SE-ish): visible north/west walls
  // North wall (top side extruded up)
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + w, py);
  ctx.lineTo(px + w - ext, py - ext);
  ctx.lineTo(px - ext, py - ext);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // West wall
  ctx.fillStyle = shadeHex(wallColor, -10);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - ext, py - ext);
  ctx.lineTo(px - ext, py + h - ext);
  ctx.lineTo(px, py + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Roof (top, slightly inset)
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(px - ext, py - ext);
  ctx.lineTo(px + w - ext, py - ext);
  ctx.lineTo(px + w - ext, py + h - ext);
  ctx.lineTo(px - ext, py + h - ext);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Roof parapet edge
  ctx.fillStyle = shadeHex(roofColor, -15);
  ctx.fillRect(px - ext, py - ext, w, 2);
  ctx.fillRect(px - ext, py - ext, 2, h);

  // Roof details: HVAC, water tower, vents, antenna — vary by id
  const seed = b.id;
  ctx.fillStyle = shadeHex(roofColor, -20);
  const rdx = px - ext + w * 0.2;
  const rdy = py - ext + h * 0.2;
  ctx.fillRect(rdx, rdy, 12, 10);
  ctx.fillStyle = shadeHex(roofColor, -10);
  ctx.fillRect(rdx + 2, rdy + 2, 8, 6);
  // Second AC unit
  ctx.fillStyle = shadeHex(roofColor, -25);
  ctx.fillRect(rdx + 16, rdy + 4, 7, 7);
  // Water tower (every 4th building)
  if (seed % 4 === 0) {
    const wtx = px - ext + w * 0.6;
    const wty = py - ext + h * 0.55;
    ctx.fillStyle = "#7a5530";
    ctx.fillRect(wtx - 4, wty - 8, 1, 8);
    ctx.fillRect(wtx + 4, wty - 8, 1, 8);
    ctx.fillStyle = "#9a7a4a";
    ctx.beginPath();
    ctx.arc(wtx, wty - 10, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a3a18";
    ctx.beginPath();
    ctx.arc(wtx, wty - 11.5, 4.5, Math.PI, 0);
    ctx.fill();
  }
  // Antenna (every 3rd)
  if (seed % 3 === 0) {
    const ax = px - ext + w * 0.8;
    const ay = py - ext + h * 0.3;
    ctx.strokeStyle = "#aaaaaa";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, ay - 14);
    ctx.stroke();
    if (isNight) {
      ctx.fillStyle = "#ff4040";
      ctx.beginPath();
      ctx.arc(ax, ay - 14, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Skylight (every 5th building)
  if (seed % 5 === 0) {
    ctx.fillStyle = isNight ? "rgba(255,224,128,0.85)" : "rgba(180,220,255,0.5)";
    ctx.fillRect(px - ext + w * 0.45, py - ext + h * 0.6, 14, 8);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px - ext + w * 0.45, py - ext + h * 0.6, 14, 8);
  }
  // Satellite dish (every 6th)
  if (seed % 6 === 0) {
    const dx = px - ext + w * 0.4;
    const dy = py - ext + h * 0.45;
    ctx.fillStyle = "#cdcdcd";
    ctx.beginPath();
    ctx.ellipse(dx, dy, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a5a5a";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(dx - 0.3, dy - 0.3, 0.6, 4); // mast
  }
  // Rooftop billboard (every 7th building, only on taller ones)
  if (seed % 7 === 0 && b.height > 50) {
    const bbx = px - ext + 4;
    const bby = py - ext + h * 0.75;
    const bbw = w - 10;
    const bbh = 9;
    // Frame
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(bbx - 1, bby - 1, bbw + 2, bbh + 2);
    // Bright ad face — varies by id
    const adColors = ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#9b5de5"];
    ctx.fillStyle = adColors[seed % adColors.length]!;
    ctx.fillRect(bbx, bby, bbw, bbh);
    // Fake "text" stripes on ad
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(bbx + 2, bby + 2, bbw - 4, 1.2);
    ctx.fillRect(bbx + 2, bby + 5, (bbw - 4) * 0.6, 1);
    // Support legs
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(bbx + 2, bby + bbh, 1, 4);
    ctx.fillRect(bbx + bbw - 3, bby + bbh, 1, 4);
    // Light rim at night
    if (isNight) {
      ctx.shadowColor = adColors[seed % adColors.length]!;
      ctx.shadowBlur = 6;
      ctx.fillStyle = adColors[seed % adColors.length]!;
      ctx.fillRect(bbx, bby, bbw, 1);
      ctx.shadowBlur = 0;
    }
  }

  // Windows - on walls (north and west visible) — now with frames + sills
  const windowBase = isNight ? "#ffe080" : "rgba(180,220,255,0.55)";
  const windowDark = isNight ? "rgba(40,40,60,0.85)" : "rgba(80,100,120,0.4)";
  const frame = "rgba(20,20,30,0.85)";
  // North wall windows
  const winRows = Math.max(1, Math.floor(ext / 6));
  const winCols = Math.max(2, Math.floor(w / 12));
  for (let r = 0; r < winRows; r++) {
    for (let c = 0; c < winCols; c++) {
      const lit = isNight && (((b.id * 7 + r * 13 + c * 31) % 7) < 4);
      const wx = px + 6 + c * 12 - ((r + 0.5) * ext) / winRows;
      const wy = py - ((r + 0.5) * ext) / winRows;
      // frame
      ctx.fillStyle = frame;
      ctx.fillRect(wx - 0.5, wy - 2, 6, 4);
      // glass
      ctx.fillStyle = lit ? windowBase : windowDark;
      ctx.fillRect(wx, wy - 1.5, 5, 3);
      // mullion (cross)
      ctx.fillStyle = frame;
      ctx.fillRect(wx + 2, wy - 1.5, 0.5, 3);
      // Tiny sill highlight
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(wx, wy + 1, 5, 0.5);
    }
  }
  // West wall windows
  const wWinRows = winRows;
  const wWinCols = Math.max(2, Math.floor(h / 12));
  for (let r = 0; r < wWinRows; r++) {
    for (let c = 0; c < wWinCols; c++) {
      const lit = isNight && (((b.id * 11 + r * 17 + c * 29) % 7) < 4);
      const wx = px - ((r + 0.5) * ext) / wWinRows;
      const wy = py + 6 + c * 12 - ((r + 0.5) * ext) / wWinRows;
      ctx.fillStyle = frame;
      ctx.fillRect(wx - 2, wy - 0.5, 4, 6);
      ctx.fillStyle = lit ? windowBase : windowDark;
      ctx.fillRect(wx - 1.5, wy, 3, 5);
      ctx.fillStyle = frame;
      ctx.fillRect(wx - 1.5, wy + 2, 3, 0.5);
    }
  }
  // Ground-floor windows on the south face (front of building) for shorter buildings
  if (b.height < 60) {
    // FRONT DOOR — a single dark double-door panel near the center
    const doorW = 8;
    const doorH = 9;
    const doorX = px + w / 2 - doorW / 2;
    const doorY = py + h - doorH - 1;
    // Door frame
    ctx.fillStyle = shadeHex(wallColor, -38);
    ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, doorH + 1);
    // Door panels (two halves)
    ctx.fillStyle = shadeHex(wallColor, -28);
    ctx.fillRect(doorX, doorY, doorW / 2 - 0.3, doorH);
    ctx.fillRect(doorX + doorW / 2 + 0.3, doorY, doorW / 2 - 0.3, doorH);
    // Door handles
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(doorX + doorW / 2 - 1.3, doorY + doorH / 2, 0.8, 0.8);
    ctx.fillRect(doorX + doorW / 2 + 0.5, doorY + doorH / 2, 0.8, 0.8);
    // Stoop / threshold (slightly lighter strip in front)
    ctx.fillStyle = shadeHex(wallColor, -10);
    ctx.fillRect(doorX - 2, doorY + doorH, doorW + 4, 1);
    const groundRows = 1;
    const groundCols = Math.max(2, Math.floor(w / 14));
    for (let c = 0; c < groundCols; c++) {
      const wx = px + 6 + c * 14;
      const wy = py + h - 10;
      ctx.fillStyle = frame;
      ctx.fillRect(wx - 0.5, wy - 0.5, 7, 6);
      ctx.fillStyle = isNight ? "#ffd870" : "rgba(180,220,255,0.55)";
      ctx.fillRect(wx, wy, 6, 5);
      // mullion
      ctx.fillStyle = frame;
      ctx.fillRect(wx + 2.8, wy, 0.4, 5);
      // awning every other
      if (c % 2 === 0) {
        ctx.fillStyle = b.neonColor;
        ctx.fillRect(wx - 1, wy - 2, 8, 1.5);
        ctx.fillStyle = shadeHex(b.neonColor, -25);
        for (let k = 0; k < 4; k++) {
          ctx.fillRect(wx + k * 2, wy - 2, 1, 1.5);
        }
      }
    }
  }

  // Neon sign at night
  if (b.hasNeon && isNight) {
    const t = performance.now() / 400;
    const pulse = 0.6 + Math.sin(t + b.id) * 0.3;
    ctx.shadowColor = b.neonColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = b.neonColor;
    ctx.globalAlpha = pulse;
    ctx.fillRect(px + w / 2 - 8, py - ext + 4, 16, 3);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

function drawShopFront(
  ctx: CanvasRenderingContext2D,
  shop: import("./world").Shop,
  b: Building,
  state: GameState,
) {
  const isNight = state.timeOfDay === "night";
  // Door is a glowing rectangle on the side of the building facing the sidewalk.
  const dx = shop.doorX;
  const dy = shop.doorY;
  // Compute an inward offset so the door sits flush with the building wall, not on the sidewalk tile.
  let bx = dx;
  let by = dy;
  let dwidth = 14;
  let dheight = 22;
  switch (shop.facing) {
    case "n":
      by = b.y * TILE; // top edge of building
      bx = dx;
      dwidth = 22;
      dheight = 12;
      break;
    case "s":
      by = (b.y + b.h) * TILE - dheight + 4;
      bx = dx;
      dwidth = 22;
      dheight = 12;
      break;
    case "w":
      bx = b.x * TILE;
      by = dy;
      dwidth = 12;
      dheight = 22;
      break;
    case "e":
      bx = (b.x + b.w) * TILE - dwidth + 4;
      by = dy;
      dwidth = 12;
      dheight = 22;
      break;
  }
  // Door frame
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(bx - dwidth / 2 - 1, by - dheight / 2 - 1, dwidth + 2, dheight + 2);
  // Door panel — glowing color
  ctx.fillStyle = shop.color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(bx - dwidth / 2, by - dheight / 2, dwidth, dheight);
  ctx.globalAlpha = 1;
  // Tiny door handle
  ctx.fillStyle = "#ffe080";
  ctx.fillRect(bx + dwidth / 2 - 3, by - 1, 2, 2);

  // Sign mounted above the door — small board with the shop name
  const signY =
    shop.facing === "n"
      ? b.y * TILE - 14
      : shop.facing === "s"
        ? (b.y + b.h) * TILE + 2
        : by - dheight / 2 - 14;
  const signX =
    shop.facing === "w"
      ? b.x * TILE - 4
      : shop.facing === "e"
        ? (b.x + b.w) * TILE + 4
        : bx;
  // Sign background
  ctx.save();
  ctx.fillStyle = "rgba(15,15,20,0.92)";
  const signW = Math.max(40, shop.name.length * 5 + 8);
  const signH = 11;
  ctx.fillRect(signX - signW / 2, signY - signH / 2, signW, signH);
  ctx.strokeStyle = shop.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(signX - signW / 2 + 0.5, signY - signH / 2 + 0.5, signW - 1, signH - 1);
  // Glow at night
  if (isNight) {
    const t = performance.now() / 350;
    const pulse = 0.55 + Math.sin(t + shop.id) * 0.35;
    ctx.shadowColor = shop.color;
    ctx.shadowBlur = 10;
    ctx.globalAlpha = pulse;
  }
  ctx.fillStyle = shop.color;
  ctx.font = "bold 7px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(shop.name, signX, signY + 0.5);
  ctx.restore();

  // Glowing ring on the sidewalk in front of the door so it pops from a distance.
  const ringT = (performance.now() / 1000 + shop.id * 0.3) % 1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = shop.color;
  ctx.globalAlpha = (1 - ringT) * 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dx, dy, 8 + ringT * 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Highlight the active door if the player is standing on it.
  if (state.input.nearbyShopId === shop.id && !state.shopOverlay) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = shop.color;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dx, dy, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    if (p.kind === "smoke") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - a)), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "fire") {
      ctx.globalCompositeOperation = "lighter";
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      grd.addColorStop(0, "rgba(255,240,120,0.9)");
      grd.addColorStop(0.5, "rgba(240,80,30,0.6)");
      grd.addColorStop(1, "rgba(80,20,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else if (p.kind === "spark" || p.kind === "muzzle") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else if (p.kind === "blood") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "debris") {
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
      ctx.restore();
    } else if (p.kind === "rain") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.04, p.y + p.vy * 0.04);
      ctx.stroke();
    } else if (p.kind === "dust") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "snow") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "leaf") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.kind === "feather") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

// PROPS — trees, hydrants, mailboxes, benches, trash cans, lamp posts, bushes
function drawProp(ctx: CanvasRenderingContext2D, p: Prop, state: GameState) {
  const night = state.timeOfDay === "night";
  const snowing = state.weather === "snow";
  // shadow — kept subtle (low alpha) so it reads as a contact shadow, not a
  // dark blob on the road / sidewalk.
  ctx.save();
  ctx.fillStyle = night ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.20)";
  if (p.kind === "tree" || p.kind === "oak") {
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 4, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "pine") {
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 5, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "palm") {
    ctx.beginPath();
    ctx.ellipse(p.x + 4, p.y + 5, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "cactus") {
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "lamp") {
    ctx.beginPath();
    ctx.ellipse(p.x + 4, p.y + 3, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind !== "bush" && p.kind !== "flowers" && p.kind !== "tallgrass") {
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 3, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (p.kind === "tree") {
    // Generic deciduous — round canopy with multiple lobes
    const trunkColor = "#4a2f1a";
    ctx.fillStyle = trunkColor;
    ctx.fillRect(p.x - 1.5, p.y - 2, 3, 6);
    const greens = ["#2c6b2a", "#3e8a32", "#356f28", "#4a9e3c"];
    const c = greens[p.variant % greens.length]!;
    ctx.fillStyle = shadeHex(c, -20);
    ctx.beginPath();
    ctx.arc(p.x + 1, p.y - 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, 9, 0, Math.PI * 2);
    ctx.arc(p.x - 5, p.y - 2, 6, 0, Math.PI * 2);
    ctx.arc(p.x + 5, p.y - 2, 6, 0, Math.PI * 2);
    ctx.arc(p.x - 1, p.y - 8, 6, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = shadeHex(c, 28);
    ctx.beginPath();
    ctx.arc(p.x - 3, p.y - 6, 4.5, 0, Math.PI * 2);
    ctx.arc(p.x + 1, p.y - 7, 3, 0, Math.PI * 2);
    ctx.fill();
    if (snowing) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(p.x - 1, p.y - 9, 6, Math.PI, Math.PI * 2);
      ctx.arc(p.x + 4, p.y - 5, 3, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === "oak") {
    // Bigger broader canopy with a knotted trunk and visible branch tips
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(p.x - 2, p.y - 3, 4, 8);
    // branch knot
    ctx.fillStyle = "#5a3820";
    ctx.beginPath();
    ctx.arc(p.x, p.y - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // canopy base shadow
    ctx.fillStyle = "#1f4a1c";
    ctx.beginPath();
    ctx.ellipse(p.x + 1, p.y - 4, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // canopy
    ctx.fillStyle = "#2e7a2a";
    ctx.beginPath();
    ctx.arc(p.x - 6, p.y - 4, 7, 0, Math.PI * 2);
    ctx.arc(p.x + 6, p.y - 4, 7, 0, Math.PI * 2);
    ctx.arc(p.x, p.y - 8, 7, 0, Math.PI * 2);
    ctx.arc(p.x - 2, p.y - 1, 7, 0, Math.PI * 2);
    ctx.arc(p.x + 4, p.y - 1, 6, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = "#5cc450";
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 7, 4, 0, Math.PI * 2);
    ctx.arc(p.x + 2, p.y - 9, 3, 0, Math.PI * 2);
    ctx.fill();
    if (snowing) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 11, 7, Math.PI, Math.PI * 2);
      ctx.arc(p.x - 6, p.y - 7, 4, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === "pine") {
    // Conifer — stacked triangles
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(p.x - 1.2, p.y - 1, 2.4, 5);
    const greenA = "#1f5a25";
    const greenB = "#2d7330";
    // Bottom skirt
    ctx.fillStyle = greenA;
    ctx.beginPath();
    ctx.moveTo(p.x - 9, p.y);
    ctx.lineTo(p.x + 9, p.y);
    ctx.lineTo(p.x + 4, p.y - 4);
    ctx.lineTo(p.x - 4, p.y - 4);
    ctx.closePath();
    ctx.fill();
    // Middle
    ctx.fillStyle = greenB;
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y - 3);
    ctx.lineTo(p.x + 7, p.y - 3);
    ctx.lineTo(p.x + 3, p.y - 8);
    ctx.lineTo(p.x - 3, p.y - 8);
    ctx.closePath();
    ctx.fill();
    // Top
    ctx.fillStyle = "#3e8c3a";
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y - 7);
    ctx.lineTo(p.x + 5, p.y - 7);
    ctx.lineTo(p.x, p.y - 14);
    ctx.closePath();
    ctx.fill();
    // highlight stripe on left of each layer
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(p.x - 9, p.y);
    ctx.lineTo(p.x - 4, p.y - 4);
    ctx.lineTo(p.x - 3, p.y - 4);
    ctx.lineTo(p.x - 7, p.y);
    ctx.closePath();
    ctx.fill();
    if (snowing) {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      // snow on each tier
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y - 4);
      ctx.lineTo(p.x + 4, p.y - 4);
      ctx.lineTo(p.x + 3, p.y - 5);
      ctx.lineTo(p.x - 3, p.y - 5);
      ctx.closePath();
      ctx.moveTo(p.x - 3, p.y - 8);
      ctx.lineTo(p.x + 3, p.y - 8);
      ctx.lineTo(p.x + 2, p.y - 9);
      ctx.lineTo(p.x - 2, p.y - 9);
      ctx.closePath();
      ctx.arc(p.x, p.y - 13, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === "palm") {
    // Tall trunk + radial fronds
    // trunk segments
    ctx.strokeStyle = "#6a4a28";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 4);
    ctx.quadraticCurveTo(p.x - 1, p.y - 4, p.x + 0.5, p.y - 12);
    ctx.stroke();
    ctx.fillStyle = "#4a3018";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(p.x + 0.3 - i * 0.2, p.y + 3 - i * 3, 1.6, 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // coconuts
    ctx.fillStyle = "#3a2814";
    ctx.beginPath();
    ctx.arc(p.x - 1.2, p.y - 11, 0.9, 0, Math.PI * 2);
    ctx.arc(p.x + 1.4, p.y - 11.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // fronds — radial bezier leaves
    const frondColors = ["#2e8a30", "#3aa838", "#287028"];
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + p.variant * 0.3;
      const cx = p.x + 0.5 + Math.cos(ang) * 1;
      const cy = p.y - 13 + Math.sin(ang) * 1;
      const ex = p.x + 0.5 + Math.cos(ang) * 11;
      const ey = p.y - 13 + Math.sin(ang) * 7;
      ctx.fillStyle = frondColors[i % frondColors.length]!;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        (cx + ex) / 2 + Math.sin(ang) * 3,
        (cy + ey) / 2 - Math.cos(ang) * 3,
        ex,
        ey,
      );
      ctx.quadraticCurveTo(
        (cx + ex) / 2 - Math.sin(ang) * 3,
        (cy + ey) / 2 + Math.cos(ang) * 3,
        cx,
        cy,
      );
      ctx.fill();
    }
    // crown highlight
    ctx.fillStyle = "#4ec84a";
    ctx.beginPath();
    ctx.arc(p.x + 0.5, p.y - 13, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "bush") {
    // Layered bush with darker base
    ctx.fillStyle = "#1f4a1c";
    ctx.beginPath();
    ctx.arc(p.x - 2, p.y + 1, 5.5, 0, Math.PI * 2);
    ctx.arc(p.x + 2, p.y, 5, 0, Math.PI * 2);
    ctx.arc(p.x + 1, p.y + 3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3e7a32";
    ctx.beginPath();
    ctx.arc(p.x - 2, p.y, 4.5, 0, Math.PI * 2);
    ctx.arc(p.x + 2, p.y - 1, 3.8, 0, Math.PI * 2);
    ctx.arc(p.x + 1, p.y + 2, 3.8, 0, Math.PI * 2);
    ctx.fill();
    // berries (small dots) on some bushes
    if (p.variant % 3 === 0) {
      ctx.fillStyle = "#c84050";
      ctx.beginPath();
      ctx.arc(p.x - 1, p.y - 1, 0.7, 0, Math.PI * 2);
      ctx.arc(p.x + 2, p.y + 1, 0.7, 0, Math.PI * 2);
      ctx.arc(p.x, p.y + 1.5, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (snowing) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(p.x - 1, p.y - 2, 3, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === "flowers") {
    // Patch of small flowers — variant picks color palette
    const palettes = [
      ["#e84a4a", "#ff8080"], // red
      ["#f0c020", "#ffe060"], // yellow
      ["#a040c0", "#d080e0"], // purple
      ["#f070b0", "#ffaad0"], // pink
    ];
    const [petalDark, petalLight] = palettes[p.variant % palettes.length]!;
    // Stems / leaves
    ctx.fillStyle = "#356f28";
    for (let i = 0; i < 5; i++) {
      const ox = (i - 2) * 1.6 + (i % 2 ? 0.5 : -0.5);
      const oy = (i % 3) * 0.8;
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy + 1, 0.4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Flower heads — 5 petals
    for (let i = 0; i < 5; i++) {
      const ox = (i - 2) * 1.6 + (i % 2 ? 0.5 : -0.5);
      const oy = (i % 3) * 0.8;
      ctx.fillStyle = petalDark!;
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(p.x + ox + Math.cos(a) * 0.7, p.y + oy + Math.sin(a) * 0.7, 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = petalLight!;
      ctx.beginPath();
      ctx.arc(p.x + ox - 0.2, p.y + oy - 0.2, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0c020";
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === "tallgrass") {
    // Tufts of grass blades
    const blade = (ox: number, oy: number, h: number, lean: number) => {
      ctx.beginPath();
      ctx.moveTo(p.x + ox - 0.3, p.y + oy);
      ctx.quadraticCurveTo(p.x + ox + lean, p.y + oy - h * 0.6, p.x + ox + lean * 1.5, p.y + oy - h);
      ctx.quadraticCurveTo(p.x + ox + lean, p.y + oy - h * 0.6, p.x + ox + 0.3, p.y + oy);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = "#3e7a2c";
    blade(-2, 1, 4, 0.5);
    blade(0, 1, 5, -0.5);
    blade(2, 1, 4, 0.8);
    ctx.fillStyle = "#5aa040";
    blade(-1, 0.5, 3.5, 0.3);
    blade(1.5, 0.5, 3, -0.4);
  } else if (p.kind === "cactus") {
    // Saguaro-style cactus
    ctx.fillStyle = "#1a4a1a";
    // main body
    ctx.beginPath();
    ctx.roundRect(p.x - 2, p.y - 8, 4, 12, 1.6);
    ctx.fill();
    // arms
    ctx.beginPath();
    ctx.roundRect(p.x - 5, p.y - 4, 2.5, 5, 1.2);
    ctx.roundRect(p.x - 5, p.y - 6, 1.5, 3, 0.7);
    ctx.roundRect(p.x + 2.5, p.y - 5, 2.5, 4.5, 1.2);
    ctx.roundRect(p.x + 3.5, p.y - 7, 1.5, 3, 0.7);
    ctx.fill();
    // ribs / spines
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(p.x - 1, p.y - 8);
    ctx.lineTo(p.x - 1, p.y + 3);
    ctx.moveTo(p.x + 1, p.y - 8);
    ctx.lineTo(p.x + 1, p.y + 3);
    ctx.stroke();
    // tiny pink flower on top
    if (p.variant % 2 === 0) {
      ctx.fillStyle = "#ff5fa8";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 9, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === "hydrant") {
    // red fire hydrant
    ctx.fillStyle = "#c72a1a";
    ctx.beginPath();
    ctx.roundRect(p.x - 3, p.y - 5, 6, 8, 1);
    ctx.fill();
    ctx.fillStyle = "#ffd84a";
    ctx.fillRect(p.x - 2, p.y - 2, 4, 1);
    ctx.fillStyle = "#7a1810";
    ctx.fillRect(p.x - 4, p.y - 1, 8, 1);
  } else if (p.kind === "mailbox") {
    // blue mailbox on a post
    ctx.fillStyle = "#2c2c2c";
    ctx.fillRect(p.x - 0.5, p.y, 1, 4);
    ctx.fillStyle = "#1f5fb6";
    ctx.beginPath();
    ctx.roundRect(p.x - 5, p.y - 5, 10, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#143f80";
    ctx.fillRect(p.x - 4, p.y - 3, 3, 1);
  } else if (p.kind === "bench") {
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(p.x - 9, p.y - 1, 18, 4);
    ctx.fillStyle = "#3a2412";
    ctx.fillRect(p.x - 9, p.y + 3, 2, 3);
    ctx.fillRect(p.x + 7, p.y + 3, 2, 3);
  } else if (p.kind === "trashcan") {
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.roundRect(p.x - 3.5, p.y - 5, 7, 9, 1.5);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.fillRect(p.x - 4, p.y - 6, 8, 1.5);
  } else if (p.kind === "lamp") {
    // lamp post: vertical pole with a small head
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(p.x - 0.7, p.y - 14, 1.4, 14);
    ctx.fillStyle = "#3a3a44";
    ctx.beginPath();
    ctx.arc(p.x, p.y - 15, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (state.timeOfDay !== "day") {
      ctx.fillStyle = "rgba(255,220,140,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 14, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === "fountain") {
    // Plaza fountain — outer stone ring, inner water disc, central spout
    const t = performance.now() / 1000;
    // outer stone ring
    ctx.fillStyle = "#8a8275";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8a092";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fill();
    // water surface
    ctx.fillStyle = "#2a6090";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    // ripples
    ctx.strokeStyle = "rgba(180,220,255,0.5)";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      const r = 4 + i * 3 + (Math.sin(t * 1.5 + i) + 1) * 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // central pedestal
    ctx.fillStyle = "#9a9285";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // water spout (animated upward jet)
    const jetH = 10 + Math.sin(t * 4) * 2;
    ctx.fillStyle = "rgba(180,220,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - jetH / 2, 1.2, jetH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // splash droplets
    ctx.fillStyle = "rgba(180,220,255,0.7)";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 5 + (Math.sin(t * 3 + i) + 1) * 1.5;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    // top sparkle on jet
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(p.x, p.y - jetH, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ANIMALS
function drawAnimalShadow(ctx: CanvasRenderingContext2D, a: Animal) {
  const flyOff = a.flyZ * 12;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  const r = a.kind === "dog" ? 4 : a.kind === "cat" ? 3 : 2.5;
  ctx.ellipse(a.x + flyOff * 0.4, a.y + flyOff * 0.4 + 2, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAnimal(ctx: CanvasRenderingContext2D, a: Animal) {
  ctx.save();
  // visual lift when pigeon flies
  const lift = a.flyZ * 10;
  ctx.translate(a.x, a.y - lift);
  ctx.rotate(a.angle);
  if (a.hp <= 0) {
    // limp body
    ctx.fillStyle = a.furColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (a.kind === "dog") {
    // body (oval)
    ctx.fillStyle = a.furColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(5, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // tail wag
    const tw = Math.sin(a.walkPhase) * 1.5;
    ctx.strokeStyle = a.furColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-8, tw);
    ctx.stroke();
    // legs (simple dots that bob)
    ctx.fillStyle = shadeHex(a.furColor, -25);
    const lp = Math.sin(a.walkPhase) * 1.2;
    ctx.beginPath();
    ctx.arc(-2, 2 + lp, 0.9, 0, Math.PI * 2);
    ctx.arc(2, 2 - lp, 0.9, 0, Math.PI * 2);
    ctx.arc(-2, -2 - lp, 0.9, 0, Math.PI * 2);
    ctx.arc(2, -2 + lp, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // ears
    ctx.fillStyle = shadeHex(a.furColor, -15);
    ctx.beginPath();
    ctx.moveTo(5.5, -1.5);
    ctx.lineTo(7, -3);
    ctx.lineTo(6, -0.5);
    ctx.fill();
  } else if (a.kind === "cat") {
    ctx.fillStyle = a.furColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // pointy ears
    ctx.beginPath();
    ctx.moveTo(3.5, -1.5);
    ctx.lineTo(4.5, -3.5);
    ctx.lineTo(5, -1.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3.5, 1.5);
    ctx.lineTo(4.5, 3.5);
    ctx.lineTo(5, 1.2);
    ctx.fill();
    // tail curling
    ctx.strokeStyle = a.furColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-7, Math.sin(a.walkPhase) * 2, -8, -2);
    ctx.stroke();
  } else {
    // pigeon - small grey body, beak, flapping wings if flying
    ctx.fillStyle = a.furColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(2.5, 0, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = "#e8a83a";
    ctx.beginPath();
    ctx.moveTo(3.8, 0);
    ctx.lineTo(5, -0.4);
    ctx.lineTo(5, 0.4);
    ctx.fill();
    // wings flap when flying
    if (a.flyZ > 0.05) {
      const wf = Math.sin(a.walkPhase * 2) * 2;
      ctx.fillStyle = shadeHex(a.furColor, -20);
      ctx.beginPath();
      ctx.ellipse(-0.5, -3, 3, 1.2 + wf * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-0.5, 3, 3, 1.2 + wf * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBirdFlockShadow(ctx: CanvasRenderingContext2D, f: BirdFlock) {
  // Cast a moving shadow on the ground offset from the flock
  const off = 30 * f.altitude;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < f.size; i++) {
    const ang = (i / f.size) * Math.PI * 2 + f.flapPhase * 0.1;
    const r = 8 + (i % 3) * 4;
    const sx = f.x + Math.cos(ang) * r + off;
    const sy = f.y + Math.sin(ang) * r + off;
    // tiny V shape
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy);
    ctx.lineTo(sx, sy - 0.6);
    ctx.lineTo(sx + 2, sy);
    ctx.fill();
  }
  ctx.restore();
}

function drawBirdFlock(ctx: CanvasRenderingContext2D, f: BirdFlock) {
  ctx.save();
  ctx.fillStyle = "#1a1a1a";
  const flapY = Math.sin(f.flapPhase) * 1.2;
  for (let i = 0; i < f.size; i++) {
    const ang = (i / f.size) * Math.PI * 2 + f.flapPhase * 0.1;
    const r = 8 + (i % 3) * 4;
    const x = f.x + Math.cos(ang) * r;
    const y = f.y + Math.sin(ang) * r;
    // V-shaped bird
    ctx.beginPath();
    ctx.moveTo(x - 3, y + flapY);
    ctx.quadraticCurveTo(x, y - 1 - flapY, x + 3, y + flapY);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#1a1a1a";
    ctx.stroke();
  }
  ctx.restore();
}

function drawRain(ctx: CanvasRenderingContext2D, state: GameState, rc: RenderContext) {
  // Rain handled via particles. Add wet sheen on roads.
  ctx.fillStyle = "rgba(60,80,100,0.15)";
  ctx.fillRect(
    rc.state.camera.x - rc.viewW,
    rc.state.camera.y - rc.viewH,
    rc.viewW * 2,
    rc.viewH * 2,
  );
}

// ─── TRAFFIC LIGHTS ─────────────────────────────────────────────────────────
// At each intersection corner, draw a small 3-bulb traffic light head facing
// the road it controls. Active bulb is bright (red/yellow/green) and the
// other two are dim. trafficPhase 0 = N/S green (E/W red), 1 = E/W green
// (N/S red). Last 1.5s of the green window = yellow.
function drawTrafficLights(rc: RenderContext) {
  const { ctx, world, state } = rc;
  const cam = state.camera;
  const halfW = rc.viewW / cam.zoom / 2 + 80;
  const halfH = rc.viewH / cam.zoom / 2 + 80;
  const TRAFFIC_GREEN = 14;
  const phase = state.trafficPhase;
  const yellow = state.trafficPhaseTimer > TRAFFIC_GREEN - 1.5;
  // ns = north-south traffic, ew = east-west traffic
  const nsState: "red" | "yellow" | "green" =
    phase === 0 ? (yellow ? "yellow" : "green") : "red";
  const ewState: "red" | "yellow" | "green" =
    phase === 1 ? (yellow ? "yellow" : "green") : "red";

  const drawHead = (
    cx: number,
    cy: number,
    facing: "n" | "s" | "e" | "w",
    s: "red" | "yellow" | "green",
  ) => {
    // Rotate so bulbs run along the road. NS-controlling lights mount on
    // the curb facing the oncoming N or S traffic and have bulbs stacked
    // vertically; EW-controlling lights mount facing E or W with bulbs
    // stacked horizontally.
    const vertical = facing === "n" || facing === "s";
    const w = vertical ? 7 : 22;
    const h = vertical ? 22 : 7;
    // Housing
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    // Bulbs (top→bottom = R,Y,G when vertical; left→right = R,Y,G when horizontal)
    const bulb = (i: number, color: string, on: boolean) => {
      let bx: number;
      let by: number;
      if (vertical) {
        bx = cx;
        by = cy - h / 2 + 4 + i * 7;
      } else {
        bx = cx - w / 2 + 4 + i * 7;
        by = cy;
      }
      ctx.beginPath();
      ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = on ? color : "#2a2a2a";
      ctx.fill();
      if (on) {
        // Soft halo for on-bulb
        const grd = ctx.createRadialGradient(bx, by, 0, bx, by, 7);
        grd.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.55)"));
        grd.addColorStop(1, color.replace("rgb", "rgba").replace(")", ",0)"));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    bulb(0, "rgb(230,40,40)", s === "red");
    bulb(1, "rgb(240,200,30)", s === "yellow");
    bulb(2, "rgb(60,210,80)", s === "green");
  };

  for (const node of world.roadGraph) {
    if (Math.abs(node.x - cam.x) > halfW + TILE) continue;
    if (Math.abs(node.y - cam.y) > halfH + TILE) continue;
    // Place 4 lights, one per corner, each controlling the lane that approaches
    // the intersection from its side. Offsets are at the edge of the
    // intersection box (intersection is 4 tiles, ~256px square; node is the
    // center, so half-width is ~128px). We shrink slightly so they sit on the
    // sidewalk corner.
    const off = TILE * 1.9;
    // North-facing head (controls cars driving south, i.e. the southbound lane
    // approaching from the NW corner). Mount at the NW corner of the box.
    drawHead(node.x - off, node.y - off, "s", nsState);
    // South-facing head at SE corner — controls northbound cars
    drawHead(node.x + off, node.y + off, "n", nsState);
    // East-facing head at NE corner — controls westbound cars
    drawHead(node.x + off, node.y - off, "w", ewState);
    // West-facing head at SW corner — controls eastbound cars
    drawHead(node.x - off, node.y + off, "e", ewState);
  }
}

// Night lighting pass: drawn AFTER the dark vignette using "lighter" blending so
// every light source genuinely punches through the darkness instead of just
// stacking color on top. Includes streetlamp halos, window glow, headlight
// cones, tail/brake glow, and police strobes. `intensity` scales overall
// brightness so dusk gets a subtler version of this pass.
function drawNightLights(rc: RenderContext, intensity = 1) {
  const { ctx, world, state } = rc;
  const cam = state.camera;
  ctx.save();
  // Match world transform so we can draw using world coordinates.
  ctx.translate(rc.viewW / 2 - cam.x * cam.zoom, rc.viewH / 2 - cam.y * cam.zoom);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.globalCompositeOperation = "lighter";

  const tNow = performance.now() / 1000;
  const halfW = rc.viewW / cam.zoom / 2 + 80;
  const halfH = rc.viewH / cam.zoom / 2 + 80;

  // ----- STREET LAMPS at every intersection (4 corners) -----
  for (const node of world.roadGraph) {
    if (Math.abs(node.x - cam.x) > halfW + TILE) continue;
    if (Math.abs(node.y - cam.y) > halfH + TILE) continue;
    const offsets: [number, number][] = [
      [-TILE * 0.8, -TILE * 0.8],
      [TILE * 0.8, -TILE * 0.8],
      [-TILE * 0.8, TILE * 0.8],
      [TILE * 0.8, TILE * 0.8],
    ];
    // Tiny per-lamp flicker keyed off node position so it looks organic, not synced.
    const flicker = 1 + Math.sin(tNow * 4.2 + node.x * 0.013) * 0.05;
    for (const [ox, oy] of offsets) {
      const lx = node.x + ox;
      const ly = node.y + oy;
      // Outer warm halo — radius reduced 90→62 and alpha cut significantly
      // so multiple lamps don't additively blow out the road into a brown
      // wash when several halos overlap (each intersection has 4).
      const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, 62);
      grd.addColorStop(0, `rgba(255,225,160,${0.34 * intensity * flicker})`);
      grd.addColorStop(0.4, `rgba(255,205,130,${0.16 * intensity})`);
      grd.addColorStop(1, "rgba(255,200,140,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(lx, ly, 62, 0, Math.PI * 2);
      ctx.fill();
      // Hot bulb core — softened so it doesn't read as a tiny sun
      const core = ctx.createRadialGradient(lx, ly, 0, lx, ly, 5);
      core.addColorStop(0, `rgba(255,250,220,${0.55 * intensity})`);
      core.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ----- LIT WINDOWS on nearby buildings -----
  // Procedural per-building "is this window lit" decision based on building id
  // and a slow time-based change so a few flicker on/off.
  for (const b of world.buildings) {
    const bx = b.x * TILE;
    const by = b.y * TILE;
    if (
      bx + b.w * TILE < cam.x - halfW ||
      bx > cam.x + halfW ||
      by + b.h * TILE < cam.y - halfH ||
      by > cam.y + halfH
    ) {
      continue;
    }
    const w = b.w * TILE;
    const h = b.h * TILE;
    // 4-8 windows per building, deterministic seed
    const seed = (b.id * 9301 + 49297) % 233280;
    const slowFlicker = Math.sin(tNow * 0.4 + b.id * 0.7);
    const litCount = 3 + (b.id % 5);
    for (let i = 0; i < litCount; i++) {
      const r1 = ((seed + i * 1013) % 233280) / 233280;
      const r2 = ((seed + i * 7919) % 233280) / 233280;
      // Skip a few so not every window is lit
      if (((b.id + i) % 4) === 0 && slowFlicker < 0) continue;
      const wx = bx + 6 + r1 * (w - 12);
      const wy = by + 6 + r2 * (h - 12);
      // Warm window halo — alpha cut so dozens of windows on tall buildings
      // don't additively wash the whole street with orange (was 0.55).
      const grd = ctx.createRadialGradient(wx, wy, 0, wx, wy, 11);
      grd.addColorStop(0, `rgba(255,220,150,${0.30 * intensity})`);
      grd.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(wx, wy, 11, 0, Math.PI * 2);
      ctx.fill();
      // Bright pixel at the window itself (kept fairly punchy, it's tiny)
      ctx.fillStyle = `rgba(255,235,180,${0.7 * intensity})`;
      ctx.fillRect(wx - 0.7, wy - 0.7, 1.4, 1.4);
    }
  }

  // ----- VEHICLE HEADLIGHT CONES + TAIL GLOW -----
  for (const v of state.vehicles) {
    if (Math.abs(v.x - cam.x) > halfW + 40) continue;
    if (Math.abs(v.y - cam.y) > halfH + 40) continue;
    const cosA = Math.cos(v.angle);
    const sinA = Math.sin(v.angle);
    const halfL = v.length / 2;
    const halfWv = v.width / 2;
    // Front bumper midpoints for left/right headlights
    const lights: [number, number][] = [
      [
        v.x + cosA * halfL - sinA * (halfWv - 3),
        v.y + sinA * halfL + cosA * (halfWv - 3),
      ],
      [
        v.x + cosA * halfL + sinA * (halfWv - 3),
        v.y + sinA * halfL - cosA * (halfWv - 3),
      ],
    ];
    // Cone — wedge extending forward. Alpha cut roughly in half (was
    // 0.55→0.22) and the cone tapers to a tighter spread (32 vs 36) so two
    // overlapping cones no longer additively blow out into solid white.
    ctx.save();
    ctx.translate(v.x + cosA * halfL, v.y + sinA * halfL);
    ctx.rotate(v.angle);
    const coneLen = 78 + Math.min(50, Math.hypot(v.vx, v.vy) * 0.45);
    const coneWidth = 32;
    const cgrd = ctx.createLinearGradient(0, 0, coneLen, 0);
    cgrd.addColorStop(0, `rgba(255,248,210,${0.28 * intensity})`);
    cgrd.addColorStop(0.5, `rgba(255,243,200,${0.11 * intensity})`);
    cgrd.addColorStop(1, "rgba(255,245,200,0)");
    ctx.fillStyle = cgrd;
    ctx.beginPath();
    ctx.moveTo(0, -halfWv * 0.6);
    ctx.lineTo(coneLen, -coneWidth);
    ctx.lineTo(coneLen, coneWidth);
    ctx.lineTo(0, halfWv * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Bright bulb cores at each headlight — also softened (0.95 → 0.55)
    // and slightly smaller so the bulb reads as a glow not a flash.
    for (const [lx, ly] of lights) {
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 5);
      g.addColorStop(0, `rgba(255,250,225,${0.55 * intensity})`);
      g.addColorStop(1, "rgba(255,250,210,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tail glow (always on at night) — red halo behind
    const tx = v.x - cosA * halfL;
    const ty = v.y - sinA * halfL;
    // Brake-on punches red brighter, but normal running tail is much softer
    // (was 0.45, now 0.30) so a calm parked car doesn't glow like a flare.
    const tailIntensity = v.brake > 0.3 ? 0.65 : 0.30;
    const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 12);
    tg.addColorStop(0, `rgba(255,60,40,${tailIntensity * intensity})`);
    tg.addColorStop(1, "rgba(255,40,20,0)");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(tx, ty, 14, 0, Math.PI * 2);
    ctx.fill();
    // Police strobe — alternating red/blue halo around the lightbar
    if (v.kind === "police") {
      const phase = Math.floor(performance.now() / 180) % 2;
      const cx = v.x;
      const cy = v.y;
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
      sg.addColorStop(
        0,
        phase === 0
          ? `rgba(255,80,80,${0.75 * intensity})`
          : `rgba(80,140,255,${0.75 * intensity})`,
      );
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ===== MISSION MARKERS (world space, drawn before night overlay) =====
function drawMissionMarkers(rc: RenderContext) {
  const { ctx, state } = rc;
  const t = performance.now() / 1000;
  // 1) Available pickups: glowing pillar + icon ring on the ground
  for (const m of state.missions) {
    drawMissionPillar(ctx, m.targetX, m.targetY, m.markerColor, m.icon, t);
  }
  // 2) Active mission target: similar pillar but more urgent (flashes red on escape)
  const am = state.activeMission;
  if (am) {
    let color = am.markerColor;
    if (am.type === "escape") {
      color = Math.floor(t * 4) % 2 === 0 ? "#ff3868" : "#ffd040";
    }
    drawMissionPillar(ctx, am.targetX, am.targetY, color, am.icon, t, true);
  }
}

function drawMissionPillar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  icon: string,
  t: number,
  active = false,
) {
  ctx.save();
  // Ring on the ground
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.globalCompositeOperation = "lighter";
  const ringR = active ? 22 : 18;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, ringR + 8);
  grd.addColorStop(0, color + "cc");
  grd.addColorStop(0.6, color + "55");
  grd.addColorStop(1, color + "00");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, ringR + 8, 0, Math.PI * 2);
  ctx.fill();
  // Pillar of light (simulated via stacked semi-transparent ellipses)
  const pillarH = 30 + pulse * 6;
  for (let i = 0; i < 7; i++) {
    const yy = y - i * (pillarH / 7);
    const a = (1 - i / 7) * 0.35;
    ctx.fillStyle = color + Math.floor(a * 255).toString(16).padStart(2, "0");
    ctx.beginPath();
    ctx.ellipse(x, yy, 4 - i * 0.3, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  // Icon at top
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(icon, x, y - pillarH - 1);
  ctx.fillStyle = color;
  ctx.fillText(icon, x, y - pillarH - 2);
  // Outline ring on ground
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Off-screen objective arrow drawn in SCREEN space (called from renderWorld
// after the night overlay so it always reads).
export function drawObjectiveArrow(rc: RenderContext) {
  const { ctx, state } = rc;
  const am = state.activeMission;
  if (!am) return;
  const cam = state.camera;
  // Project target into screen space
  const sx = rc.viewW / 2 + (am.targetX - cam.x) * cam.zoom;
  const sy = rc.viewH / 2 + (am.targetY - cam.y) * cam.zoom;
  const margin = 60;
  // If the marker is on-screen with margin, no arrow needed
  if (sx >= margin && sx <= rc.viewW - margin && sy >= margin && sy <= rc.viewH - margin) {
    return;
  }
  const cx = rc.viewW / 2;
  const cy = rc.viewH / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const ang = Math.atan2(dy, dx);
  // Distance to clamp on edge ring
  const rx = rc.viewW / 2 - margin;
  const ry = rc.viewH / 2 - margin;
  // Solve t for ellipse boundary
  const denom = Math.max(
    Math.abs(Math.cos(ang)) / rx,
    Math.abs(Math.sin(ang)) / ry,
  );
  const ex = cx + Math.cos(ang) / denom;
  const ey = cy + Math.sin(ang) / denom;
  // Distance label
  const wDist = Math.hypot(am.targetX - state.player.x, am.targetY - state.player.y);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  // Arrow body
  ctx.fillStyle = am.markerColor;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-6, -8);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Distance text
  ctx.save();
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(ex - 28, ey + 14, 56, 16);
  ctx.fillStyle = am.markerColor;
  ctx.fillText(`${Math.floor(wDist / 10)}m`, ex, ey + 25);
  ctx.restore();
}
