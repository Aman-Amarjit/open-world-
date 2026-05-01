// Physics + collision
import type { GameState, Vehicle, Human, Particle, SkidMark } from "./types";
import type { WorldData } from "./world";
import { isSolidAt, TILE } from "./world";
import { clamp, lerpAngle, dist, distSq, rand, canSee } from "./utils";

export const PLAYER_FRICTION = 4.0;
export const VEHICLE_FRICTION = 1.5;
export const VEHICLE_BRAKE = 4.0;

export function updateVehicle(
  v: Vehicle,
  dt: number,
  world: WorldData,
  state: GameState,
) {
  // ---- Steering ----
  // Forward direction & velocity decomposition.
  const fwdX = Math.cos(v.angle);
  const fwdY = Math.sin(v.angle);
  const rightX = -fwdY;
  const rightY = fwdX;
  const speed = Math.hypot(v.vx, v.vy);
  const fwdSpeed = v.vx * fwdX + v.vy * fwdY;
  const sideSpeed = v.vx * rightX + v.vy * rightY;
  const forwardSign = fwdSpeed >= 0 ? 1 : -1;
  // Steering responsiveness: peaks around mid-speed, falls off at high speed
  // (heavier feel) and is reduced (but non-zero) at very low speed (parking).
  const sNorm = Math.min(1, speed / v.maxSpeed);
  const steerEffect =
    Math.min(1, speed / 25) * (1 - 0.45 * sNorm * sNorm); // 0..1
  v.angle += v.steer * v.handling * dt * steerEffect * forwardSign;

  // ---- Throttle ----
  // Throttle scales down as we approach top speed (engine power curve).
  const throttleEnvelope = 1 - 0.6 * sNorm;
  const ax = fwdX * v.throttle * v.accel * throttleEnvelope;
  const ay = fwdY * v.throttle * v.accel * throttleEnvelope;
  v.vx += ax * dt;
  v.vy += ay * dt;

  // ---- Brake (foot brake: kills both forward & sideways momentum) ----
  if (v.brake > 0) {
    const factor = Math.max(0, 1 - VEHICLE_BRAKE * v.brake * dt);
    v.vx *= factor;
    v.vy *= factor;
  }

  // ---- Engine braking (no throttle, no brake → coast slows down) ----
  if (v.throttle === 0 && v.brake === 0) {
    const engineDrag = Math.max(0, 1 - 0.8 * dt);
    // Apply drag along forward axis only (rolling resistance).
    const newFwd = fwdSpeed * engineDrag;
    v.vx = fwdX * newFwd + rightX * sideSpeed;
    v.vy = fwdY * newFwd + rightY * sideSpeed;
  }

  // ---- Lateral grip / drift ----
  // Recompute after throttle/brake.
  const fs2 = v.vx * fwdX + v.vy * fwdY;
  const ss2 = v.vx * rightX + v.vy * rightY;
  // Grip is high at low speed, lower at high speed (arcade drift feel).
  // Handbrake breaks rear traction → big lateral slide.
  const gripBase = 9 - 5 * sNorm; // 9 → 4 across speed range
  const gripMul = v.handbrake > 0 ? 0.18 : 1;
  const sideFriction = Math.min(1, gripBase * gripMul * dt);
  const newSide = ss2 * (1 - sideFriction);
  v.vx = fwdX * fs2 + rightX * newSide;
  v.vy = fwdY * fs2 + rightY * newSide;

  // ---- Air drag (quadratic: dominant at high speed) ----
  if (speed > 1) {
    const dragK = 0.000025; // tuned so terminal speed ≈ maxSpeed
    const dragMag = dragK * speed * speed;
    const dragFactor = Math.max(0, 1 - dragMag * dt);
    v.vx *= dragFactor;
    v.vy *= dragFactor;
  }
  // Small linear rolling friction so you eventually stop.
  const fmul = Math.max(0, 1 - VEHICLE_FRICTION * 0.4 * dt);
  v.vx *= fmul;
  v.vy *= fmul;

  // ---- Speed cap ----
  const cur = Math.hypot(v.vx, v.vy);
  if (cur > v.maxSpeed) {
    v.vx = (v.vx / cur) * v.maxSpeed;
    v.vy = (v.vy / cur) * v.maxSpeed;
  }

  // ---- Move + collide with world ----
  // SUB-STEPPED so a fast car can't tunnel through a TILE-thick wall in one
  // frame: split the displacement into chunks no larger than `maxStep` px,
  // and slide on each axis independently within each chunk so cars scrape
  // along walls instead of getting stuck or punching through.
  const dx = v.vx * dt;
  const dy = v.vy * dt;
  const maxStep = 6;
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep),
  );
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    // X axis
    const tryX = v.x + sx;
    let blockedX = false;
    const cornersX = vehicleCorners(v, tryX, v.y);
    for (const c of cornersX)
      if (isSolidAt(world, c.x, c.y)) { blockedX = true; break; }
    if (!blockedX) v.x = tryX;
    else {
      const impact = Math.abs(v.vx);
      if (impact > 40) spawnImpact(state, v.x, v.y);
      v.hp -= (impact * impact) * 0.0008;
      v.vx *= -0.35;
      v.vy *= 0.7;
    }
    // Y axis
    const tryY = v.y + sy;
    let blockedY = false;
    const cornersY = vehicleCorners(v, v.x, tryY);
    for (const c of cornersY)
      if (isSolidAt(world, c.x, c.y)) { blockedY = true; break; }
    if (!blockedY) v.y = tryY;
    else {
      const impact = Math.abs(v.vy);
      if (impact > 40) spawnImpact(state, v.x, v.y);
      v.hp -= (impact * impact) * 0.0008;
      v.vy *= -0.35;
      v.vx *= 0.7;
    }
    // If both axes blocked, no point continuing the substeps.
    if (blockedX && blockedY) break;
  }

  // Skid marks — proportional to speed: need significant lateral slip fraction
  const slipRatio = cur > 40 ? Math.abs(newSide) / cur : 0;
  if (slipRatio > 0.38 && cur > 90) {
    addSkidMark(state, v);
  }

  // Fire timer
  if (v.onFire) {
    v.fireTimer -= dt;
    v.hp -= dt * 8;
    // Spawn fire particles
    spawnFire(state, v.x + rand(-5, 5), v.y + rand(-5, 5));
    if (v.fireTimer <= 0) {
      explodeVehicle(state, v);
    }
  }
  if (v.hp <= 0 && !v.onFire) {
    v.onFire = true;
    v.fireTimer = 2 + Math.random() * 2;
  }
}

