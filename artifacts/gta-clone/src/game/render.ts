// Rendering: world tiles, buildings, weather, lighting overlays
import type { GameState, Particle, Animal, Prop, BirdFlock, Human, Vehicle } from "./types";
import type { WorldData, Building } from "./world";
import { TILE } from "./world";
import { shadeHex, rand } from "./utils";
import { drawCar, drawHuman } from "./sprites";

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
        // ─── GRASS ──────────────────────────────────────────────────────────────
        case "grass": {
          const isForest = t.district === "forest";
          const isPark   = t.district === "park";
          const baseHex = isForest ? "#2e4d18" : isPark ? "#4a7028" : "#4a6e2a";
          const base = timeFilter(state.timeOfDay, baseHex);
          ctx.fillStyle = base;
          ctx.fillRect(px, py, TILE, TILE);

          // Two-tone ground speckle
          const dark = shadeHex(base, -18);
          const lite = shadeHex(base, 14);
          const speckleCount = isForest ? 24 : 22;
          for (let i = 0; i < speckleCount; i++) {
            const hh = ((h1 >> (i % 7)) ^ (h2 * (i + 1))) >>> 0;
            const sx = px + (hh % TILE);
            const sy = py + ((hh >> 5) % TILE);
            ctx.fillStyle = i % 3 === 0 ? lite : dark;
            ctx.fillRect(sx, sy, 1, 1);
          }

          // Lush undergrowth patches
          if (t.variant! >= 4) {
            for (let i = 0; i < 8; i++) {
              const hh = ((h3 * (i + 3)) ^ h1) >>> 0;
              const sx = px + (hh % (TILE - 3));
              const sy = py + ((hh >> 4) % (TILE - 3));
              ctx.fillStyle = shadeHex(base, -28);
              ctx.fillRect(sx, sy, 2, 2);
            }
          }

          // FOREST FLOOR DETAILS — ferns, fallen leaves, moss patches, rocks
          if (isForest) {
            // Fallen leaves (orange/brown)
            for (let i = 0; i < 5; i++) {
              const hh = ((h2 * (i * 7 + 1)) ^ h3) >>> 0;
              const lx = px + (hh % TILE);
              const ly = py + ((hh >> 5) % TILE);
              const leafColor = (hh % 3) === 0 ? "rgba(160,80,20,0.55)"
                              : (hh % 3) === 1 ? "rgba(130,100,30,0.45)"
                              :                  "rgba(90,60,15,0.5)";
              ctx.fillStyle = leafColor;
              ctx.beginPath();
              ctx.ellipse(lx, ly, 1.8, 1, (hh % 314) * 0.02, 0, Math.PI * 2);
              ctx.fill();
            }
            // Fern cluster (darker green tuft) — one per tile if hash agrees
            if ((h3 % 4) === 0) {
              const fx = px + 6 + (h1 % (TILE - 12));
              const fy = py + 6 + (h2 % (TILE - 12));
              ctx.fillStyle = timeFilter(state.timeOfDay, "#1a4a0a");
              for (let fi = 0; fi < 5; fi++) {
                const fa = (fi / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(fx + Math.cos(fa) * 4, fy + Math.sin(fa) * 3, 2.5, 1, fa, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            // Rock (gray lumpy shape)
            if ((h1 % 8) === 0) {
              const rx = px + 8 + (h3 % (TILE - 16));
              const ry = py + 8 + (h2 % (TILE - 16));
              ctx.fillStyle = timeFilter(state.timeOfDay, "#607060");
              ctx.beginPath();
              ctx.ellipse(rx, ry, 4, 3, (h1 % 31) * 0.1, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(255,255,255,0.14)";
              ctx.beginPath();
              ctx.ellipse(rx - 1, ry - 1, 2, 1.2, 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
            // Mushroom (tiny, red cap with dots)
            if ((h2 % 14) === 0) {
              const mx = px + 10 + (h1 % (TILE - 20));
              const my = py + 10 + (h3 % (TILE - 20));
              ctx.fillStyle = timeFilter(state.timeOfDay, "#c84020");
              ctx.beginPath();
              ctx.arc(mx, my, 2.5, Math.PI, 0);
              ctx.fill();
              ctx.fillStyle = "#e85828";
              ctx.beginPath();
              ctx.arc(mx, my, 2.5, Math.PI, 0);
              ctx.fill();
              // stem
              ctx.fillStyle = timeFilter(state.timeOfDay, "#e8d8b0");
              ctx.fillRect(mx - 0.7, my, 1.4, 2.5);
              // cap dots
              ctx.fillStyle = "rgba(255,255,255,0.7)";
              ctx.beginPath();
              ctx.arc(mx - 0.8, my - 0.6, 0.5, 0, Math.PI * 2);
              ctx.arc(mx + 0.8, my - 0.4, 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // TREES
          const treeChance = isForest ? 0.58 : isPark ? 0.30 : 0;
          if (treeChance > 0 && (h2 % 1000) / 1000 < treeChance) {
            const treeCX = px + 14 + (h1 % (TILE - 28));
            const treeCY = py + 14 + (h3 % (TILE - 28));
            const ageSeed = (h1 ^ h3) % 100;
            const isPine = isForest && (h1 % 3) === 0; // 1/3 of forest trees are pines

            const canopyR = isForest
              ? 15 + (ageSeed % 10)
              : 11 + (ageSeed % 7);

            // Shadow
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.beginPath();
            ctx.ellipse(treeCX + 5, treeCY + 7, canopyR * 0.85, canopyR * 0.42, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Trunk — thicker, more textured
            const trunkW = isPine ? 2.5 : 3.5;
            const trunkColor = isPine ? "#3a2818" : "#5a3a22";
            ctx.fillStyle = timeFilter(state.timeOfDay, trunkColor);
            ctx.beginPath();
            ctx.ellipse(treeCX, treeCY + canopyR * 0.3, trunkW, trunkW * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            // bark texture
            ctx.strokeStyle = timeFilter(state.timeOfDay, shadeHex(trunkColor, -20));
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(treeCX - 0.5, treeCY + canopyR * 0.15);
            ctx.lineTo(treeCX + 0.3, treeCY + canopyR * 0.45);
            ctx.stroke();

            if (isPine) {
              // PINE TREE — layered triangular tiers
              const pineColor = timeFilter(state.timeOfDay, "#1a4410");
              const tier = canopyR * 0.42;
              for (let ti = 0; ti < 3; ti++) {
                const ty = treeCY - ti * tier * 0.7 + tier * 0.4;
                const tr = canopyR * (1 - ti * 0.28);
                // Shadow tier
                ctx.fillStyle = shadeHex(pineColor, -18 + ti * 4);
                ctx.beginPath();
                ctx.moveTo(treeCX, ty - tr);
                ctx.lineTo(treeCX + tr, ty + tr * 0.5);
                ctx.lineTo(treeCX - tr, ty + tr * 0.5);
                ctx.closePath();
                ctx.fill();
                // Lit side (NW quadrant highlight)
                ctx.fillStyle = shadeHex(pineColor, 16 - ti * 4);
                ctx.beginPath();
                ctx.moveTo(treeCX, ty - tr);
                ctx.lineTo(treeCX, ty + tr * 0.5);
                ctx.lineTo(treeCX - tr * 0.6, ty + tr * 0.2);
                ctx.closePath();
                ctx.fill();
                // Snow cap on very top tier (variant)
                if (ti === 2 && ageSeed > 60) {
                  ctx.fillStyle = "rgba(240,248,255,0.5)";
                  ctx.beginPath();
                  ctx.moveTo(treeCX, ty - tr);
                  ctx.lineTo(treeCX + tr * 0.3, ty - tr * 0.3);
                  ctx.lineTo(treeCX - tr * 0.3, ty - tr * 0.3);
                  ctx.closePath();
                  ctx.fill();
                }
              }
            } else {
              // BROADLEAF TREE — round multi-layer canopy
              const canopyBase = isForest
                ? timeFilter(state.timeOfDay, "#1e4d12")
                : timeFilter(state.timeOfDay, "#2a5a18");

              // Outer shadow ring
              ctx.fillStyle = shadeHex(canopyBase, -18);
              ctx.beginPath();
              ctx.arc(treeCX, treeCY, canopyR, 0, Math.PI * 2);
              ctx.fill();

              // Main canopy
              ctx.fillStyle = canopyBase;
              ctx.beginPath();
              ctx.arc(treeCX - 2, treeCY - 1, canopyR * 0.8, 0, Math.PI * 2);
              ctx.fill();

              // Secondary cluster
              if (ageSeed % 3 !== 0) {
                ctx.fillStyle = shadeHex(canopyBase, 10);
                const offX = ((h2 % 9) - 4);
                const offY = ((h3 % 9) - 5);
                ctx.beginPath();
                ctx.arc(treeCX + offX, treeCY + offY, canopyR * 0.56, 0, Math.PI * 2);
                ctx.fill();
              }

              // Tertiary small cluster for old trees
              if (ageSeed > 70) {
                ctx.fillStyle = shadeHex(canopyBase, 6);
                ctx.beginPath();
                ctx.arc(treeCX + (h2 % 12) - 6, treeCY + (h3 % 10) - 5, canopyR * 0.38, 0, Math.PI * 2);
                ctx.fill();
              }

              // Top highlight
              ctx.fillStyle = timeFilter(state.timeOfDay, shadeHex(canopyBase, 32));
              ctx.beginPath();
              ctx.arc(treeCX - canopyR * 0.3, treeCY - canopyR * 0.32, canopyR * 0.3, 0, Math.PI * 2);
              ctx.fill();

              // Specular dot
              ctx.fillStyle = "rgba(255,255,255,0.2)";
              ctx.beginPath();
              ctx.arc(treeCX - canopyR * 0.36, treeCY - canopyR * 0.4, canopyR * 0.12, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }

        // ─── SIDEWALK ───────────────────────────────────────────────────────────
        case "sidewalk": {
          // Warm concrete base (beige-gray matching GTA2 reference)
          const swBase = timeFilter(state.timeOfDay, "#b4ab98");
          ctx.fillStyle = swBase;
          ctx.fillRect(px, py, TILE, TILE);

          // Concrete slab grid — 16px slabs (2×2 per TILE if TILE=32, or 4×4 if TILE=64)
          const slabSize = Math.max(16, TILE / 4);
          ctx.strokeStyle = timeFilter(state.timeOfDay, "#8a8278");
          ctx.lineWidth = 0.6;
          for (let i = 1; i < Math.ceil(TILE / slabSize); i++) {
            const o = i * slabSize;
            ctx.beginPath();
            ctx.moveTo(px + o, py);
            ctx.lineTo(px + o, py + TILE);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px, py + o);
            ctx.lineTo(px + TILE, py + o);
            ctx.stroke();
          }

          // Fine grit dots
          for (let i = 0; i < 14; i++) {
            const hh = ((h2 >> (i % 6)) ^ h3) >>> 0;
            const sx = px + (hh % TILE);
            const sy = py + ((hh >> 4) % TILE);
            ctx.fillStyle = i % 4 === 0
              ? "rgba(255,255,255,0.18)"
              : "rgba(0,0,0,0.12)";
            ctx.fillRect(sx, sy, 1, 1);
          }

          // Occasional crack (every ~12th tile)
          if ((h1 % 12) === 0) {
            ctx.strokeStyle = "rgba(0,0,0,0.18)";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(px + (h2 % TILE), py + (h1 % TILE));
            ctx.lineTo(px + (h3 % TILE), py + (h2 % TILE));
            ctx.stroke();
          }

          // Thin curb shadow at the road-facing edge — drawn by road tiles below,
          // but we add a subtle darkened edge on the sidewalk's inward border:
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fillRect(px, py, TILE, 1);        // top edge
          ctx.fillRect(px, py, 1, TILE);        // left edge
          break;
        }

        // ─── ROAD ───────────────────────────────────────────────────────────────
        case "road": {
          const asphalt = timeFilter(state.timeOfDay, "#2e3128");
          ctx.fillStyle = asphalt;
          ctx.fillRect(px, py, TILE, TILE);

          // Micro-grain texture
          for (let i = 0; i < 20; i++) {
            const hh = ((h1 * (i + 7)) ^ h2) >>> 0;
            const sx = px + (hh % TILE);
            const sy = py + ((hh >> 4) % TILE);
            ctx.fillStyle = i % 3 === 0 ? "#22251d" : i % 3 === 1 ? "#3a3e32" : "#26291f";
            ctx.fillRect(sx, sy, 1, 1);
          }

          // Occasional tar seam
          if ((h2 % 9) === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.15)";
            if (t.roadDir === "h") {
              ctx.fillRect(px, py + (h1 % (TILE - 4)), TILE, 1);
            } else {
              ctx.fillRect(px + (h1 % (TILE - 4)), py, 1, TILE);
            }
          }

          // Oil/rubber stain
          if ((h3 % 11) === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            const ox = px + (h1 % (TILE - 8)) + 4;
            const oy = py + (h2 % (TILE - 8)) + 4;
            ctx.beginPath();
            ctx.ellipse(ox, oy, 3 + (h3 % 3), 1.5 + (h3 % 2), (h1 % 6) * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // ── Lane markings ──
          // Center double-yellow divider (solid) + outer white dashes
          const lineColor = timeFilter(state.timeOfDay, "#d8d8c8");
          const centerYellow = timeFilter(state.timeOfDay, "#c8b040");

          ctx.setLineDash([]);
          ctx.lineWidth = 1;

          if (t.roadDir === "h") {
            // White edge shoulders
            ctx.strokeStyle = timeFilter(state.timeOfDay, "#b0b0a0");
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(px, py + 2); ctx.lineTo(px + TILE, py + 2);
            ctx.moveTo(px, py + TILE - 2); ctx.lineTo(px + TILE, py + TILE - 2);
            ctx.stroke();
            // White dashed lane dividers
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([10, 12]);
            ctx.beginPath();
            ctx.moveTo(px, py + TILE * 0.25); ctx.lineTo(px + TILE, py + TILE * 0.25);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px, py + TILE * 0.75); ctx.lineTo(px + TILE, py + TILE * 0.75);
            ctx.stroke();
            ctx.setLineDash([]);
            // Center yellow solid divider
            ctx.strokeStyle = centerYellow;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, py + TILE * 0.5 - 1); ctx.lineTo(px + TILE, py + TILE * 0.5 - 1);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px, py + TILE * 0.5 + 1); ctx.lineTo(px + TILE, py + TILE * 0.5 + 1);
            ctx.stroke();
          } else {
            ctx.strokeStyle = timeFilter(state.timeOfDay, "#b0b0a0");
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(px + 2, py); ctx.lineTo(px + 2, py + TILE);
            ctx.moveTo(px + TILE - 2, py); ctx.lineTo(px + TILE - 2, py + TILE);
            ctx.stroke();
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([10, 12]);
            ctx.beginPath();
            ctx.moveTo(px + TILE * 0.25, py); ctx.lineTo(px + TILE * 0.25, py + TILE);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px + TILE * 0.75, py); ctx.lineTo(px + TILE * 0.75, py + TILE);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = centerYellow;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + TILE * 0.5 - 1, py); ctx.lineTo(px + TILE * 0.5 - 1, py + TILE);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px + TILE * 0.5 + 1, py); ctx.lineTo(px + TILE * 0.5 + 1, py + TILE);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          break;
        }

        // ─── INTERSECTION ────────────────────────────────────────────────────────
        case "intersection": {
          const iAsphalt = timeFilter(state.timeOfDay, "#2a2d24");
          ctx.fillStyle = iAsphalt;
          ctx.fillRect(px, py, TILE, TILE);

          // Grain
          for (let i = 0; i < 16; i++) {
            const hh = ((h1 * (i + 3)) ^ h3) >>> 0;
            const sx = px + (hh % TILE);
            const sy = py + ((hh >> 4) % TILE);
            ctx.fillStyle = i % 2 === 0 ? "#1e211a" : "#363929";
            ctx.fillRect(sx, sy, 1, 1);
          }

          // Yellow box junction guide (inner box)
          ctx.strokeStyle = timeFilter(state.timeOfDay, "#a89030");
          ctx.lineWidth = 0.8;
          ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);

          // White stop-line bars at each approach — shorter/thinner for less prominence
          const barColor = timeFilter(state.timeOfDay, "#b8b8a8");
          ctx.fillStyle = barColor;
          const barW = 2;
          const barInset = TILE * 0.15;
          const barLen = TILE - barInset * 2;
          ctx.fillRect(px + barInset, py, barLen, barW);              // N
          ctx.fillRect(px + barInset, py + TILE - barW, barLen, barW); // S
          ctx.fillRect(px, py + barInset, barW, barLen);              // W
          ctx.fillRect(px + TILE - barW, py + barInset, barW, barLen); // E

          // Painted lane arrow
          const arrowDir = h2 % 4;
          const cx2 = px + TILE / 2;
          const cy2 = py + TILE / 2;
          ctx.save();
          ctx.translate(cx2, cy2);
          ctx.rotate([Math.PI * 1.5, 0, Math.PI * 0.5, Math.PI][arrowDir]!);
          ctx.fillStyle = "rgba(190,190,170,0.28)";
          ctx.fillRect(-1.5, -6, 3, 10);
          ctx.beginPath();
          ctx.moveTo(0, -9); ctx.lineTo(-3.5, -5); ctx.lineTo(3.5, -5);
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }

        // ─── CROSSWALK ───────────────────────────────────────────────────────────
        case "crosswalk": {
          const cwBase = timeFilter(state.timeOfDay, "#30332a");
          ctx.fillStyle = cwBase;
          ctx.fillRect(px, py, TILE, TILE);
          // Zebra stripes — stripes run PARALLEL to the road direction
          // so pedestrians walk perpendicular to traffic between them
          ctx.fillStyle = timeFilter(state.timeOfDay, "#c8c8b0");
          const stripeW = 4;
          const gap = 6;
          if (t.roadDir === "h") {
            // Horizontal road → stripes run horizontally (pedestrians cross N/S)
            for (let i = 0; i < 5; i++) {
              ctx.fillRect(px + 4, py + 4 + i * (stripeW + gap), TILE - 8, stripeW);
            }
          } else {
            // Vertical road → stripes run vertically (pedestrians cross E/W)
            for (let i = 0; i < 5; i++) {
              ctx.fillRect(px + 4 + i * (stripeW + gap), py + 4, stripeW, TILE - 8);
            }
          }
          break;
        }

        // ─── PARKING LOT ──────────────────────────────────────────────────────
        case "parking": {
          // Dark asphalt with white parking space lines
          const pkBase = timeFilter(state.timeOfDay, "#2c2f28");
          ctx.fillStyle = pkBase;
          ctx.fillRect(px, py, TILE, TILE);
          // Subtle grain
          for (let i = 0; i < 12; i++) {
            const hh = ((h1 * (i + 5)) ^ h2) >>> 0;
            const sx = px + (hh % TILE);
            const sy = py + ((hh >> 4) % TILE);
            ctx.fillStyle = i % 2 === 0 ? "#252822" : "#373b30";
            ctx.fillRect(sx, sy, 1, 1);
          }
          // Parking stall lines (white/cream)
          ctx.strokeStyle = timeFilter(state.timeOfDay, "#b0b09a");
          ctx.lineWidth = 1;
          ctx.beginPath();
          // Side lines every ~20px
          for (let i = 0; i <= 3; i++) {
            const ox = px + i * (TILE / 3);
            ctx.moveTo(ox, py + 4); ctx.lineTo(ox, py + TILE - 4);
          }
          // Horizontal mid cap line
          ctx.moveTo(px + 2, py + TILE / 2); ctx.lineTo(px + TILE - 2, py + TILE / 2);
          ctx.stroke();
          break;
        }

        // ─── BUILDING FOOTPRINT ─────────────────────────────────────────────────
        case "building": {
          // Flat dark fill — the drawBuilding() call above replaces this
          ctx.fillStyle = timeFilter(state.timeOfDay, "#282822");
          ctx.fillRect(px, py, TILE, TILE);
          break;
        }

        // ─── WATER ──────────────────────────────────────────────────────────────
        case "water": {
          const tt2 = performance.now() / 1000;
          const wBase = timeFilter(state.timeOfDay, "#0c2840");
          // Depth gradient — slightly lighter toward edges
          const wGrad = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
          wGrad.addColorStop(0, shadeHex(wBase, 8));
          wGrad.addColorStop(1, wBase);
          ctx.fillStyle = wGrad;
          ctx.fillRect(px, py, TILE, TILE);

          // Slow animated wave lines — offset per tile for tiling variety
          const waveSeed = (x * 3 + y * 5);
          for (let i = 0; i < 5; i++) {
            const oy = py + 4 + i * 11 + Math.sin(tt2 * 0.65 + waveSeed * 0.3 + i * 0.9) * 3;
            const waveAlpha = 0.12 + Math.sin(tt2 * 0.8 + i * 1.1 + waveSeed * 0.2) * 0.08;
            ctx.globalAlpha = Math.max(0, waveAlpha);
            ctx.strokeStyle = "rgba(80,170,230,1)";
            ctx.lineWidth = i % 2 === 0 ? 1 : 0.5;
            ctx.beginPath();
            // Slightly curved wave lines
            const cx1 = px + TILE * 0.25;
            const cx2 = px + TILE * 0.75;
            const wcy = Math.sin(tt2 * 0.5 + i + waveSeed * 0.15) * 1.5;
            ctx.moveTo(px, oy);
            ctx.bezierCurveTo(cx1, oy + wcy, cx2, oy - wcy, px + TILE, oy);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;

          // Foam cap at wave crests — tiny bright flecks
          for (let i = 0; i < 3; i++) {
            const hh = ((h1 * (i + 1)) ^ h2) >>> 0;
            const fx = px + (hh % TILE);
            const fy = py + 3 + i * 11 + Math.sin(tt2 * 0.7 + waveSeed * 0.25 + i) * 3;
            ctx.fillStyle = `rgba(255,255,255,${0.08 + (hh % 10) * 0.012})`;
            ctx.fillRect(fx, fy, 1 + (hh % 3), 0.5);
          }

          // Multiple specular glints (sunlight on water)
          for (let gi = 0; gi < 3; gi++) {
            const ghh = ((h1 * (gi + 2)) ^ h3) >>> 0;
            const gxp = px + (ghh % TILE);
            const gyp = py + 3 + ((ghh >> 4) % (TILE - 6));
            const glintAlpha = 0.1 + Math.sin(tt2 * 1.5 + gi * 2.3 + waveSeed * 0.4) * 0.08;
            ctx.fillStyle = `rgba(200,240,255,${Math.max(0, glintAlpha)})`;
            ctx.fillRect(gxp, gyp, 2 + gi, 1);
          }
          break;
        }

        // ─── SAND / BEACH ────────────────────────────────────────────────────────
        case "sand": {
          const sandTone = (h1 % 30) - 15;
          const sBase = timeFilter(state.timeOfDay, shadeHex("#ccb47a", sandTone));
          ctx.fillStyle = sBase;
          ctx.fillRect(px, py, TILE, TILE);

          // Tide ripple bands
          for (let i = 0; i < 5; i++) {
            const hh = ((h2 * (i + 1)) ^ h3) >>> 0;
            const ry2 = py + (hh % TILE);
            const rw2 = 8 + (hh >> 8) % 22;
            const rx2 = px + (hh >> 3) % Math.max(1, TILE - rw2);
            ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.13)";
            ctx.fillRect(rx2, ry2, rw2, 1);
          }

          // Fine grain speckle
          for (let i = 0; i < 24; i++) {
            const hh = ((h1 >> (i % 6)) ^ (h3 * i)) >>> 0;
            const sx = px + (hh % TILE);
            const sy = py + ((hh >> 4) % TILE);
            ctx.fillStyle = i % 4 === 0
              ? "rgba(155,110,55,0.2)"
              : i % 4 === 1
                ? "rgba(255,240,190,0.18)"
                : "rgba(0,0,0,0.06)";
            ctx.fillRect(sx, sy, 1, 1);
          }

          // Shells & pebbles
          if ((h3 % 5) === 0) {
            const sx = px + 8 + (h1 % (TILE - 16));
            const sy2 = py + 8 + (h2 % (TILE - 16));
            // Shell shape (two overlapping ellipses)
            ctx.fillStyle = "rgba(225,205,165,0.9)";
            ctx.beginPath();
            ctx.ellipse(sx, sy2, 3.5, 2, (h1 % 100) * 0.063, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(180,150,100,0.6)";
            ctx.beginPath();
            ctx.ellipse(sx + 1, sy2, 2, 1.2, (h1 % 100) * 0.063, 0, Math.PI * 2);
            ctx.fill();
            // Ridge lines on shell
            ctx.strokeStyle = "rgba(140,105,65,0.45)";
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(sx - 3, sy2);
            ctx.lineTo(sx + 3, sy2);
            ctx.stroke();
          }
          // Extra pebble cluster
          if ((h1 % 9) === 0) {
            const px2 = px + 4 + (h3 % (TILE - 8));
            const py2 = py + 4 + (h2 % (TILE - 8));
            ctx.fillStyle = "rgba(160,140,110,0.7)";
            for (let pi = 0; pi < 3; pi++) {
              const ph = ((h1 * (pi + 1)) ^ h2) >>> 0;
              ctx.beginPath();
              ctx.arc(px2 + (ph % 8) - 4, py2 + ((ph >> 4) % 6) - 3, 1 + (ph % 2), 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Footprints (stable per tile, two-step pattern)
          if ((h2 % 6) === 0) {
            const fpx = px + 10 + (h1 % (TILE - 20));
            const fpy = py + 10 + (h3 % (TILE - 20));
            const fpAngle = (h2 % 628) * 0.01;
            ctx.fillStyle = "rgba(160,130,80,0.35)";
            for (let fi = 0; fi < 3; fi++) {
              const fx = fpx + Math.cos(fpAngle) * fi * 7;
              const fy = fpy + Math.sin(fpAngle) * fi * 7;
              const side = fi % 2 === 0 ? -1 : 1;
              ctx.beginPath();
              ctx.ellipse(fx + Math.sin(fpAngle) * side * 2.5,
                          fy - Math.cos(fpAngle) * side * 2.5,
                          2.5, 1.4, fpAngle, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Check for water neighbours — draw wet sand edge + animated foam
          const wN = world.tiles[y - 1]?.[x]?.type === "water";
          const wS = world.tiles[y + 1]?.[x]?.type === "water";
          const wW = world.tiles[y]?.[x - 1]?.type === "water";
          const wE = world.tiles[y]?.[x + 1]?.type === "water";
          if (wN || wS || wW || wE) {
            const tt3 = performance.now() / 1000;
            // Multi-gradient wet sand (3 bands getting progressively darker)
            const wetDark = timeFilter(state.timeOfDay, "#8a7040");
            const wetMid  = timeFilter(state.timeOfDay, "#a08050");
            if (wN) {
              ctx.fillStyle = wetDark;  ctx.fillRect(px, py, TILE, 4);
              ctx.fillStyle = wetMid;   ctx.fillRect(px, py + 4, TILE, 5);
            }
            if (wS) {
              ctx.fillStyle = wetDark;  ctx.fillRect(px, py + TILE - 4, TILE, 4);
              ctx.fillStyle = wetMid;   ctx.fillRect(px, py + TILE - 9, TILE, 5);
            }
            if (wW) {
              ctx.fillStyle = wetDark;  ctx.fillRect(px, py, 4, TILE);
              ctx.fillStyle = wetMid;   ctx.fillRect(px + 4, py, 5, TILE);
            }
            if (wE) {
              ctx.fillStyle = wetDark;  ctx.fillRect(px + TILE - 4, py, 4, TILE);
              ctx.fillStyle = wetMid;   ctx.fillRect(px + TILE - 9, py, 5, TILE);
            }

            // Animated foam line at the water edge — pulses in/out
            const foamAlpha = 0.22 + Math.sin(tt3 * 1.2 + (x + y) * 0.5) * 0.12;
            ctx.fillStyle = `rgba(255,255,255,${Math.max(0, foamAlpha)})`;
            if (wN) ctx.fillRect(px, py, TILE, 2);
            if (wS) ctx.fillRect(px, py + TILE - 2, TILE, 2);
            if (wW) ctx.fillRect(px, py, 2, TILE);
            if (wE) ctx.fillRect(px + TILE - 2, py, 2, TILE);

            // Foam speckles along edge
            for (let fi = 0; fi < 6; fi++) {
              const fhh = ((h1 * (fi + 1)) ^ h2) >>> 0;
              const foa = 0.15 + Math.sin(tt3 * 1.8 + fi * 1.7 + (x * 2 + y)) * 0.1;
              ctx.fillStyle = `rgba(255,255,255,${Math.max(0, foa)})`;
              if (wN) ctx.fillRect(px + (fhh % TILE), py + 2, 3 + (fhh % 6), 1);
              if (wS) ctx.fillRect(px + (fhh % TILE), py + TILE - 3, 3 + (fhh % 5), 1);
            }
          }

          // BEACH AMENITIES — palm tree, umbrella (stable per tile)
          if ((h1 % 12) === 0 && !(wN || wS || wW || wE)) {
            // Palm tree
            const ptx = px + 10 + (h3 % (TILE - 20));
            const pty = py + 10 + (h2 % (TILE - 20));
            // Shadow
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            ctx.beginPath();
            ctx.ellipse(ptx + 6, pty + 4, 8, 3, 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Trunk (slightly curved)
            ctx.strokeStyle = timeFilter(state.timeOfDay, "#7a5828");
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(ptx, pty + 16);
            ctx.bezierCurveTo(ptx - 1, pty + 8, ptx + 2, pty + 4, ptx + 1, pty);
            ctx.stroke();
            // Fronds
            const frondColor = timeFilter(state.timeOfDay, "#2a6a18");
            for (let fi = 0; fi < 6; fi++) {
              const fa = (fi / 6) * Math.PI * 2;
              ctx.strokeStyle = frondColor;
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(ptx + 1, pty);
              const ex = ptx + 1 + Math.cos(fa) * 11;
              const ey = pty + Math.sin(fa) * 6 - 2;
              ctx.bezierCurveTo(
                ptx + 1 + Math.cos(fa) * 5, pty + Math.sin(fa) * 3 - 1,
                ex - Math.cos(fa) * 2, ey,
                ex, ey
              );
              ctx.stroke();
              // Leaf tip
              ctx.fillStyle = shadeHex(frondColor, -10);
              ctx.beginPath();
              ctx.ellipse(ex, ey, 2.5, 1, fa, 0, Math.PI * 2);
              ctx.fill();
            }
            // Coconuts
            ctx.fillStyle = timeFilter(state.timeOfDay, "#7a5020");
            ctx.beginPath();
            ctx.arc(ptx + 2, pty + 1, 2, 0, Math.PI * 2);
            ctx.arc(ptx - 1, pty + 2, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
          // Beach umbrella & towel
          if ((h2 % 15) === 1 && !(wN || wS || wW || wE)) {
            const ubx = px + 8 + (h1 % (TILE - 16));
            const uby = py + 8 + (h3 % (TILE - 16));
            // Towel
            const towelColors = ["#e04040", "#4060e0", "#e0c020", "#20a040"];
            ctx.fillStyle = towelColors[(h1 % 4)];
            ctx.beginPath();
            ctx.roundRect(ubx - 6, uby + 2, 12, 8, 1);
            ctx.fill();
            // Pole
            ctx.strokeStyle = "#c0c0c0";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ubx, uby + 4);
            ctx.lineTo(ubx, uby - 8);
            ctx.stroke();
            // Canopy
            const umbColors = ["#e86030", "#3080e8", "#e8d030", "#28b850"];
            ctx.fillStyle = umbColors[(h2 % 4)];
            ctx.beginPath();
            ctx.moveTo(ubx - 9, uby - 5);
            ctx.lineTo(ubx, uby - 10);
            ctx.lineTo(ubx + 9, uby - 5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = shadeHex(umbColors[(h2 % 4)], -20);
            ctx.beginPath();
            ctx.moveTo(ubx - 9, uby - 5);
            ctx.lineTo(ubx, uby - 8);
            ctx.lineTo(ubx + 0, uby - 5);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }

        // ─── PLAZA / PAVEMENT ───────────────────────────────────────────────────
        case "plaza": {
          // Cool stone — alternating 2-tone tiles for a checker-light effect
          const pBase = timeFilter(state.timeOfDay, "#9c9890");
          const pAlt = shadeHex(pBase, -12);
          const half = TILE / 2;
          // 4 quadrants, checkerboard-light (not full chess contrast, just subtle)
          for (let qy = 0; qy < 2; qy++) {
            for (let qx = 0; qx < 2; qx++) {
              ctx.fillStyle = (qx + qy) % 2 === 0 ? pBase : pAlt;
              ctx.fillRect(px + qx * half, py + qy * half, half, half);
            }
          }

          // Thin grout lines
          ctx.strokeStyle = shadeHex(pBase, -30);
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(px + half, py); ctx.lineTo(px + half, py + TILE);
          ctx.moveTo(px, py + half); ctx.lineTo(px + TILE, py + half);
          ctx.stroke();

          // Outer edge
          ctx.strokeStyle = shadeHex(pBase, -22);
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);

          // Subtle grit
          for (let i = 0; i < 8; i++) {
            const hh = ((h2 * (i + 2)) ^ h3) >>> 0;
            const sx = px + (hh % TILE);
            const sy = py + ((hh >> 5) % TILE);
            ctx.fillStyle = "rgba(0,0,0,0.07)";
            ctx.fillRect(sx, sy, 1, 1);
          }
          break;
        }
      } // end switch

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

  // 1. COLLECT ALL DRAWABLES FOR DEPTH SORTING
  // This is critical for top-down games with height: objects with higher Y (closer to bottom) 
  // must draw later. We now include buildings in this list to prevent cars/humans 
  // from "driving through" or "walking on top of" building walls.
  interface Drawable { y: number; draw: () => void; shadow?: () => void; }
  const drawables: Drawable[] = [];
  const isNightOrDusk = state.timeOfDay === "night" || state.timeOfDay === "dusk";
  const viewRect = {
    minX: cam.x - rc.viewW / 2 / cam.zoom - 100,
    maxX: cam.x + rc.viewW / 2 / cam.zoom + 100,
    minY: cam.y - rc.viewH / 2 / cam.zoom - 100,
    maxY: cam.y + rc.viewH / 2 / cam.zoom + 100
  };

  // Vehicles
  for (const v of state.vehicles) {
    if (v.x < viewRect.minX || v.x > viewRect.maxX || v.y < viewRect.minY || v.y > viewRect.maxY) continue;
    drawables.push({
      y: v.y,
      shadow: () => drawCarShadow(ctx, v, 3, 4),
      draw: () => drawCar(rc.ctx, v, isNightOrDusk)
    });
  }
  // Humans
  for (const h of state.humans) {
    if (h.inVehicle) continue;
    if (h.x < viewRect.minX || h.x > viewRect.maxX || h.y < viewRect.minY || h.y > viewRect.maxY) continue;
    drawables.push({
      y: h.y,
      shadow: () => drawHumanShadow(ctx, h, 1.5, 2),
      draw: () => drawHuman(rc.ctx, h)
    });
  }
  // Animals
  for (const a of state.animals) {
    if (a.x < viewRect.minX || a.x > viewRect.maxX || a.y < viewRect.minY || a.y > viewRect.maxY) continue;
    drawables.push({
      y: a.y,
      shadow: () => drawAnimalShadow(ctx, a),
      draw: () => drawAnimal(rc.ctx, a)
    });
  }
  // Props
  for (const p of state.props) {
    if (p.x < viewRect.minX || p.x > viewRect.maxX || p.y < viewRect.minY || p.y > viewRect.maxY) continue;
    drawables.push({
      y: p.y,
      shadow: () => drawPropShadow(ctx, p),
      draw: () => drawProp(rc.ctx, p, state)
    });
  }
  // Buildings & Shops
  for (const b of world.buildings) {
    const bx = b.x * TILE;
    const by = (b.y + b.h) * TILE; // Use base Y for sorting
    const bw = b.w * TILE;
    if (bx + bw < viewRect.minX || bx > viewRect.maxX || (b.y * TILE) - 150 > viewRect.maxY || by < viewRect.minY) continue;

    drawables.push({
      y: by, // Sort by bottom edge
      shadow: () => drawBuildingShadow(ctx, b, state),
      draw: () => {
        drawBuilding(ctx, b, state);
        if (b.shopId !== undefined) {
          const shop = world.shops.find((s) => s.id === b.shopId);
          if (shop) drawShopFront(ctx, shop, b, state);
        }
      }
    });
  }

  // 2. DRAW SHADOWS
  for (const d of drawables) {
    if (d.shadow) d.shadow();
  }

  // 3. DRAW BODIES (Sorted by Y)
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    d.draw();
  }

  // Bird flocks fly ABOVE everything (no depth sorting with buildings)
  for (const f of state.birdFlocks) drawBirdFlockShadow(ctx, f);
  for (const f of state.birdFlocks) drawBirdFlock(ctx, f);

  // Bullets (Above bodies)
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

  // Particles & Weather
  drawParticles(ctx, state.particles);
  if (state.weather === "rain" || state.weather === "storm") drawRain(ctx, state, rc);

  // Traffic Lights & Markers
  // These are also world-space but sit above the ground layer
  drawTrafficLights(rc);
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
  // Shadow is cast in the OPPOSITE direction of the roof extrusion (SE direction)
  const wallLen = b.height * 0.26;
  const sx = wallLen * 0.48;  // shadow goes right (east)
  const sy = wallLen * 0.82;  // shadow goes down (south)
  const alpha = state.timeOfDay === "night" ? 0.22 : state.timeOfDay === "dusk" ? 0.35 : 0.42;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(px, py + h);
  ctx.lineTo(px + w, py + h);
  ctx.lineTo(px + w + sx, py + h + sy);
  ctx.lineTo(px + sx, py + h + sy);
  ctx.closePath();
  ctx.fill();
  // Right side shadow sliver
  ctx.beginPath();
  ctx.moveTo(px + w, py);
  ctx.lineTo(px + w + sx, py + sy);
  ctx.lineTo(px + w + sx, py + h + sy);
  ctx.lineTo(px + w, py + h);
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

  // FIXED NW LIGHTING: roof always extruded upper-left so walls are consistent
  // regardless of camera position. extX<0 → right (east) wall visible.
  // extY<0 → bottom (south) wall visible. This is the GTA1 top-down convention.
  const wallLen = b.height * 0.26;
  const extX = -wallLen * 0.48;
  const extY = -wallLen * 0.82;

  const wallColor = timeFilter(state.timeOfDay, b.color);
  const roofColor = timeFilter(state.timeOfDay, b.roofColor);
  const dark = shadeHex(wallColor, -42);
  const vDark = shadeHex(wallColor, -62);
  const isNight = state.timeOfDay === "night";

  const rx = px + extX;
  const ry = py + extY;
  const rw = w;
  const rh = h;

  // Draw a filled wall quad between two edge segments
  const drawWall = (
    x1: number, y1: number, x2: number, y2: number,
    nx1: number, ny1: number, nx2: number, ny2: number,
    color: string,
  ) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.lineTo(nx2, ny2); ctx.lineTo(nx1, ny1);
    ctx.closePath();
    ctx.fill();
    // Edge line for crispness
    ctx.strokeStyle = vDark;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(nx1, ny1); ctx.lineTo(nx2, ny2);
    ctx.stroke();
  };

  // 1. SIDE WALLS (always same sides due to fixed lighting)
  // Right wall (east face — darker, facing away from NW sun)
  const eastColor = shadeHex(dark, -8);
  drawWall(px + w, py, px + w, py + h, rx + rw, ry + rh, rx + rw, ry, eastColor);

  // Floor lines on east wall
  {
    const wallH = Math.abs(ry - py);
    if (wallH > 6) {
      const floors = Math.max(1, Math.min(8, Math.floor(b.height / 18)));
      ctx.strokeStyle = shadeHex(eastColor, -20);
      ctx.lineWidth = 0.4;
      for (let i = 1; i <= floors; i++) {
        const t = i / (floors + 1);
        ctx.beginPath();
        ctx.moveTo(px + w, py + h * t);
        ctx.lineTo(rx + rw, ry + rh * t);
        ctx.stroke();
      }
      // Windows on east wall
      const winRows = Math.max(1, Math.floor(b.height / 20));
      const winCols = Math.max(1, Math.floor(h / 18));
      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < winCols; c++) {
          const t = (c + 0.5) / winCols;
          const s = (r + 0.3) / winRows;
          const wy1 = py + h * t;
          const wx1 = px + w + (rx + rw - px - w) * s;
          const wy2 = ry + rh * t;
          const wx2 = rx + rw + (rx + rw - px - w) * s;
          const lit = isNight && ((b.id * 7 + r * 3 + c) % 5) === 0;
          ctx.fillStyle = lit ? "rgba(255,210,120,0.85)" : "rgba(0,0,0,0.35)";
          ctx.beginPath();
          ctx.moveTo(wx1, wy1 - 2); ctx.lineTo(wx1 + 3, wy1 - 2);
          ctx.lineTo(wx2 + 3, wy2 - 2); ctx.lineTo(wx2, wy2 - 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // Bottom wall (south face — slightly lighter, partially facing NW sun)
  const southColor = shadeHex(dark, 6);
  drawWall(px, py + h, px + w, py + h, rx + rw, ry + rh, rx, ry + rh, southColor);

  // Floor lines + windows on south wall
  {
    const wallH = Math.abs(ry + rh - py - h);
    if (wallH > 4) {
      const floors = Math.max(1, Math.min(8, Math.floor(b.height / 18)));
      ctx.strokeStyle = shadeHex(southColor, -20);
      ctx.lineWidth = 0.4;
      for (let i = 1; i <= floors; i++) {
        const t = i / (floors + 1);
        ctx.beginPath();
        ctx.moveTo(px + w * t, py + h);
        ctx.lineTo(rx + rw * t, ry + rh);
        ctx.stroke();
      }
      // Windows on south wall
      const winCols = Math.max(1, Math.floor(w / 18));
      const winRows = Math.max(1, Math.floor(b.height / 20));
      for (let c = 0; c < winCols; c++) {
        for (let r = 0; r < winRows; r++) {
          const tC = (c + 0.5) / winCols;
          const tR = (r + 0.3) / winRows;
          const wx = px + w * tC;
          const wy = py + h;
          const wnx = rx + rw * tC;
          const wny = ry + rh;
          const wallOffY = (ry + rh - py - h) * tR;
          const lit = isNight && ((b.id * 13 + c * 5 + r) % 6) === 0;
          ctx.fillStyle = lit ? "rgba(255,215,110,0.8)" : "rgba(0,0,0,0.32)";
          ctx.beginPath();
          ctx.moveTo(wx - 2, wy + wallOffY);
          ctx.lineTo(wx + 2, wy + wallOffY);
          ctx.lineTo(wnx + 2, wny + wallOffY * 0);
          ctx.lineTo(wnx - 2, wny + wallOffY * 0);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // 2. ROOF
  const roofGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
  roofGrad.addColorStop(0, shadeHex(roofColor, 12));
  roofGrad.addColorStop(0.5, roofColor);
  roofGrad.addColorStop(1, shadeHex(roofColor, -18));
  ctx.fillStyle = roofGrad;
  ctx.fillRect(rx, ry, rw, rh);

  // Parapet ledge
  ctx.strokeStyle = vDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(rx, ry, rw, 2);
  ctx.fillRect(rx, ry, 2, rh);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(rx, ry + rh - 2, rw, 2);
  ctx.fillRect(rx + rw - 2, ry, 2, rh);

  // Roof details for larger buildings
  if (rw > 48 && rh > 48) {
    // HVAC unit
    ctx.fillStyle = shadeHex(roofColor, -28);
    ctx.fillRect(rx + rw * 0.58, ry + rh * 0.28, 14, 10);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(rx + rw * 0.58 + 2, ry + rh * 0.28 + 2, 10, 6);
    // Antenna / vent stack
    if ((b.id % 3) === 0) {
      ctx.fillStyle = shadeHex(roofColor, -40);
      ctx.fillRect(rx + rw * 0.2 - 1, ry + rh * 0.2 - 1, 3, 3);
      ctx.fillStyle = "rgba(255,60,60,0.7)";
      ctx.fillRect(rx + rw * 0.2, ry + rh * 0.2 - 6, 1, 6);
    }
    // Water tower
    if ((b.id % 5) === 1 && rw > 80) {
      const tx = rx + rw * 0.75;
      const ty = ry + rh * 0.6;
      ctx.fillStyle = "#4a3820";
      ctx.fillRect(tx - 4, ty - 2, 8, 8);
      ctx.fillStyle = "#6a5230";
      ctx.beginPath();
      ctx.arc(tx, ty - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Neon sign on roof edge (for buildings with hasNeon)
  if (b.hasNeon && isNight) {
    const t = performance.now() / 400;
    const pulse = 0.5 + 0.5 * Math.sin(t + b.id);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = b.neonColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4 + pulse * 0.35;
    ctx.strokeRect(rx + 3, ry + 3, rw - 6, rh - 6);
    ctx.restore();
  }

  // Gravel noise on roof
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  for (let i = 0; i < (rw * rh) / 90; i++) {
    const gx = rx + ((b.id * 17 + i * 23) % Math.max(1, rw));
    const gy = ry + ((b.id * 11 + i * 19) % Math.max(1, rh));
    ctx.fillRect(gx, gy, 1, 1);
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
function drawPropShadow(ctx: CanvasRenderingContext2D, p: Prop) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
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
}

function drawProp(ctx: CanvasRenderingContext2D, p: Prop, state: GameState) {
  const night = state.timeOfDay === "night";
  const snowing = state.weather === "snow";

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

function drawCarShadow(ctx: CanvasRenderingContext2D, v: Vehicle, ox = 3, oy = 4) {
  ctx.save();
  ctx.translate(v.x + ox, v.y + oy);
  ctx.rotate(v.angle);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.roundRect(-v.length / 2, -v.width / 2, v.length, v.width, 4);
  ctx.fill();
  ctx.restore();
}

function drawHumanShadow(ctx: CanvasRenderingContext2D, h: Human, ox = 1.5, oy = 2) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(h.x + ox, h.y + oy, 3.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const lift = a.flyZ * 12;
  ctx.translate(a.x, a.y - lift);
  ctx.rotate(a.angle);

  if (a.hp <= 0) {
    // Flattened body + blood pool
    ctx.fillStyle = "rgba(100,40,40,0.55)";
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = a.furColor;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  const walk = Math.sin(a.walkPhase);
  const color = a.furColor;
  const dark  = shadeHex(color, -22);
  const lite  = shadeHex(color, 18);

  // Helper: draw a quadruped leg (front/rear × left/right)
  const leg = (bx: number, by: number, swing: number, len = 5) => {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + swing * 1.5, by + len);
    ctx.stroke();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(bx + swing * 1.5, by + len, 1, 0, Math.PI * 2);
    ctx.fill();
  };

  if (a.kind === "deer") {
    // DEER — elegant body, long neck, antlers
    const lW = walk * 2.5;
    // Four legs
    leg(-5, 3,  lW, 6);
    leg(-2, 3, -lW, 6);
    leg( 2, 3,  lW, 6);
    leg( 5, 3, -lW, 6);
    // Body
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.5, -0.1, 0, Math.PI * 2); ctx.fill();
    // Body highlight
    ctx.fillStyle = lite;
    ctx.beginPath(); ctx.ellipse(-1, -1.5, 5, 2.5, -0.1, 0, Math.PI * 2); ctx.fill();
    // White belly patch
    ctx.fillStyle = "rgba(255,240,210,0.6)";
    ctx.beginPath(); ctx.ellipse(0, 1.5, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
    // Neck
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(6, -2.5);
    ctx.rotate(-0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Head
    ctx.save();
    ctx.translate(9.5, -4.5);
    ctx.rotate(-0.3);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 2.4, 0.2, 0, Math.PI * 2); ctx.fill();
    // Snout
    ctx.fillStyle = shadeHex(color, -10);
    ctx.beginPath(); ctx.ellipse(2.5, 0.4, 1.5, 1.1, 0.1, 0, Math.PI * 2); ctx.fill();
    // Nostril
    ctx.fillStyle = "#2a1a0a";
    ctx.beginPath(); ctx.arc(3.2, 0.3, 0.35, 0, Math.PI * 2); ctx.fill();
    // Eye
    ctx.fillStyle = "#1a0a00";
    ctx.beginPath(); ctx.arc(0.5, -0.8, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(0.7, -1.0, 0.22, 0, Math.PI * 2); ctx.fill();
    // Ears
    ctx.fillStyle = lite;
    ctx.beginPath();
    ctx.moveTo(-0.5, -1.5); ctx.lineTo(-1.5, -4.5); ctx.lineTo(0.8, -2.2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d89090";
    ctx.beginPath();
    ctx.moveTo(-0.3, -1.8); ctx.lineTo(-1.2, -3.8); ctx.lineTo(0.5, -2.2);
    ctx.closePath(); ctx.fill();
    // Antlers (buck — breed > 1)
    if (a.breed > 1) {
      ctx.strokeStyle = "#4a3218"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-0.5, -2); ctx.lineTo(-1.5, -6); ctx.lineTo(-3.5, -5);
      ctx.moveTo(-1.5, -6); ctx.lineTo(-1, -8.5); ctx.lineTo(0, -7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1, -1.8); ctx.lineTo(2, -5.5); ctx.lineTo(4, -4.5);
      ctx.moveTo(2, -5.5); ctx.lineTo(2, -8); ctx.lineTo(3.5, -6.5);
      ctx.stroke();
    }
    ctx.restore();
    // Tail (white tuft)
    ctx.fillStyle = "#f0e8d8";
    ctx.beginPath(); ctx.ellipse(-8, -1, 2, 1.5, 0.4, 0, Math.PI * 2); ctx.fill();

  } else if (a.kind === "bear") {
    // BEAR — massive, hunched
    const lW = walk * 1.8;
    // Four thick legs
    leg(-6, 5,  lW, 5); leg(-3, 5, -lW, 5);
    leg( 3, 5,  lW, 5); leg( 6, 5, -lW, 5);
    // Body — large rounded rectangle
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 1, 12, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-1, 0, 11, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    // Fur texture (dark streak lines)
    ctx.strokeStyle = dark; ctx.lineWidth = 0.6;
    for (let fi = -3; fi <= 3; fi++) {
      ctx.beginPath();
      ctx.moveTo(fi * 3, -7); ctx.lineTo(fi * 2.5, 7);
      ctx.stroke();
    }
    // Head
    ctx.save(); ctx.translate(11, -1);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    // Snout
    ctx.fillStyle = shadeHex(color, -10);
    ctx.beginPath(); ctx.ellipse(4.5, 0.5, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0606";
    ctx.beginPath(); ctx.arc(5.8, 0.3, 0.7, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath(); ctx.arc(2, -2.5, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.arc(2.3, -2.8, 0.3, 0, Math.PI * 2); ctx.fill();
    // Ears
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-2.5, -4.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -4.8, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(-2.5, -4.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -4.8, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Claws
    ctx.strokeStyle = "#1a1010"; ctx.lineWidth = 0.8;
    [[-9, 9], [-5, 10], [5, 9], [9, 10]].forEach(([cx, cy]) => {
      ctx.beginPath();
      for (let ci = 0; ci < 3; ci++) {
        ctx.moveTo(cx + ci * 1.2 - 1.5, cy);
        ctx.lineTo(cx + ci * 1.2 - 1.8, cy + 2.5);
      }
      ctx.stroke();
    });

  } else if (a.kind === "wolf") {
    // WOLF — sleek, predatory
    const lW = walk * 2.2;
    leg(-5, 3,  lW, 5.5); leg(-2, 3, -lW, 5.5);
    leg( 2, 3,  lW, 5.5); leg( 5, 3, -lW, 5.5);
    // Body
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-1, -1, 8, 4, -0.15, 0, Math.PI * 2); ctx.fill();
    // Lighter belly
    ctx.fillStyle = shadeHex(color, 22);
    ctx.beginPath(); ctx.ellipse(-1, 1, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
    // Neck
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(6, -2, 2.5, 3.5, -0.5, 0, Math.PI * 2); ctx.fill();
    // Mane / scruff
    ctx.fillStyle = dark;
    for (let mi = 0; mi < 5; mi++) {
      ctx.beginPath();
      ctx.ellipse(4 + mi * 0.5, -4, 1.2, 0.6, -0.3 + mi * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Head
    ctx.save(); ctx.translate(9, -3.5); ctx.rotate(-0.15);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    // Long snout
    ctx.fillStyle = shadeHex(color, -12);
    ctx.beginPath(); ctx.roundRect(2, -1, 5, 2, 0.8); ctx.fill();
    // Nose
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath(); ctx.ellipse(6.5, -0.2, 1, 0.7, 0, 0, Math.PI * 2); ctx.fill();
    // Teeth (when state=attack)
    if (a.state === "attack") {
      ctx.fillStyle = "#f5f0e0";
      ctx.beginPath();
      ctx.moveTo(3.5, 1); ctx.lineTo(4, 2.5); ctx.lineTo(4.5, 1);
      ctx.moveTo(5.5, 1); ctx.lineTo(6, 2.2); ctx.lineTo(6.5, 1);
      ctx.fill();
    }
    // Eye (pale yellow, predator)
    ctx.fillStyle = "#c8b820";
    ctx.beginPath(); ctx.arc(0.5, -1.2, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath(); ctx.arc(0.7, -1.2, 0.5, 0, Math.PI * 2); ctx.fill();
    // Ears (pointed)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-1.5, -1.5); ctx.lineTo(-3, -5.5); ctx.lineTo(0.5, -2.5);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.5, -1.5); ctx.lineTo(3, -5); ctx.lineTo(3.5, -2.2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d07070";
    ctx.beginPath();
    ctx.moveTo(-1.2, -2); ctx.lineTo(-2.3, -4.5); ctx.lineTo(0.2, -2.8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // Tail (bushy, curved up)
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.bezierCurveTo(-13, 0, -14, -4, -12, -6);
    ctx.stroke();
    ctx.strokeStyle = shadeHex(color, 18); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.bezierCurveTo(-13, 0, -14, -4, -12, -6);
    ctx.stroke();

  } else if (a.kind === "cow") {
    // COW — stocky, spotted
    const lW = walk * 1.5;
    leg(-7, 5,  lW, 6); leg(-3, 5, -lW, 6);
    leg( 3, 5,  lW, 6); leg( 7, 5, -lW, 6);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Spots
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath(); ctx.ellipse(-4, -2, 5, 3.5, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, 2.5, 3.5, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2, 3, 3, 2, 0.1, 0, Math.PI * 2); ctx.fill();
    // White belly
    ctx.fillStyle = "#f0f0e8";
    ctx.beginPath(); ctx.ellipse(0, 2.5, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    // Udder
    ctx.fillStyle = "#e8b0b0";
    ctx.beginPath(); ctx.ellipse(2, 5, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    // Teats
    ctx.fillStyle = "#d09090";
    for (let ti = 0; ti < 4; ti++) {
      ctx.beginPath(); ctx.ellipse(ti * 1.5, 6.8, 0.6, 1, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Neck + head
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(12, -2, 3, 5, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(14, -5);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(0, -4, 8, 8, 2); ctx.fill();
    // Snout
    ctx.fillStyle = "#e8b0a0";
    ctx.beginPath(); ctx.ellipse(7, 0.5, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a1a0a";
    ctx.beginPath(); ctx.arc(7.5, -0.5, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7.5, 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
    // Eye
    ctx.fillStyle = "#1a1006";
    ctx.beginPath(); ctx.arc(1.5, -1.5, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(1.9, -1.8, 0.35, 0, Math.PI * 2); ctx.fill();
    // Horn
    ctx.fillStyle = "#d8c090";
    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(-1.5, -7); ctx.lineTo(1.5, -4); ctx.fill();
    ctx.restore();
    // Tail
    ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-10, 1); ctx.lineTo(-13, walk * 2); ctx.stroke();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(-13, walk * 2, 1.5, 0, Math.PI * 2); ctx.fill();

  } else if (a.kind === "boar") {
    // BOAR — stocky, bristled
    const lW = walk * 1.8;
    leg(-5, 4,  lW, 4); leg(-2, 4, -lW, 4);
    leg( 2, 4,  lW, 4); leg( 5, 4, -lW, 4);
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-1, -1, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    // Bristles along spine
    ctx.strokeStyle = dark; ctx.lineWidth = 0.7;
    for (let bi = -7; bi <= 7; bi += 2) {
      ctx.beginPath();
      ctx.moveTo(bi, -5); ctx.lineTo(bi + 0.5, -8.5);
      ctx.stroke();
    }
    // Head
    ctx.save(); ctx.translate(8, -1.5);
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-0.5, -0.5, 4.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    // Snout disk
    ctx.fillStyle = "#8a6050";
    ctx.beginPath(); ctx.arc(4.2, 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a1a10";
    ctx.beginPath(); ctx.arc(3.5, -0.3, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 1.2, 0.7, 0, Math.PI * 2); ctx.fill();
    // Tusks
    ctx.fillStyle = "#f0e8d0";
    ctx.beginPath(); ctx.moveTo(4, 1.5); ctx.bezierCurveTo(5, 2.5, 8, 2.5, 8, 0.5); ctx.lineTo(7, 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -0.5); ctx.bezierCurveTo(5, -2, 8, -2, 8, -0.5); ctx.lineTo(7, -1); ctx.closePath(); ctx.fill();
    // Eye
    ctx.fillStyle = "#1a0808";
    ctx.beginPath(); ctx.arc(0.5, -1.5, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Tiny tail
    ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-11, -1, -12, 1, -11, 3); ctx.stroke();

  } else if (a.kind === "dog") {
    // DOG — friendly, varied breeds
    const lW = walk * 2;
    const accent = shadeHex(color, -28);
    const isChasing = a.state === "chase" || a.state === "attack";
    leg(-4, 3.5,  lW, 5); leg(-1, 3.5, -lW, 5);
    leg( 1, 3.5,  lW, 5); leg( 4, 3.5, -lW, 5);
    // Body
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-0.5, -0.8, 6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    // Belly patch
    ctx.fillStyle = shadeHex(color, 20);
    ctx.beginPath(); ctx.ellipse(0, 1.2, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // Neck
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(5.5, -2, 2, 3, -0.4, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.save();
    ctx.translate(7.5, -4);
    if (a.state === "bark") ctx.rotate(Math.sin(a.walkPhase * 12) * 0.3 - 0.15);
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(0, 0, 3.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-0.3, -0.3, 3, 0, Math.PI * 2); ctx.fill();
    // Snout
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(2.5, 0.6, 2, 1.4, 0.1, 0, Math.PI * 2); ctx.fill();
    // Nose
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath(); ctx.arc(3.8, 0.3, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath(); ctx.arc(4, 0.1, 0.25, 0, Math.PI * 2); ctx.fill();
    // Tongue (when running or barking)
    if (isChasing || a.state === "bark") {
      ctx.fillStyle = "#e04060";
      ctx.beginPath();
      ctx.moveTo(2.5, 1.5); ctx.bezierCurveTo(2, 2.5, 3, 3.5, 3.5, 1.8);
      ctx.closePath(); ctx.fill();
    }
    // Eyes
    ctx.fillStyle = "#1a0a00";
    ctx.beginPath(); ctx.arc(-0.5, -1.2, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(-0.2, -1.5, 0.25, 0, Math.PI * 2); ctx.fill();
    // Ears (floppy — drooped to side)
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-2, -1.5); ctx.bezierCurveTo(-4, -1, -5, 2, -3.5, 3); ctx.lineTo(-2, 1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // Tail (wagging)
    const tw = Math.sin(a.walkPhase * (isChasing ? 12 : 5)) * 3;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-6.5, -1); ctx.bezierCurveTo(-9, -1, -11, tw, -10, tw - 3); ctx.stroke();

  } else if (a.kind === "cat") {
    // CAT — lithe, self-contained
    const isSitting = a.state === "sit";
    const lW = isSitting ? 0 : walk * 1.8;
    if (!isSitting) {
      leg(-3.5, 3,  lW, 4.5); leg(-1, 3, -lW, 4.5);
      leg( 1, 3,  lW, 4.5); leg( 3.5, 3, -lW, 4.5);
    } else {
      // Sitting paws
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-2, 4.5, 2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2, 4.5, 2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Body
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, isSitting ? 1 : 0, isSitting ? 4.5 : 6, isSitting ? 5 : 3.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-0.5, isSitting ? 0.5 : -0.5, isSitting ? 4 : 5.5, isSitting ? 4.5 : 2.8, 0, 0, Math.PI * 2); ctx.fill();
    // Tabby stripes
    ctx.fillStyle = dark; ctx.lineWidth = 0.8;
    for (let si = -3; si <= 3; si++) {
      ctx.fillStyle = `rgba(0,0,0,${0.12 + (si % 2) * 0.05})`;
      ctx.beginPath(); ctx.ellipse(si * 1.5, 0, 0.7, 2.5, 0.1, 0, Math.PI * 2); ctx.fill();
    }
    // Neck
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(isSitting ? 2 : 5, isSitting ? -3 : -2, 2, isSitting ? 3 : 2.5, isSitting ? -0.3 : -0.5, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.save();
    ctx.translate(isSitting ? 4.5 : 7.5, isSitting ? -5 : -4.5);
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-0.3, -0.3, 2.7, 0, Math.PI * 2); ctx.fill();
    // Snout patch
    ctx.fillStyle = shadeHex(color, 16);
    ctx.beginPath(); ctx.ellipse(1.8, 0.8, 1.4, 1.2, 0.1, 0, Math.PI * 2); ctx.fill();
    // Nose
    ctx.fillStyle = "#d06080";
    ctx.beginPath(); ctx.arc(2.4, 0.5, 0.5, 0, Math.PI * 2); ctx.fill();
    // Eyes (cat's eyes — oval with slit)
    ctx.fillStyle = "#60c870";
    ctx.beginPath(); ctx.arc(-0.8, -1, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(-0.95, -1.5, 0.3, 1.0);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath(); ctx.arc(-0.5, -1.3, 0.3, 0, Math.PI * 2); ctx.fill();
    // Whiskers
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 0.35; ctx.lineCap = "round";
    [[1.5, 0, 5, -0.5], [1.5, 0.3, 5, 0.6], [1.5, 0.7, 5, 1.5]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(-x2 + 1.5, y2); ctx.stroke();
    });
    // Ears (pointed)
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-3.5, -5.5); ctx.lineTo(0, -3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.5, -2); ctx.lineTo(3, -5); ctx.lineTo(3.5, -2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e090a0";
    ctx.beginPath(); ctx.moveTo(-1.8, -2.3); ctx.lineTo(-3, -4.5); ctx.lineTo(-0.3, -3.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.7, -2.3); ctx.lineTo(2.7, -4.2); ctx.lineTo(3.2, -2.8); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Tail (curled over body when sitting, swaying when walking)
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.lineCap = "round";
    if (isSitting) {
      ctx.beginPath(); ctx.moveTo(-3.5, 3); ctx.bezierCurveTo(-6, 3, -7, 0, -5, -2); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-3.5, 3); ctx.bezierCurveTo(-6, 3, -7, 0, -5, -2); ctx.stroke();
    } else {
      const tailSway = Math.sin(a.walkPhase * 0.7) * 3;
      ctx.beginPath(); ctx.moveTo(-5.5, -1); ctx.bezierCurveTo(-8, -2, -10, tailSway, -9, tailSway - 4); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-5.5, -1); ctx.bezierCurveTo(-8, -2, -10, tailSway, -9, tailSway - 4); ctx.stroke();
    }

  } else {
    // PIGEON — improved
    const wf = a.flyZ > 0.05 ? Math.sin(a.walkPhase * 3) * 2.5 : 0;
    // Wing shadows
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath(); ctx.ellipse(-0.5, -3, 4, Math.abs(1.5 + wf * 0.5), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.5, 3, 4, Math.abs(1.5 + wf * 0.5), 0, 0, Math.PI * 2); ctx.fill();
    // Wings
    ctx.fillStyle = "#5a6472";
    ctx.beginPath(); ctx.ellipse(-0.5, -2.5, 4.5, Math.max(0.5, Math.abs(1.8 + wf)), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.5, 2.5, 4.5, Math.max(0.5, Math.abs(1.8 + wf)), 0, 0, Math.PI * 2); ctx.fill();
    // Wing feather detail
    ctx.strokeStyle = "#4a5462"; ctx.lineWidth = 0.4;
    for (let wi = 0; wi < 4; wi++) {
      ctx.beginPath();
      ctx.moveTo(-2 + wi * 1.2, -2.5);
      ctx.lineTo(-2.5 + wi * 1.2, -4 - Math.abs(wf) * 0.5);
      ctx.stroke();
    }
    // Body
    ctx.fillStyle = "#8090a0";
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    // Iridescent chest patch (green-purple sheen)
    ctx.fillStyle = "rgba(80,160,120,0.4)";
    ctx.beginPath(); ctx.ellipse(1.5, 0, 2, 1.5, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(120,60,160,0.3)";
    ctx.beginPath(); ctx.ellipse(1.8, 0.3, 1.5, 1, 0.1, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.fillStyle = "#8898a8";
    ctx.beginPath(); ctx.arc(3.5, -0.3, 1.8, 0, Math.PI * 2); ctx.fill();
    // Beak
    ctx.fillStyle = "#c0a078";
    ctx.beginPath(); ctx.moveTo(5, -0.5); ctx.lineTo(7, 0); ctx.lineTo(5, 0.5); ctx.fill();
    // Eye
    ctx.fillStyle = "#e04820";
    ctx.beginPath(); ctx.arc(3.8, -0.8, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath(); ctx.arc(3.9, -0.8, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(4.0, -0.95, 0.15, 0, Math.PI * 2); ctx.fill();
    // Walking legs
    if (a.flyZ < 0.05) {
      ctx.strokeStyle = "#c0a888"; ctx.lineWidth = 0.8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 2.5); ctx.lineTo(-1, 4.5 + walk); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1, 2.5); ctx.lineTo(2, 4.5 - walk); ctx.stroke();
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

  // Wet ground specular sheen
  const cam = state.camera;
  const viewLeft = cam.x - rc.viewW / cam.zoom / 2;
  const viewTop = cam.y - rc.viewH / cam.zoom / 2;
  const viewRight = cam.x + rc.viewW / cam.zoom / 2;
  const viewBottom = cam.y + rc.viewH / cam.zoom / 2;

  ctx.save();
  ctx.translate(rc.viewW / 2 - cam.x * cam.zoom, rc.viewH / 2 - cam.y * cam.zoom);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = "rgba(255,255,255,0.08)";

  // Draw vertical streaks for a wet road look
  const seed = Math.floor(cam.x / 200);
  for (let i = 0; i < 15; i++) {
    const rx = (viewLeft - 100) + ((seed * 131 + i * 271) % (rc.viewW / cam.zoom + 200));
    const ry = viewTop;
    const rw = 2 + (i % 3);
    const rh = rc.viewH / cam.zoom;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.restore();
}

// ─── TRAFFIC SIGNALS (Mast Arms & Heads) ────────────────────────────────────
function signalForDirection(dir: "ns" | "ew", state: GameState): "red" | "yellow" | "green" {
  const TRAFFIC_GREEN = 14;
  const phase = state.trafficPhase; // 0=NS green, 1=EW green
  const timer = state.trafficPhaseTimer;
  const isYellow = timer > TRAFFIC_GREEN - 1.5;

  const currentActive = dir === "ns" ? 0 : 1;
  if (phase === currentActive) {
    return isYellow ? "yellow" : "green";
  }
  return "red";
}

function drawTrafficLights(rc: RenderContext) {
  const { ctx, world, state } = rc;
  const cam = state.camera;
  const tNow = performance.now() / 1000;
  const halfW = rc.viewW / cam.zoom / 2 + 120;
  const halfH = rc.viewH / cam.zoom / 2 + 120;

  const nsState = signalForDirection("ns", state);
  const ewState = signalForDirection("ew", state);

  const drawSignalHead = (x: number, y: number, angle: number, s: "red" | "yellow" | "green") => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Housing (yellow-orange GTA style)
    ctx.fillStyle = "#e0a020";
    ctx.strokeStyle = "#806010";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-4, -10, 8, 20, 2);
    ctx.fill();
    ctx.stroke();
    // Visors (black caps)
    ctx.fillStyle = "#111";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-3, -8 + i * 6, 6, 1.5);
    }
    // Bulbs
    const bulb = (idx: number, color: string, on: boolean) => {
      const by = -6 + idx * 6;
      ctx.fillStyle = on ? color : shadeHex(color, -60);
      ctx.beginPath();
      ctx.arc(0, by, 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        const grd = ctx.createRadialGradient(0, by, 0, 0, by, 8);
        grd.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.4)"));
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, by, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    bulb(0, "rgb(255,40,40)", s === "red");
    bulb(1, "rgb(255,210,30)", s === "yellow");
    bulb(2, "rgb(40,255,80)", s === "green");
    ctx.restore();
  };

  for (const node of world.roadGraph) {
    if (Math.abs(node.x - cam.x) > halfW || Math.abs(node.y - cam.y) > halfH) continue;

    // Only draw signals at actual intersections (3 or 4 way).
    const neighborsCount = (node.dir.n >= 0 ? 1 : 0) + (node.dir.e >= 0 ? 1 : 0) + (node.dir.s >= 0 ? 1 : 0) + (node.dir.w >= 0 ? 1 : 0);
    if (neighborsCount < 3) continue;

    // GTA Style Mast Arms: 4 poles at corners, arms extend over lanes
    const corners = [
      { x: node.x - TILE * 1.9, y: node.y - TILE * 1.9, armX: 35, armY: 0, ang: 0, s: nsState }, // NW
      { x: node.x + TILE * 1.9, y: node.y + TILE * 1.9, armX: -35, armY: 0, ang: Math.PI, s: nsState }, // SE
      { x: node.x + TILE * 1.9, y: node.y - TILE * 1.9, armX: 0, armY: 35, ang: Math.PI / 2, s: ewState }, // NE
      { x: node.x - TILE * 1.9, y: node.y + TILE * 1.9, armX: 0, armY: -35, ang: -Math.PI / 2, s: ewState }, // SW
    ];

    for (const c of corners) {
      // Pole base
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fill();
      // Mast arm
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + c.armX, c.y + c.armY);
      ctx.stroke();
      // Signal head at end of arm
      drawSignalHead(c.x + c.armX, c.y + c.armY, c.ang, c.s);
    }
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

  // ----- STREET LAMPS (Prop-based) -----
  for (const p of state.props) {
    if (p.kind !== "lamp") continue;
    if (Math.abs(p.x - cam.x) > halfW + 60) continue;
    if (Math.abs(p.y - cam.y) > halfH + 60) continue;

    const lx = p.x;
    const ly = p.y - 14;
    const flicker = 1 + Math.sin(tNow * 4.2 + p.x * 0.013) * 0.05;

    const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, 115);
    grd.addColorStop(0, `rgba(255,225,160,${0.22 * intensity * flicker})`);
    grd.addColorStop(0.3, `rgba(255,215,140,${0.08 * intensity})`);
    grd.addColorStop(0.7, `rgba(255,205,130,${0.02 * intensity})`);
    grd.addColorStop(1, "rgba(255,200,140,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(lx, ly, 115, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(lx, ly, 0, lx, ly, 5);
    core.addColorStop(0, `rgba(255,250,220,${0.45 * intensity})`);
    core.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ----- LIT WINDOWS on nearby buildings -----
  for (const b of world.buildings) {
    const bx = b.x * TILE;
    const by = b.y * TILE;
    if (bx + b.w * TILE < cam.x - halfW || bx > cam.x + halfW || by + b.h * TILE < cam.y - halfH || by > cam.y + halfH) continue;
    const w = b.w * TILE;
    const h = b.h * TILE;
    const seed = (b.id * 9301 + 49297) % 233280;
    const slowFlicker = Math.sin(tNow * 0.4 + b.id * 0.7);
    const litCount = 3 + (b.id % 5);
    for (let i = 0; i < litCount; i++) {
      const r1 = ((seed + i * 1013) % 233280) / 233280;
      const r2 = ((seed + i * 7919) % 233280) / 233280;
      if (((b.id + i) % 4) === 0 && slowFlicker < 0) continue;
      const wx = bx + 6 + r1 * (w - 12);
      const wy = by + 6 + r2 * (h - 12);
      const grd = ctx.createRadialGradient(wx, wy, 0, wx, wy, 11);
      grd.addColorStop(0, `rgba(255,220,150,${0.30 * intensity})`);
      grd.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(wx, wy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,235,180,${0.7 * intensity})`;
      ctx.fillRect(wx - 0.7, wy - 0.7, 1.4, 1.4);
    }
  }

  // ----- VEHICLE LIGHTS -----
  for (const v of state.vehicles) {
    if (Math.abs(v.x - cam.x) > halfW + 40 || Math.abs(v.y - cam.y) > halfH + 40) continue;
    const cosA = Math.cos(v.angle);
    const sinA = Math.sin(v.angle);
    const halfL = v.length / 2;
    const halfWv = v.width / 2;
    const lights: [number, number][] = [
      [v.x + cosA * halfL - sinA * (halfWv - 3), v.y + sinA * halfL + cosA * (halfWv - 3)],
      [v.x + cosA * halfL + sinA * (halfWv - 3), v.y + sinA * halfL - cosA * (halfWv - 3)],
    ];
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
    for (const [lx, ly] of lights) {
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 5);
      g.addColorStop(0, `rgba(255,250,225,${0.55 * intensity})`);
      g.addColorStop(1, "rgba(255,250,210,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tx = v.x - cosA * halfL;
    const ty = v.y - sinA * halfL;
    const tailIntensity = v.brake > 0.3 ? 0.65 : 0.30;
    const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 12);
    tg.addColorStop(0, `rgba(255,60,40,${tailIntensity * intensity})`);
    tg.addColorStop(1, "rgba(255,40,20,0)");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(tx, ty, 14, 0, Math.PI * 2);
    ctx.fill();
    if (v.kind === "police") {
      const phase = Math.floor(performance.now() / 180) % 2;
      const cx = v.x;
      const cy = v.y;
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
      sg.addColorStop(0, phase === 0 ? `rgba(255,80,80,${0.75 * intensity})` : `rgba(80,140,255,${0.75 * intensity})`);
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