export function vehicleCorners(v: Vehicle, x: number, y: number) {
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  const hl = v.length / 2;
  const hw = v.width / 2;
  return [
    { x: x + c * hl - s * hw, y: y + s * hl + c * hw },
    { x: x + c * hl + s * hw, y: y + s * hl - c * hw },
    { x: x - c * hl - s * hw, y: y - s * hl + c * hw },
    { x: x - c * hl + s * hw, y: y - s * hl - c * hw },
  ];
}

export function updateHuman(
  h: Human,
  dt: number,
  world: WorldData,
  state: GameState,
) {
  if (h.inVehicle) {
    h.x = h.inVehicle.x;
    h.y = h.inVehicle.y;
    h.angle = h.inVehicle.angle;
    return;
  }
  // ---- DEAD NPCs: corpses should NOT keep walking forever. Apply heavy
  // friction so the body slides briefly from any car-impact velocity then
  // settles. No walk animation, no facing-direction updates while dead.
  if (h.hp <= 0 && !h.isPlayer) {
    h.vx *= Math.pow(0.0005, dt); // ~99.95% per second decay
    h.vy *= Math.pow(0.0005, dt);
    if (Math.hypot(h.vx, h.vy) < 0.5) {
      h.vx = 0;
      h.vy = 0;
    }
    const nx = h.x + h.vx * dt;
    const ny = h.y + h.vy * dt;
    if (!isSolidAt(world, nx, h.y)) h.x = nx;
    else h.vx = 0;
    if (!isSolidAt(world, h.x, ny)) h.y = ny;
    else h.vy = 0;
    if (h.fireTimer > 0) h.fireTimer -= dt;
    if (h.punchTimer > 0) h.punchTimer -= dt;
    return;
  }
  const nx = h.x + h.vx * dt;
  const ny = h.y + h.vy * dt;
  if (!isSolidAt(world, nx, h.y)) h.x = nx;
  else h.vx = 0;
  if (!isSolidAt(world, h.x, ny)) h.y = ny;
  else h.vy = 0;
  // Walk anim
  const moving = Math.abs(h.vx) + Math.abs(h.vy) > 0.5;
  if (moving) {
    h.walkPhase += dt * 12;
    h.angle = Math.atan2(h.vy, h.vx);
  }
  // Fire timer
  if (h.fireTimer > 0) h.fireTimer -= dt;
  // Punch swing animation timer (decays so the arm returns from the extended
  // pose drawn in sprites.ts back to the resting walk pose).
  if (h.punchTimer > 0) h.punchTimer -= dt;
  // Burning damage
  // (handled if you want; skip for now)
  void state;
}

function addSkidMark(state: GameState, v: Vehicle) {
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  // rear wheels positions
  const wPositions: [number, number][] = [
    [-v.length / 2 + 4, -v.width / 2 - 0.5],
    [-v.length / 2 + 4, v.width / 2 + 0.5],
  ];
  for (const [lx, ly] of wPositions) {
    const wx = v.x + c * lx - s * ly;
    const wy = v.y + s * lx + c * ly;
    state.skidMarks.push({ x: wx, y: wy, angle: v.angle, alpha: 0.6 });
  }
  // cap skid marks for performance
  if (state.skidMarks.length > 800) state.skidMarks.splice(0, 200);
}

export function spawnImpact(state: GameState, x: number, y: number) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(40, 120);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.6,
      size: 1 + Math.random() * 2,
      kind: "spark",
      color: "#ffd040",
      rotation: 0,
      rotationSpeed: 0,
    });
  }
}

export function spawnFire(state: GameState, x: number, y: number) {
  state.particles.push({
    x,
    y,
    vx: rand(-10, 10),
    vy: rand(-30, -10),
    life: 0.5 + Math.random() * 0.4,
    maxLife: 1,
    size: 4 + Math.random() * 3,
    kind: "fire",
    color: "#ffa040",
    rotation: 0,
    rotationSpeed: 0,
  });
}

export function spawnSmoke(state: GameState, x: number, y: number) {
  state.particles.push({
    x,
    y,
    vx: rand(-15, 15),
    vy: rand(-30, -10),
    life: 1 + Math.random(),
    maxLife: 2,
    size: 3 + Math.random() * 4,
    kind: "smoke",
    color: "rgba(80,80,80,0.6)",
    rotation: 0,
    rotationSpeed: 0,
  });
}

export function spawnBlood(state: GameState, x: number, y: number) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(20, 80);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.6,
      size: 1 + Math.random() * 1.5,
      kind: "blood",
      color: "#9a1418",
      rotation: 0,
      rotationSpeed: 0,
    });
  }
  // permanent decal
  state.decals.push({
    x,
    y,
    kind: "blood",
    size: 3 + Math.random() * 2,
    alpha: 0.85,
    rotation: Math.random() * Math.PI,
  });
  if (state.decals.length > 200) state.decals.splice(0, 50);
}

export function explodeVehicle(state: GameState, v: Vehicle) {
  // Remove driver, kill nearby
  const r = 80;
  for (const o of state.vehicles) {
    if (o === v) continue;
    if (dist(v.x, v.y, o.x, o.y) < r) {
      o.hp -= 60;
      o.vx += (o.x - v.x) * 2;
      o.vy += (o.y - v.y) * 2;
    }
  }
  for (const h of state.humans) {
    if (h.inVehicle === v) {
      h.inVehicle = null;
      h.x = v.x;
      h.y = v.y;
      h.hp -= 80;
    } else if (!h.inVehicle && dist(v.x, v.y, h.x, h.y) < r) {
      h.hp -= 40 * (1 - dist(v.x, v.y, h.x, h.y) / r);
      h.aiState = "flee";
    }
  }
  // Particles
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(80, 240);
    state.particles.push({
      x: v.x,
      y: v.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + Math.random() * 0.5,
      maxLife: 0.9,
      size: 4 + Math.random() * 6,
      kind: "fire",
      color: "#ff8030",
      rotation: 0,
      rotationSpeed: 0,
    });
  }
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(40, 160);
    state.particles.push({
      x: v.x,
      y: v.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1.5 + Math.random(),
      maxLife: 2.5,
      size: 4 + Math.random() * 4,
      kind: "smoke",
      color: "rgba(40,40,40,0.6)",
      rotation: 0,
      rotationSpeed: 0,
    });
  }
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(60, 200);
    state.particles.push({
      x: v.x,
      y: v.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.6 + Math.random() * 0.5,
      maxLife: 1.1,
      size: 1.5,
      kind: "debris",
      color: "#3a3a3a",
      rotation: Math.random() * Math.PI,
      rotationSpeed: rand(-8, 8),
    });
  }
  state.decals.push({
    x: v.x,
    y: v.y,
    kind: "scorch",
    size: 18,
    alpha: 0.9,
    rotation: Math.random() * Math.PI,
  });
  state.camera.shake = Math.max(state.camera.shake, 14);
  // Remove vehicle
  const idx = state.vehicles.indexOf(v);
  if (idx >= 0) state.vehicles.splice(idx, 1);
  // increase combat
  state.combatTimer = Math.max(state.combatTimer, 4);
}

// ---- Oriented-bounding-box helpers (SAT-style overlap test) ----
// Project an OBB's 4 corners onto a unit axis and return [min, max].
function projectOBB(v: Vehicle, axisX: number, axisY: number) {
  const corners = vehicleCorners(v, v.x, v.y);
  let min = Infinity;
  let max = -Infinity;
  for (const c of corners) {
    const p = c.x * axisX + c.y * axisY;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { min, max };
}

// Returns the minimum-translation vector if two OBBs overlap, else null.
// The normal is oriented from `a` toward `b` so callers can push them apart.
function obbOverlap(a: Vehicle, b: Vehicle): { nx: number; ny: number; depth: number } | null {
  // Quick reject — circumscribed-circle test using HALF-DIAGONAL (not length!)
  // length+width gives the true bounding radius for any rotation.
  const ra = Math.hypot(a.length, a.width) / 2;
  const rb = Math.hypot(b.length, b.width) / 2;
  if (distSq(a.x, a.y, b.x, b.y) > (ra + rb) * (ra + rb)) return null;

  const axes = [
    { x: Math.cos(a.angle), y: Math.sin(a.angle) },
    { x: -Math.sin(a.angle), y: Math.cos(a.angle) },
    { x: Math.cos(b.angle), y: Math.sin(b.angle) },
    { x: -Math.sin(b.angle), y: Math.cos(b.angle) },
  ];

  let bestDepth = Infinity;
  let bestNx = 0;
  let bestNy = 0;
  for (const ax of axes) {
    const pa = projectOBB(a, ax.x, ax.y);
    const pb = projectOBB(b, ax.x, ax.y);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= 0) return null; // separating axis found → no collision
    if (overlap < bestDepth) {
      bestDepth = overlap;
      bestNx = ax.x;
      bestNy = ax.y;
    }
  }
  // Make normal point from a → b for consistent push-apart math.
  const dxc = b.x - a.x;
  const dyc = b.y - a.y;
  if (dxc * bestNx + dyc * bestNy < 0) {
    bestNx = -bestNx;
    bestNy = -bestNy;
  }
  return { nx: bestNx, ny: bestNy, depth: bestDepth };
}

// Vehicle vs vehicle — proper rotated-rectangle collision via SAT.
// Replaces the old circle-circle hack which had centers "colliding" whenever
// they were within ~length/2 — that pinged side-by-side cars constantly and
// missed real corner-to-corner crunches between long-and-narrow cars.
export function vehicleVsVehicle(state: GameState) {
  const vs = state.vehicles;
  for (let i = 0; i < vs.length; i++) {
    for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i]!;
      const b = vs[j]!;
      const hit = obbOverlap(a, b);
      if (!hit) continue;
      const { nx, ny, depth } = hit;
      // Push apart proportional to the inverse of mass so big trucks barely
      // move when a hatchback bumps them.
      const totalInvMass = 1 / a.mass + 1 / b.mass;
      const moveA = (1 / a.mass) / totalInvMass;
      const moveB = (1 / b.mass) / totalInvMass;
      a.x -= nx * depth * moveA;
      a.y -= ny * depth * moveA;
      b.x += nx * depth * moveB;
      b.y += ny * depth * moveB;

      // Closing speed along the contact normal (negative = approaching).
      const relVx = b.vx - a.vx;
      const relVy = b.vy - a.vy;
      const sep = relVx * nx + relVy * ny;
      if (sep < 0) {
        // Inelastic impulse with a small bounce coefficient (1 + e).
        const e = 0.2;
        const j = (-(1 + e) * sep) / totalInvMass;
        a.vx -= (j * nx) / a.mass;
        a.vy -= (j * ny) / a.mass;
        b.vx += (j * nx) / b.mass;
        b.vy += (j * ny) / b.mass;
        // Damage scales with closing speed (kinetic-energy style).
        const dmg = Math.abs(sep) * Math.abs(sep) * 0.0006;
        a.hp -= dmg;
        b.hp -= dmg;
        if (Math.abs(sep) > 30) {
          // Spawn the impact at the actual contact point (center-of-overlap),
          // not the midpoint of the cars — looks much more grounded.
          spawnImpact(state, (a.x + b.x) / 2 + nx * (depth / 2), (a.y + b.y) / 2 + ny * (depth / 2));
        }
      }
    }
  }
}

// Vehicle vs human — point-in-rotated-rectangle test.
// The old code used a circular hitbox with radius `length/2 + 3`, so a
// pedestrian standing beside a parked car would get "hit" by a 4-pixel-wide
// stationary car. This transforms the pedestrian into the car's local frame
// and checks against the actual rectangle.
export function vehicleVsHuman(state: GameState) {
  for (const v of state.vehicles) {
    const c = Math.cos(-v.angle);
    const s = Math.sin(-v.angle);
    const hl = v.length / 2 + 3; // small skin so brushes still register
    const hw = v.width / 2 + 3;
    const sp = Math.hypot(v.vx, v.vy);
    for (const h of state.humans) {
      if (h.inVehicle) continue;
      if (h.hp <= 0) continue;
      const dx = h.x - v.x;
      const dy = h.y - v.y;
      // Cheap circle reject using true bounding radius.
      const r = Math.hypot(v.length, v.width) / 2 + 4;
      if (dx * dx + dy * dy > r * r) continue;
      // Transform pedestrian into car's local frame (forward = +x, right = +y).
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      if (Math.abs(lx) > hl || Math.abs(ly) > hw) continue;

      // Coexistence threshold: vehicles only damage humans if moving fast
      // enough to be a real impact (was sp > 30, which lethally crushed peds
      // at parking-lot speeds). Below this, we just push the ped out of the
      // way — the same handling stationary cars used to get.
      if (sp > 55) {
        // Damage scaling — vehicles used to deal `sp * 0.4 * mass` which at
        // typical city speeds (sp ~ 150, mass ~ 2) one-shot the 100-HP player
        // on a single brush. Use a much gentler curve for the player and
        // require a real impact (closing speed > 60), with a per-hit cap and
        // a short i-frame window to prevent multi-frame overlap deleting all
        // HP in one tick. NPCs still get squished hard, as expected.
        if (h.isPlayer) {
          if (h.hitCooldown <= 0 && sp > 60) {
            const raw = (sp - 60) * 0.12 * v.mass; // softer curve, threshold
            const dmg = Math.min(raw, 28); // cap so a single hit ≤ 28 dmg
            h.hp -= dmg;
            h.vx = v.vx * 0.6;
            h.vy = v.vy * 0.6;
            h.hitCooldown = 0.6; // brief invuln window after a hit
            spawnBlood(state, h.x, h.y);
            state.damageFlash = Math.min(1, state.damageFlash + 0.5);
            state.camera.shake = Math.max(state.camera.shake, 0.4);
          } else {
            // still nudge the player out of the car so they don't get stuck
            h.vx = v.vx * 0.4;
            h.vy = v.vy * 0.4;
          }
        } else {
          // NPC damage curve: subtract a 55-px threshold so brushes are
          // forgiving, then scale linearly by (sp-55)*mass*0.35. A car at
          // sp=120 mass=2 still deals ~46 dmg (kills in two), while a slow
          // bump at sp=60 mass=2 deals ~3.5 dmg. Keeps deliberate roadkill
          // viable while ending the "drive past = mass casualty" problem.
          if (h.hitCooldown <= 0) {
            const dmg = (sp - 55) * 0.35 * v.mass;
            h.hp -= dmg;
            h.vx = v.vx * 0.5;
            h.vy = v.vy * 0.5;
            h.hitCooldown = 0.4;
            spawnBlood(state, h.x, h.y);
            if (h.hp <= 0) {
              if (v.driver?.isPlayer) {
                addScore(state, 100, "Roadkill +100");
                raiseWanted(state, h.kind === "police" ? 2 : 1);
              }
            }
          } else {
            // Within i-frame: just shove them aside, no extra damage.
            h.vx = v.vx * 0.4;
            h.vy = v.vy * 0.4;
          }
        }
      } else {
        // Push the pedestrian out to whichever side they overlapped least.
        const penX = hl - Math.abs(lx);
        const penY = hw - Math.abs(ly);
        if (penX < penY) {
          const sgn = lx >= 0 ? 1 : -1;
          h.x += sgn * Math.cos(v.angle) * penX;
          h.y += sgn * Math.sin(v.angle) * penX;
        } else {
          const sgn = ly >= 0 ? 1 : -1;
          h.x += sgn * -Math.sin(v.angle) * penY;
          h.y += sgn * Math.cos(v.angle) * penY;
        }
      }
    }
  }
}

export function addScore(state: GameState, n: number, msg?: string) {
  state.score += n * (1 + state.combo * 0.5);
  state.combo += 1;
  state.comboTimer = 8;
  if (msg) {
    state.notifications.push({ text: msg, life: 2, color: "#ffe040" });
  }
}

export function raiseWanted(state: GameState, n: number) {
  const oldLevel = state.wantedLevel;
  state.wantedLevel = Math.min(6, state.wantedLevel + n);
  state.wantedDecayTimer = 30;
  state.lastKnownPlayerPos = { x: state.player.x, y: state.player.y };
  
  // Visual feedback for wanted level increase
  if (state.wantedLevel > oldLevel) {
    state.notifications.push({
      text: state.wantedLevel >= 4 ? "WANTED!" : state.wantedLevel >= 2 ? "Police alerted!" : "Heat detected!",
      life: 1.5,
      color: state.wantedLevel >= 4 ? "#ff3030" : state.wantedLevel >= 2 ? "#ff8030" : "#ffa030"
    });
  }
}

export function raiseWantedIfWitnessed(state: GameState, n: number) {
  const p = state.player;
  let witnessed = false;
  for (const h of state.humans) {
    if (h.isPlayer || h.hp <= 0) continue;
    if (h.kind === "police" && distSq(h.x, h.y, p.x, p.y) < 400 * 400) {
      if (canSee(h.x, h.y, h.angle, p.x, p.y, 1.2)) {
        witnessed = true;
        break;
      }
    }
    // Civilians also witness
    if (h.kind === "pedestrian" && distSq(h.x, h.y, p.x, p.y) < 250 * 250) {
      if (canSee(h.x, h.y, h.angle, p.x, p.y, 1.0)) {
        witnessed = true;
        // Ped enters witness state
        h.aiState = "witness";
        h.witnessTimer = 8;
        h.witnessCrimePos = { x: p.x, y: p.y };
        break;
      }
    }
  }
  if (witnessed) {
    raiseWanted(state, n);
  }
}

// Check if player is in a vehicle (for wanted decay bonus)
function isInVehicle(state: GameState): boolean {
  return state.player.inVehicle !== null;
}

// Check if player is in an alley/covered area (faster wanted decay)
function isInCover(state: GameState, world: WorldData): boolean {
  const tx = Math.floor(state.player.x / TILE);
  const ty = Math.floor(state.player.y / TILE);
  const tile = world.tiles[ty]?.[tx];
  if (!tile) return false;
  
  // Alleys are narrow sidewalk areas between buildings
  // Check surrounding tiles for buildings
  let buildingCount = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const neighbor = world.tiles[ty + dy]?.[tx + dx];
      if (neighbor?.type === "building") buildingCount++;
    }
  }
  // More buildings around = better cover
  return buildingCount >= 4;
}

// Check if player is near a pay 'n' spray (instant wanted reduction)
function checkPayNSpray(state: GameState, world: WorldData): boolean {
  for (const shop of world.shops) {
    if (shop.kind === "pay_n_spray") {
      const d = Math.sqrt(distSq(state.player.x, state.player.y, shop.doorX, shop.doorY));
      if (d < 80) return true;
    }
  }
  return false;
}

// Enhanced wanted decay with contextual bonuses
export function updateWantedDecay(state: GameState, dt: number, world: WorldData) {
  if (state.wantedLevel === 0 || state.combatTimer > 0) return;
  
  // Base decay time
  let decayTime = 30;
  let decayAmount = 1;
  
  // In vehicle = slower decay (police can chase better)
  if (isInVehicle(state)) {
    decayTime = 45;
  }
  
  // In cover = faster decay
  if (isInCover(state, world)) {
    decayTime = 20;
    decayAmount = 1;
  }
  
  // Near pay 'n' spray = rapid decay
  if (checkPayNSpray(state, world)) {
    decayTime = 5;
    decayAmount = Math.min(2, state.wantedLevel);
  }
  
  // Higher wanted levels take longer to decay
  decayTime *= 1 + (state.wantedLevel * 0.15);
  
  state.wantedDecayTimer -= dt;
  if (state.wantedDecayTimer <= 0) {
    state.wantedLevel = Math.max(0, state.wantedLevel - decayAmount);
    state.wantedDecayTimer = decayTime;
    
    // Notification for decay
    if (state.wantedLevel > 0) {
      state.notifications.push({
        text: state.wantedLevel === 0 ? "Busted!" : `Heat cooling... (${state.wantedLevel}★)`,
        life: 1.0,
        color: state.wantedLevel === 0 ? "#30c870" : "#a0a0a0"
      });
    }
  }
}

