// Advanced AI: lane-following civilians, witness-reporting peds, coordinated police, PIT, strafing combat
import type { GameState, Human, Vehicle } from "./types";
import type { WorldData, RoadNode } from "./world";
import { TILE, isSolidAt, tileAt } from "./world";
import { angleTo, clamp, dist, distSq, lerpAngle, rand } from "./utils";
import { raiseWanted } from "./physics";
import { audioEngine } from "./audio";

// Combat tuning
const PED_VIEW = 220;
// PED_HEAR is the radius in which a pedestrian is "scared" by a gunshot.
// Tightened from 320 → 200 (~3 tiles) so a single shot doesn't make every
// pedestrian on the visible screen panic at once. Distant peds simply
// don't hear it.
const PED_HEAR = 200;
const GUN_RANGE = 280;
const COP_GUN_RANGE = 320;
// Peaceful coexistence: peds notice oncoming cars further out and dodge with
// a wider acceptance cone (was 70 / fwdDot 0.5). Cars also look further
// ahead for peds (see ped scan below).
const SWERVE_DETECT = 110;
const CAR_FRONT_SENSOR = 90; // car looks ahead this much for OTHER VEHICLES
const LANE_OFFSET = 8; // right-side lane offset from intersection center
const GAWK_RANGE = 90; // peds will gawk at corpses within this radius
const GANG_BACKUP_RANGE = 260; // a wounded/firing gang summons others in this radius
const COP_COVER_RANGE = 110; // cops look for cover within this radius

// ============================================================================
// PEDESTRIAN AI
// ============================================================================

export function updateHumanAI(
  h: Human,
  dt: number,
  world: WorldData,
  state: GameState,
) {
  if (h.isPlayer) return;
  if (h.hp <= 0) return;
  if (h.inVehicle) {
    updateDriverAI(h, dt, world, state);
    return;
  }
  h.aiTimer -= dt;
  if (h.witnessTimer > 0) h.witnessTimer -= dt;

  // ---- React to fresh threats (universal) -------------------------------
  const player = state.player;
  const dToPlayer = dist(h.x, h.y, player.x, player.y);

  // ---- DOWNED state ------------------------------------------------------
  if (h.aiState === "downed") {
    h.vx = 0;
    h.vy = 0;
    if (h.aiTimer <= 0) {
      h.aiState = "panic";
      h.aiTimer = rand(1.5, 3);
    }
    return;
  }

  // ---- FIGHT state (unarmed melee retaliation) -------------------------
  // Triggered when the player punches a pedestrian (or a civilian driver
  // bails from a punched car) and they choose to fight back instead of
  // panicking. They charge the player and throw fists when in melee range.
  if (h.aiState === "fight") {
    updateFighter(h, dt, state, dToPlayer);
    return;
  }

  if (h.kind === "pedestrian") {
    updatePedestrian(h, dt, world, state, dToPlayer);
  } else if (h.kind === "gang") {
    updateGang(h, dt, world, state, dToPlayer);
  } else if (h.kind === "police") {
    updateCop(h, dt, world, state, dToPlayer);
  }
}

// ---- AI MELEE -------------------------------------------------------------
// An angry unarmed actor who closes with the player and throws punches when
// in range. Times out after aiTimer expires (set when the state begins) and
// reverts to normal panic so they don't pursue the player across the city.
const AI_PUNCH_RANGE = 16;
const AI_PUNCH_DAMAGE = 8;
const AI_PUNCH_COOLDOWN = 0.85;
const AI_PUNCH_DURATION = 0.28;
function updateFighter(
  h: Human,
  dt: number,
  state: GameState,
  dToPlayer: number,
) {
  // Bail back to fleeing if low on HP — even angry civilians have limits.
  if (h.hp < h.maxHp * 0.35) {
    h.aiState = "panic";
    h.aiTimer = rand(2.5, 4);
    h.panicFromX = state.player.x;
    h.panicFromY = state.player.y;
    return;
  }
  // Time out — give up the chase
  if (h.aiTimer <= 0) {
    h.aiState = "panic";
    h.aiTimer = rand(2, 3.5);
    h.panicFromX = state.player.x;
    h.panicFromY = state.player.y;
    return;
  }
  const player = state.player;
  // If the player is in a vehicle, fighters give up — punching a moving car
  // is a losing battle.
  if (player.inVehicle) {
    h.aiState = "panic";
    h.aiTimer = rand(2, 3);
    h.panicFromX = player.x;
    h.panicFromY = player.y;
    return;
  }
  const a = angleTo(h.x, h.y, player.x, player.y);
  h.angle = a;
  if (dToPlayer > AI_PUNCH_RANGE - 2) {
    // Charge in
    h.vx = Math.cos(a) * h.speed * 1.3;
    h.vy = Math.sin(a) * h.speed * 1.3;
    h.walkPhase += dt * 16;
  } else {
    // In range — slow down and throw a punch on cooldown
    h.vx *= 0.4;
    h.vy *= 0.4;
    if (h.fireTimer <= 0) {
      h.fireTimer = AI_PUNCH_COOLDOWN;
      h.punchTimer = AI_PUNCH_DURATION;
      audioEngine.playPunch();
      player.hp -= AI_PUNCH_DAMAGE;
      // Light knockback on the player so it reads as an impact
      const px = Math.cos(a) * 25;
      const py = Math.sin(a) * 25;
      player.vx += px;
      player.vy += py;
      state.camera.shake = Math.max(state.camera.shake, 0.8);
    }
  }
}

function updatePedestrian(
  h: Human,
  dt: number,
  world: WorldData,
  state: GameState,
  dToPlayer: number,
) {
  const player = state.player;

  // ---- GAWK: stop and stare at a fresh corpse, then panic-flee from it -----
  // A "fresh" corpse is one currently in its death animation (deathAnim 0..1).
  // Civilians who already saw a corpse don't re-trigger (witnessTimer stops them).
  // Once gawk timer ends, they panic with the corpse as the threat source.
  if (h.aiState === "investigate") {
    h.vx *= 0.3;
    h.vy *= 0.3;
    // Face the corpse
    h.angle = angleTo(h.x, h.y, h.aiTargetX, h.aiTargetY);
    h.aiTimer -= dt;
    if (h.aiTimer <= 0) {
      h.aiState = "panic";
      h.panicFromX = h.aiTargetX;
      h.panicFromY = h.aiTargetY;
      h.aiTimer = rand(2.5, 4.5);
    }
    return;
  }
  if (h.aiState === "wander" && h.witnessTimer <= 0) {
    for (const o of state.humans) {
      if (o === h) continue;
      if (o.deathAnim <= 0 || o.deathAnim > 0.6) continue;
      const d2 = (o.x - h.x) ** 2 + (o.y - h.y) ** 2;
      if (d2 < GAWK_RANGE * GAWK_RANGE) {
        h.aiState = "investigate";
        h.aiTargetX = o.x;
        h.aiTargetY = o.y;
        h.aiTimer = rand(1.2, 2.5);
        h.witnessTimer = 12; // don't repeat for this corpse
        h.vx = 0;
        h.vy = 0;
        return;
      }
    }
  }

  // Trigger panic from gunshots / blood / nearby player with weapon out
  let threat: { x: number; y: number; pri: number } | null = null;
  if (state.combatTimer > 0 && dToPlayer < PED_HEAR) {
    threat = { x: player.x, y: player.y, pri: 1 };
  }
  // PANIC CONTAGION — if a nearby ped is already panicking, this one does too.
  // Tightened to keep panic from cascading across the whole map: smaller
  // radius, low per-second probability so it has to be sustained, and we
  // only re-broadcast from peds whose ORIGINAL panic source (the player) is
  // still close. That way a chase across town doesn't leave a trail of
  // permanently-panicked pedestrians forever transmitting fear.
  if (!threat) {
    for (const o of state.humans) {
      if (o === h) continue;
      if (o.kind !== "pedestrian") continue;
      if (o.aiState !== "panic" && o.aiState !== "flee") continue;
      const d2 = (o.x - h.x) ** 2 + (o.y - h.y) ** 2;
      if (d2 > 40 * 40) continue; // tighter contagion radius
      // Only spread when the original threat is still nearby — stops the
      // contagion from chaining infinitely.
      const srcD = Math.hypot(o.panicFromX - h.x, o.panicFromY - h.y);
      if (srcD > PED_HEAR) continue;
      // Probabilistic per-second catch (~25%/s, was 50%) so a single
      // panicker is even less likely to tip a whole crowd.
      if (Math.random() > 0.25 * dt) continue;
      threat = { x: o.panicFromX, y: o.panicFromY, pri: 0.7 };
      break;
    }
  }
  // Recent bullet whizzed by? we just check player firing nearby
  if (state.player.fireTimer > 0 && dToPlayer < PED_HEAR) {
    threat = { x: player.x, y: player.y, pri: 1.2 };
    // chance to become a witness who reports the crime
    if (h.witnessTimer <= 0 && Math.random() < 0.2) {
      h.aiState = "witness";
      h.witnessTimer = 8;
      // Find nearest cop, walk toward them
      const cop = nearestCop(state, h);
      if (cop) {
        h.aiTargetX = cop.x;
        h.aiTargetY = cop.y;
      } else {
        // No cop — just call (raise wanted slowly by 1)
        if (state.wantedLevel === 0) {
          raiseWanted(state, 1);
          state.notifications.push({
            text: "Witness called police!",
            life: 2,
            color: "#ff8030",
          });
          h.witnessTimer = 999; // don't double-trigger
        }
      }
    }
  }

  // ---- Witness state: walk to cop, raise wanted on arrival --------------
  if (h.aiState === "witness") {
    const target = h.aiTargetX && h.aiTargetY ? { x: h.aiTargetX, y: h.aiTargetY } : null;
    if (target) {
      const a = angleTo(h.x, h.y, target.x, target.y);
      h.vx = Math.cos(a) * h.speed * 0.9;
      h.vy = Math.sin(a) * h.speed * 0.9;
      // arms-up gesture animation handled by walkPhase being faster
      if (dist(h.x, h.y, target.x, target.y) < 28) {
        if (state.wantedLevel < 2) raiseWanted(state, 1);
        state.notifications.push({ text: "Witness reported!", life: 2, color: "#ff8030" });
        h.aiState = "panic";
        h.aiTimer = rand(2, 4);
        h.witnessTimer = 999;
      }
    }
    return;
  }

  // ---- PANIC: run from threat -------------------------------------------
  if (threat || h.aiState === "panic" || h.aiState === "flee") {
    if (threat) {
      h.aiState = "panic";
      h.panicFromX = threat.x;
      h.panicFromY = threat.y;
      // Shorter panic window (was 3s). They'll still flee but recover sooner
      // so the screen isn't permanently plastered with `!` icons.
      h.aiTimer = Math.max(h.aiTimer, 1.6);
    }
    if (h.aiTimer <= 0) {
      // Calm down
      h.aiState = "wander";
      h.aiTimer = rand(2, 4);
      h.aiPath = [];
    } else {
      // Run away from panic source. Speed multiplier and wobble dialed down
      // so panicked peds don't dart into traffic at high speed and clog the
      // streets with bodies whenever a single shot is fired.
      const a = angleTo(h.panicFromX, h.panicFromY, h.x, h.y);
      const wob = Math.sin(performance.now() / 140 + h.id) * 0.22;
      h.vx = Math.cos(a + wob) * h.speed * 1.35;
      h.vy = Math.sin(a + wob) * h.speed * 1.35;
      // Walk anim faster
      h.walkPhase += dt * 16;
      return;
    }
  }

  // ---- DODGE oncoming cars ----------------------------------------------
  for (const v of state.vehicles) {
    const sp = Math.hypot(v.vx, v.vy);
    if (sp < 30) continue; // even slow-moving cars are noticed now
    const dx = h.x - v.x;
    const dy = h.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d > SWERVE_DETECT) continue;
    // Is the ped roughly in front of the car? Wider acceptance cone (0.35
    // ~= 70°) so peds dodge cars approaching at an angle, not just dead-on.
    const fwdDot = (dx * v.vx + dy * v.vy) / (sp * (d || 1));
    if (fwdDot < 0.35) continue;
    // Sidestep perpendicular to car velocity
    const px = -v.vy / sp;
    const py = v.vx / sp;
    // Choose side that moves away from car
    const sign = px * dx + py * dy >= 0 ? 1 : -1;
    h.vx = px * sign * h.speed * 1.8;
    h.vy = py * sign * h.speed * 1.8;
    h.walkPhase += dt * 18;
    return;
  }

  // ---- WANDER on sidewalks ----------------------------------------------
  if (h.aiPath.length === 0 || h.aiTimer <= 0) {
    pickSidewalkPath(h, world);
    h.aiTimer = rand(4, 9);
  }
  if (h.aiPath.length > 0) {
    const next = h.aiPath[0]!;
    const d = dist(h.x, h.y, next.x, next.y);
    if (d < 8) {
      h.aiPath.shift();
    } else {
      const a = angleTo(h.x, h.y, next.x, next.y);
      // ROAD-CROSSING SAFETY: if our next step would take us off the sidewalk
      // and onto a road tile, scan for a fast oncoming car. If one is close,
      // wait at the curb for it to pass instead of walking out in front of it.
      const stepX = h.x + Math.cos(a) * 6;
      const stepY = h.y + Math.sin(a) * 6;
      const stepTile = tileAt(world, stepX, stepY);
      if (stepTile && (stepTile.type === "road" || stepTile.type === "crosswalk")) {
        // ---- TRAFFIC SIGNAL ----
        // A pedestrian crossing the road perpendicular to traffic has the
        // walk signal when traffic is RED for that direction. We classify
        // the crossing direction by the ped's intended step (NS vs EW) and
        // wait at the curb if the corresponding cars currently have green.
        const stepAx = Math.cos(a);
        const stepAy = Math.sin(a);
        const pedHeading: "ns" | "ew" =
          Math.abs(stepAy) > Math.abs(stepAx) ? "ns" : "ew";
        // The cars they'd be crossing in front of run perpendicular to their
        // step direction.
        const carsCrossing: "ns" | "ew" = pedHeading === "ns" ? "ew" : "ns";
        const greenForPhase: "ns" | "ew" = state.trafficPhase === 0 ? "ns" : "ew";
        const carsHaveGreen = carsCrossing === greenForPhase;
        if (carsHaveGreen) {
          // Don't step into traffic on a red walk signal.
          h.vx *= 0.2;
          h.vy *= 0.2;
          return;
        }
        let mustWait = false;
        for (const v of state.vehicles) {
          const sp2 = Math.hypot(v.vx, v.vy);
          if (sp2 < 50) continue;
          const dx = h.x - v.x;
          const dy = h.y - v.y;
          const d2 = Math.hypot(dx, dy);
          if (d2 > 90) continue;
          // Car heading roughly at us?
          if ((dx * v.vx + dy * v.vy) / (sp2 * (d2 || 1)) > 0.55) {
            mustWait = true;
            break;
          }
        }
        if (mustWait) {
          h.vx *= 0.2;
          h.vy *= 0.2;
          return;
        }
      }
      const sp = h.speed * (Math.random() < 0.1 ? 0.3 : 0.6); // occasional slowdowns
      h.vx = Math.cos(a) * sp;
      h.vy = Math.sin(a) * sp;
    }
  } else {
    h.vx *= 0.5;
    h.vy *= 0.5;
  }
}

function pickSidewalkPath(h: Human, world: WorldData) {
  if (world.sidewalkNodes.length === 0) return;
  // Pick a NEARBY sidewalk node (was 60-400, now 50-180 so we don't pick
  // targets clear across a road — that's what made peds path through the
  // middle of the street). Closer targets keep them on the same sidewalk
  // strip; road crossings happen via crosswalks at intersections.
  const candidates: { x: number; y: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const n = world.sidewalkNodes[Math.floor(Math.random() * world.sidewalkNodes.length)]!;
    const d = dist(n.x, n.y, h.x, h.y);
    if (d > 50 && d < 180) candidates.push(n);
  }
  if (candidates.length === 0) return;
  // Of the nearby candidates, prefer one whose straight-line path stays on
  // walkable terrain (sidewalk/plaza/grass/crosswalk). This filters out
  // targets on the opposite side of a road that would force the ped to
  // jaywalk diagonally.
  const isWalkable = (tx: number, ty: number) => {
    const t = tileAt(world, tx, ty);
    if (!t) return false;
    return (
      t.type === "sidewalk" ||
      t.type === "plaza" ||
      t.type === "grass" ||
      t.type === "crosswalk"
    );
  };
  const sampleSegmentOk = (ax: number, ay: number, bx: number, by: number) => {
    const segDist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.floor(segDist / 14));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!isWalkable(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  };
  // Pick the first candidate whose direct path is fully walkable; if none,
  // fall back to the nearest candidate so they don't get stuck.
  let tgt = candidates[0]!;
  for (const c of candidates) {
    if (sampleSegmentOk(h.x, h.y, c.x, c.y)) {
      tgt = c;
      break;
    }
  }
  // Mid waypoint adds slight wobble — but only if it lands on walkable
  // ground (otherwise the ped detours into the street).
  const mx = (h.x + tgt.x) / 2 + rand(-20, 20);
  const my = (h.y + tgt.y) / 2 + rand(-20, 20);
  if (isWalkable(mx, my)) {
    h.aiPath = [{ x: mx, y: my }, tgt];
  } else {
    h.aiPath = [tgt];
  }
}

function nearestCop(state: GameState, from: Human): Human | null {
  let best: Human | null = null;
  let bestD = 600 * 600;
  for (const c of state.humans) {
    if (c.kind !== "police") continue;
    if (c.inVehicle) continue;
    const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// ============================================================================
// GANG AI - flank, take cover, strafe-shoot
// ============================================================================

function updateGang(
  h: Human,
  dt: number,
  world: WorldData,
  state: GameState,
  dToPlayer: number,
) {
  const player = state.player;

  // GANG TURF — only aggro inside their turf radius (or if the player has
  // committed major crime everywhere)
  const distFromHome = dist(h.x, h.y, h.homeX, h.homeY);
  const inTurf = distFromHome < 360;
  const playerInTurf = dist(player.x, player.y, h.homeX, h.homeY) < 360;

  // LOW-HP RETREAT — back away to find cover and heal
  if (h.hp < h.maxHp * 0.3 && h.aiState !== "retreat") {
    h.aiState = "retreat";
    h.aiTimer = 6;
    // Retreat toward home / away from threat
    const a = angleTo(player.x, player.y, h.x, h.y);
    h.aiTargetX = h.x + Math.cos(a) * 200;
    h.aiTargetY = h.y + Math.sin(a) * 200;
  }
  if (h.aiState === "retreat") {
    if (h.aiTimer <= 0 || dToPlayer > 400) {
      // calmed down - resume patrol
      h.aiState = "patrol";
      h.hp = Math.min(h.maxHp, h.hp + 10); // partial heal while hidden
    } else {
      const a = angleTo(h.x, h.y, h.aiTargetX, h.aiTargetY);
      h.vx = Math.cos(a) * h.speed * 1.3;
      h.vy = Math.sin(a) * h.speed * 1.3;
      // Look back and shoot occasionally if forced into a fight
      if (h.fireTimer <= 0 && dToPlayer < GUN_RANGE && Math.random() < 0.3) {
        fireBulletWithLead(state, h, player, 8);
        h.fireTimer = 0.8;
      }
      return;
    }
  }

  // Trigger attack: only if player is in turf, has wanted level, or is very close
  if (h.aiState !== "attack" && h.aiState !== "cover") {
    const aggro =
      (inTurf && playerInTurf && dToPlayer < PED_VIEW) ||
      dToPlayer < 90 ||
      state.wantedLevel >= 4;
    if (aggro) {
      h.aiState = "attack";
      h.strafeDir = (h.id % 2) * 2 - 1;
      // CALL FOR BACKUP — wake nearby gang members in our turf so they swarm the
      // player together. Capped at 4 awakenings per call so this isn't free aggro.
      let woke = 0;
      for (const g of state.humans) {
        if (g === h) continue;
        if (g.kind !== "gang") continue;
        if (g.hp <= 0) continue;
        if (g.aiState === "attack" || g.aiState === "cover") continue;
        const d2 = (g.x - h.x) ** 2 + (g.y - h.y) ** 2;
        if (d2 > GANG_BACKUP_RANGE * GANG_BACKUP_RANGE) continue;
        // Only respond if they share roughly the same turf
        if (dist(g.homeX, g.homeY, h.homeX, h.homeY) > 220) continue;
        g.aiState = "attack";
        g.strafeDir = (g.id % 2) * 2 - 1;
        woke++;
        if (woke >= 4) break;
      }
    }
  }

  if (h.aiState === "attack" || h.aiState === "cover") {
    // Lose interest if too far
    if (dToPlayer > 600) {
      h.aiState = "patrol";
      return;
    }
    const targetA = angleTo(h.x, h.y, player.x, player.y);
    h.angle = targetA;

    // BOUNDING OVERWATCH — within a multi-gang attack, alternate between
    // SUPPRESS (heavy fire, slow advance) and ADVANCE (move in fast, fire less).
    // Phase flips ~every 1.6 s based on world time + the gang id, so the squad
    // rolls forward in pairs instead of clumping.
    const overwatchPhase = Math.floor(state.worldTime / 1.6 + h.id * 0.5) % 2;
    const isAdvancing = overwatchPhase === 1;

    // If under fire (player has heat) and a vehicle is near, take cover behind it
    const cover = nearestCoverObject(state, h, player);
    const inCoverDist = cover && dist(h.x, h.y, cover.x, cover.y) < 28;
    if (cover && state.player.fireTimer > 0 && !inCoverDist && !isAdvancing && Math.random() < 0.05) {
      h.aiState = "cover";
      h.aiTargetX = cover.x;
      h.aiTargetY = cover.y;
    }

    if (h.aiState === "cover") {
      // Walk to cover, then peek and shoot
      const cd = dist(h.x, h.y, h.aiTargetX, h.aiTargetY);
      if (cd > 12) {
        const a = angleTo(h.x, h.y, h.aiTargetX, h.aiTargetY);
        h.vx = Math.cos(a) * h.speed * 1.1;
        h.vy = Math.sin(a) * h.speed * 1.1;
        return;
      }
      // In cover - peek-shoot occasionally
      h.vx = 0;
      h.vy = 0;
      if (h.fireTimer <= 0 && dToPlayer < GUN_RANGE && Math.random() < 0.6) {
        fireBulletWithLead(state, h, player, 12);
        h.fireTimer = 0.6;
      }
      // Leave cover when our overwatch phase flips to ADVANCE
      if (isAdvancing && Math.random() < 0.04) h.aiState = "attack";
      return;
    }

    if (isAdvancing) {
      // ADVANCE — push toward the player (or to flanking position) and fire less
      const flank = ((h.id % 2) === 0) ? Math.PI / 6 : -Math.PI / 6;
      const moveA = targetA + flank;
      h.vx = Math.cos(moveA) * h.speed * 1.25;
      h.vy = Math.sin(moveA) * h.speed * 1.25;
      // Bail to strafe if we hit a wall
      if (isSolidAt(world, h.x + h.vx * 0.3, h.y + h.vy * 0.3)) {
        const px = -Math.sin(targetA);
        const py = Math.cos(targetA);
        h.vx = px * h.strafeDir * h.speed * 0.9;
        h.vy = py * h.strafeDir * h.speed * 0.9;
      }
      // Suppression-light fire while moving (less accurate cadence)
      if (h.fireTimer <= 0 && dToPlayer < GUN_RANGE && Math.random() < 0.5) {
        fireBulletWithLead(state, h, player, 10);
        h.fireTimer = 0.85;
        state.combatTimer = Math.max(state.combatTimer, 4);
      }
      return;
    }

    // SUPPRESS phase: approach to gun range, then strafe & fire often
    if (dToPlayer > GUN_RANGE * 0.65) {
      h.vx = Math.cos(targetA) * h.speed;
      h.vy = Math.sin(targetA) * h.speed;
    } else {
      // Strafe perpendicular
      const px = -Math.sin(targetA);
      const py = Math.cos(targetA);
      h.vx = px * h.strafeDir * h.speed * 0.9;
      h.vy = py * h.strafeDir * h.speed * 0.9;
      // Switch direction occasionally or near walls
      if (Math.random() < 0.01) h.strafeDir *= -1;
      if (isSolidAt(world, h.x + h.vx * 0.3, h.y + h.vy * 0.3)) h.strafeDir *= -1;
    }
    if (h.fireTimer <= 0 && dToPlayer < GUN_RANGE) {
      fireBulletWithLead(state, h, player, 12);
      h.fireTimer = 0.4;
      state.combatTimer = Math.max(state.combatTimer, 4);
    }
    return;
  }

  // PATROL between random nearby points
  if (h.aiTimer <= 0 || h.aiPath.length === 0) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(80, 200);
    h.aiPath = [{ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r }];
    h.aiTimer = rand(3, 6);
  }
  if (h.aiPath.length > 0) {
    const next = h.aiPath[0]!;
    const d = dist(h.x, h.y, next.x, next.y);
    if (d < 10) h.aiPath.shift();
    else {
      const a = angleTo(h.x, h.y, next.x, next.y);
      h.vx = Math.cos(a) * h.speed * 0.55;
      h.vy = Math.sin(a) * h.speed * 0.55;
    }
  }
}

function nearestCoverObject(
  state: GameState,
  h: Human,
  threat: Human,
): { x: number; y: number } | null {
  // Find vehicles between h and threat, prefer ones close to h
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  for (const v of state.vehicles) {
    const dh = dist(v.x, v.y, h.x, h.y);
    if (dh > 120) continue;
    // Score: closer to me, and on the line toward threat
    const a1 = angleTo(h.x, h.y, threat.x, threat.y);
    const a2 = angleTo(h.x, h.y, v.x, v.y);
    let diff = a1 - a2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const align = 1 - Math.abs(diff) / Math.PI;
    const score = align * 2 - dh / 200;
    if (score > bestScore) {
      bestScore = score;
      // Stand on the side opposite threat
      const ox = h.x + (h.x - threat.x) * 0.04;
      const oy = h.y + (h.y - threat.y) * 0.04;
      best = { x: v.x + (ox - v.x) * 0.1, y: v.y + (oy - v.y) * 0.1 };
    }
  }
  return best;
}

// ============================================================================
// COP ON FOOT - coordinate flanking
// ============================================================================

function updateCop(
  h: Human,
  dt: number,
  world: WorldData,
  state: GameState,
  dToPlayer: number,
) {
  const player = state.player;

  if (state.wantedLevel > 0) {
    h.aiState = "chase";
  }

  if (h.aiState === "chase" || h.aiState === "cover") {
    // SQUAD COORDINATION — assign each on-foot cop a tactical role:
    //   role 0 = suppressor (stay back, lay down fire)
    //   role 1 = flanker (circle around for crossfire)
    //   role 2 = cutoff (block the player's predicted exit direction)
    //   role 3+= reserve (close in slowly)
    const cops = state.humans.filter((c) => c.kind === "police" && !c.inVehicle && c.hp > 0);
    const myIdx = cops.indexOf(h);
    h.squadRole = myIdx < 4 ? myIdx : 3;

    // COP COVER — when player is shooting back and a vehicle is between us and
    // them, suppressors and reserves prefer to fight from cover. Flankers and
    // cutoffs keep moving so the squad stays kinetic.
    const wantCover =
      state.player.fireTimer > 0 &&
      state.wantedLevel >= 2 &&
      (h.squadRole === 0 || h.squadRole >= 3);
    if (wantCover && h.aiState !== "cover") {
      const cover = nearestCoverObject(state, h, player);
      if (cover && dist(h.x, h.y, cover.x, cover.y) < COP_COVER_RANGE) {
        h.aiState = "cover";
        h.aiTargetX = cover.x;
        h.aiTargetY = cover.y;
      }
    }
    if (h.aiState === "cover") {
      const cd = dist(h.x, h.y, h.aiTargetX, h.aiTargetY);
      if (cd > 12) {
        const a = angleTo(h.x, h.y, h.aiTargetX, h.aiTargetY);
        h.vx = Math.cos(a) * h.speed * 1.0;
        h.vy = Math.sin(a) * h.speed * 1.0;
        return;
      }
      h.vx = 0;
      h.vy = 0;
      h.angle = angleTo(h.x, h.y, player.x, player.y);
      // Peek-fire — cops in cover are accurate
      if (h.fireTimer <= 0 && dToPlayer < COP_GUN_RANGE && Math.random() < 0.55) {
        fireBulletWithLead(state, h, player, 18);
        h.fireTimer = 0.5;
      }
      // Leave cover if player flees / stops shooting
      if (state.player.fireTimer <= 0 && Math.random() < 0.02) h.aiState = "chase";
      if (dToPlayer > 380) h.aiState = "chase";
      return;
    }

    // Predict where the player is heading
    const pvx = player.inVehicle ? player.inVehicle.vx : player.vx;
    const pvy = player.inVehicle ? player.inVehicle.vy : player.vy;
    const psp = Math.hypot(pvx, pvy);
    const predX = psp > 30 ? player.x + (pvx / psp) * 120 : player.x;
    const predY = psp > 30 ? player.y + (pvy / psp) * 120 : player.y;

    let targetX = player.x;
    let targetY = player.y;
    let preferredDist = COP_GUN_RANGE * 0.5;
    if (h.squadRole === 0) {
      // Suppressor: hold a position roughly behind the line
      preferredDist = COP_GUN_RANGE * 0.7;
      targetX = player.x;
      targetY = player.y;
    } else if (h.squadRole === 1) {
      // Flanker: 90deg from approach direction
      const approachA = angleTo(player.x, player.y, h.x, h.y);
      const flankA = approachA + Math.PI / 2;
      targetX = player.x + Math.cos(flankA) * 100;
      targetY = player.y + Math.sin(flankA) * 100;
      preferredDist = COP_GUN_RANGE * 0.5;
    } else if (h.squadRole === 2) {
      // Cutoff: get to the predicted player position ahead of them
      targetX = predX;
      targetY = predY;
      preferredDist = 30;
    } else {
      // Reserve: opposite side of suppressor
      const approachA = angleTo(player.x, player.y, h.x, h.y);
      targetX = player.x + Math.cos(approachA + Math.PI) * 80;
      targetY = player.y + Math.sin(approachA + Math.PI) * 80;
    }

    // BUST if close on foot. At 1-3 stars cops want to ARREST you, not kill,
    // so the bust radius is generous and they only need you to be roughly
    // walking-paced. At 4+ stars cops shoot first (see below) and the bust
    // radius tightens to vanilla. This is what the player asked for: "police
    // need to catch me at 2-3 stars not kill me".
    const arrestRadius = state.wantedLevel <= 3 ? 28 : 18;
    const arrestSpeedCap = state.wantedLevel <= 3 ? 70 : 30;
    if (
      dToPlayer < arrestRadius &&
      !player.inVehicle &&
      Math.hypot(player.vx, player.vy) < arrestSpeedCap
    ) {
      bustPlayer(state);
      return;
    }

    const aimA = angleTo(h.x, h.y, player.x, player.y);
    h.angle = aimA;

    const dToTarget = dist(h.x, h.y, targetX, targetY);
    if (dToTarget > preferredDist) {
      const a = angleTo(h.x, h.y, targetX, targetY);
      h.vx = Math.cos(a) * h.speed * 1.1;
      h.vy = Math.sin(a) * h.speed * 1.1;
    } else {
      const px = -Math.sin(aimA);
      const py = Math.cos(aimA);
      h.vx = px * h.strafeDir * h.speed * 0.7;
      h.vy = py * h.strafeDir * h.speed * 0.7;
      if (Math.random() < 0.008) h.strafeDir *= -1;
    }

    // SHOOT only at wanted ≥ 4. At 1-3 stars cops use non-lethal pursuit:
    // chase, surround, and tackle (see arrest block above). The player asked
    // for cops to "catch" them at 2-3 stars instead of killing them.
    // Suppressor still fires more often than flankers/cutoffs.
    if (h.fireTimer <= 0 && dToPlayer < COP_GUN_RANGE && state.wantedLevel >= 4) {
      fireBulletWithLead(state, h, player, 18);
      const cooldown = h.squadRole === 0 ? 0.4 : h.squadRole === 1 ? 0.6 : 0.8;
      h.fireTimer = cooldown;
    }

    // Try to commandeer parked cop car when wanted is high
    if (state.wantedLevel >= 3 && dToPlayer > 200) {
      const car = nearestParkedVehicle(state, h, 80, "police");
      if (car) {
        car.driver = h;
        h.inVehicle = car;
      }
    }
  } else {
    // Patrol calmly
    if (h.aiPath.length === 0 || h.aiTimer <= 0) {
      const node = world.roadGraph[Math.floor(Math.random() * world.roadGraph.length)]!;
      h.aiPath = [{ x: node.x + rand(-30, 30), y: node.y + rand(-30, 30) }];
      h.aiTimer = rand(5, 10);
    }
    const next = h.aiPath[0]!;
    if (dist(h.x, h.y, next.x, next.y) < 12) h.aiPath.shift();
    else {
      const a = angleTo(h.x, h.y, next.x, next.y);
      h.vx = Math.cos(a) * h.speed * 0.5;
      h.vy = Math.sin(a) * h.speed * 0.5;
    }
  }
}

function nearestParkedVehicle(
  state: GameState,
  h: Human,
  r: number,
  kindFilter?: string,
): Vehicle | null {
  let best: Vehicle | null = null;
  let bestD = r * r;
  for (const v of state.vehicles) {
    if (v.driver) continue;
    if (kindFilter && v.kind !== kindFilter) continue;
    const d = (v.x - h.x) ** 2 + (v.y - h.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

// ============================================================================
// VEHICLE DRIVER AI - lane following + intersection rules + collision avoidance
// ============================================================================

function updateDriverAI(
  h: Human,
  dt: number,
  world: WorldData,
  state: GameState,
) {
  const v = h.inVehicle!;
  const player = state.player;

  if (v.honkTimer > 0) v.honkTimer -= dt;
  if (v.pitTimer > 0) v.pitTimer -= dt;
  if (v.reverseTimer > 0) v.reverseTimer -= dt;

  // ---- BAIL OUT — civilians abandon a vehicle that's burning or critically
  // damaged. The driver pops out next to the car, panics, and runs.
  if (h.kind !== "police" && (v.onFire || v.hp < v.maxHp * 0.18)) {
    h.inVehicle = null;
    v.driver = null;
    // Place ped just to the left of the car
    const left = v.angle + Math.PI / 2;
    h.x = v.x + Math.cos(left) * (v.width / 2 + 4);
    h.y = v.y + Math.sin(left) * (v.width / 2 + 4);
    h.vx = 0;
    h.vy = 0;
    h.aiState = "panic";
    h.panicFromX = v.x;
    h.panicFromY = v.y;
    h.aiTimer = rand(4, 7);
    return;
  }

  // ---- STUCK RECOVERY — if the AI is requesting throttle but the car is
  // basically stationary for >1.2 s, slam reverse for ~0.8 s with random steer.
  // This pops drivers off curbs and unjams pursuit cars wedged on a corner.
  const speed = Math.hypot(v.vx, v.vy);
  if (v.reverseTimer <= 0) {
    if (v.throttle > 0.3 && speed < 18) {
      v.stuckTimer += dt;
      if (v.stuckTimer > 1.2) {
        v.reverseTimer = 0.8;
        v.stuckTimer = 0;
      }
    } else {
      v.stuckTimer = Math.max(0, v.stuckTimer - dt * 0.5);
    }
  }
  if (v.reverseTimer > 0) {
    // Reverse out — pick a steer direction and floor it backwards.
    const sign = ((v.id & 1) === 0 ? 1 : -1);
    v.steer = sign * 0.7;
    v.brake = 0;
    v.throttle = -0.9; // physics treats negative throttle as reverse
    return;
  }

  // POLICE chasing player
  if (h.kind === "police" && state.wantedLevel > 0) {
    drivePolicePursuit(h, v, dt, world, state);
    return;
  }

  // CIVILIAN driver - lane follow
  driveCivilian(h, v, dt, world, state);
  // CIVILIAN response to combat — used to floor the throttle, which created
  // mass pile-ups any time a single shot was fired. Real civilians PULL OVER:
  // slow down, drift toward the curb, blink the right turn signal, and only
  // honk briefly. Only respond when combat is genuinely close (220 px) so a
  // distant gunfight doesn't disturb the rest of the map.
  if (state.combatTimer > 0 && dist(v.x, v.y, player.x, player.y) < 220) {
    v.throttle = Math.min(v.throttle, 0.15);
    v.brake = Math.max(v.brake, 0.55);
    v.steer = clamp(v.steer + 0.25, -1, 1); // drift right
    v.signal = 1;
    // Honk at MOST a couple times per second, not per frame.
    if (v.honkTimer <= 0 && Math.random() < 0.3 * dt) v.honkTimer = 0.6;
  }
}

function driveCivilian(
  h: Human,
  v: Vehicle,
  dt: number,
  world: WorldData,
  state: GameState,
) {
  // If no current target, pick from nearest intersection going forward
  const tgtDist = dist(v.x, v.y, v.aiTargetX, v.aiTargetY);
  if (tgtDist < 30 || v.aiLastNode < 0) {
    pickNextRoadWaypoint(v, world);
  }

  // PULL OVER FOR SIREN — if a police car with active pursuit is close behind, slow & swerve right
  let copBehind = false;
  for (const o of state.vehicles) {
    if (o === v) continue;
    if (o.kind !== "police") continue;
    if (!o.driver || o.driver.aiState !== "chase") continue;
    const dx = o.x - v.x;
    const dy = o.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d > 140) continue;
    // Behind: dot product with our forward < 0
    const fwdDot = dx * Math.cos(v.angle) + dy * Math.sin(v.angle);
    if (fwdDot < -10) {
      copBehind = true;
      break;
    }
  }
  if (copBehind) {
    // Drift right and slow down
    v.steer = 0.5;
    v.throttle = 0.1;
    v.brake = 0.6;
    v.signal = 1;
    return;
  }

  // Steer toward target
  const desired = angleTo(v.x, v.y, v.aiTargetX, v.aiTargetY);
  let diff = desired - v.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  v.steer = clamp(diff * 2.5, -1, 1);
  // turn signal
  v.signal = Math.abs(diff) > 0.4 ? Math.sign(diff) : 0;

  // Default throttle
  let throttle = 0.55;
  let brake = 0;

  // Forward sensor: brake if vehicle/ped in front
  const sp = Math.hypot(v.vx, v.vy);
  const fwdX = Math.cos(v.angle);
  const fwdY = Math.sin(v.angle);
  let frontObstacle = 9999;
  for (const o of state.vehicles) {
    if (o === v) continue;
    const dx = o.x - v.x;
    const dy = o.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d > CAR_FRONT_SENSOR) continue;
    const dot = (dx * fwdX + dy * fwdY) / (d || 1);
    if (dot > 0.85 && d < frontObstacle) frontObstacle = d;
  }
  // Cars now scan further ahead for pedestrians (was 60px / cone 0.7) so
  // they brake politely instead of running peds over. Wider cone catches
  // peds that are crossing diagonally, not just walking dead-ahead.
  for (const ped of state.humans) {
    if (ped.inVehicle) continue;
    if (ped.hp <= 0) continue;
    const dx = ped.x - v.x;
    const dy = ped.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d > 95) continue;
    const dot = (dx * fwdX + dy * fwdY) / (d || 1);
    if (dot > 0.5 && d < frontObstacle) frontObstacle = d;
  }
  if (frontObstacle < 30) {
    throttle = 0;
    brake = 1;
    // Per-second honk rate (~1/s), not per-frame. The old `< 0.05` triggered
    // about three times a second at 60fps, which was a constant beep storm.
    if (v.honkTimer <= 0 && Math.random() < 1.0 * dt) v.honkTimer = 0.6;
  } else if (frontObstacle < 60) {
    throttle = 0.15;
    brake = 0.4;
  }

  // Approach intersection — if there's perpendicular traffic close, yield.
  // We also pre-emptively coast (no full stop) if we're inside the
  // intersection box without right-of-way, so simultaneous arrivals don't
  // T-bone each other.
  const apx = approachingIntersection(v, world);
  if (apx && anyCrossingTraffic(v, apx, state)) {
    throttle = Math.min(throttle, 0.05);
    brake = Math.max(brake, 0.7);
  }
  // ---- TRAFFIC SIGNAL ----
  // If a signal-controlled intersection is in front of us and our direction
  // has a red light, stop at the stop line (about 35 px back from the
  // intersection center). Yellow phase (last 1.5 s of the green window)
  // also makes us slow down and prepare to stop.
  if (apx) {
    const dToIntersection = dist(v.x, v.y, apx.x, apx.y);
    const lightState = signalForVehicle(v, state); // "green" | "yellow" | "red"
    if (lightState === "red" && dToIntersection > 28 && dToIntersection < 90) {
      throttle = 0;
      brake = Math.max(brake, 0.85);
    } else if (lightState === "yellow" && dToIntersection > 28 && dToIntersection < 70) {
      throttle = Math.min(throttle, 0.1);
      brake = Math.max(brake, 0.55);
    }
  }

  // If pointing far off target (sharp turn), slow down
  if (Math.abs(diff) > 0.8 && sp > 80) {
    throttle = 0.2;
    brake = 0.3;
  }

  v.throttle = throttle;
  v.brake = brake;
}

function approachingIntersection(v: Vehicle, world: WorldData): RoadNode | null {
  // Find the nearest intersection node within 120 px in front of the car
  let best: RoadNode | null = null;
  let bestD = 120;
  const fwdX = Math.cos(v.angle);
  const fwdY = Math.sin(v.angle);
  for (const n of world.roadGraph) {
    const dx = n.x - v.x;
    const dy = n.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d > bestD) continue;
    const dot = (dx * fwdX + dy * fwdY) / (d || 1);
    if (dot > 0.5) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

// Returns the signal state ("green"/"yellow"/"red") for the given vehicle
// based on the approached intersection. We classify the car's heading as
// either "ns" (north-south) or "ew" (east-west) and compare to the global
// trafficPhase. The last 1.5 s of each green window is "yellow" — drivers
// should brake and prepare to stop.
function signalForVehicle(v: Vehicle, state: GameState): "green" | "yellow" | "red" {
  // Heading = N/S if facing roughly along ±y, otherwise E/W.
  const ax = Math.cos(v.angle);
  const ay = Math.sin(v.angle);
  const heading: "ns" | "ew" = Math.abs(ay) > Math.abs(ax) ? "ns" : "ew";
  const greenForPhase: "ns" | "ew" = state.trafficPhase === 0 ? "ns" : "ew";
  if (heading !== greenForPhase) return "red";
  // We're on green. Check if we're in the last 1.5 s — that's yellow.
  // We don't have access to TRAFFIC_GREEN at this scope so reuse a constant.
  const TRAFFIC_GREEN = 14;
  if (state.trafficPhaseTimer > TRAFFIC_GREEN - 1.5) return "yellow";
  return "green";
}

function anyCrossingTraffic(
  v: Vehicle,
  intersection: RoadNode,
  state: GameState,
): boolean {
  // Yield to perpendicular traffic that's closer to the intersection. If both
  // cars are basically tied (within 6 px) we use vehicle id as a deterministic
  // tie-breaker so the lower-id car has the right of way and the other yields.
  // Without this both cars sometimes brake forever and deadlock at the corner.
  const myD = dist(v.x, v.y, intersection.x, intersection.y);
  for (const o of state.vehicles) {
    if (o === v) continue;
    const oD = dist(o.x, o.y, intersection.x, intersection.y);
    if (oD > 70) continue;
    // Skip stopped cars (they've already yielded or are parked) so we don't
    // sit forever staring at someone who's also waiting on us.
    if (Math.hypot(o.vx, o.vy) < 5) continue;
    const oa = Math.atan2(o.vy, o.vx);
    let diff = Math.abs(oa - v.angle);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
    // perpendicular ~ 90deg
    if (diff > Math.PI * 0.35 && diff < Math.PI * 0.65) {
      if (oD < myD - 6) return true; // they clearly got there first
      if (Math.abs(oD - myD) <= 6 && o.id < v.id) return true; // tie-break
    }
  }
  return false;
}

function pickNextRoadWaypoint(v: Vehicle, world: WorldData) {
  // Determine current heading based on car's facing
  const headings = ["e", "s", "w", "n"] as const;
  // Convert angle to nearest cardinal
  const a = v.angle;
  // 0 = +x = east. PI/2 = +y = south. PI = -x = west. -PI/2 = -y = north.
  let dirIdx = 0;
  if (a > -Math.PI / 4 && a < Math.PI / 4) dirIdx = 0; // E
  else if (a >= Math.PI / 4 && a < (Math.PI * 3) / 4) dirIdx = 1; // S
  else if (a < -Math.PI / 4 && a > -(Math.PI * 3) / 4) dirIdx = 3; // N
  else dirIdx = 2; // W

  // Find closest intersection node, set as last node
  let lastIdx = v.aiLastNode;
  if (lastIdx < 0) {
    // Find nearest
    let bestD = Infinity;
    for (let i = 0; i < world.roadGraph.length; i++) {
      const n = world.roadGraph[i]!;
      const d = (n.x - v.x) ** 2 + (n.y - v.y) ** 2;
      if (d < bestD) {
        bestD = d;
        lastIdx = i;
      }
    }
  }
  if (lastIdx < 0) return;
  const here = world.roadGraph[lastIdx]!;

  // Pick a direction: 70% forward, 15% left, 15% right
  const r = Math.random();
  let nextDir = dirIdx;
  if (r < 0.7) nextDir = dirIdx;
  else if (r < 0.85) nextDir = (dirIdx + 3) % 4; // left turn
  else nextDir = (dirIdx + 1) % 4; // right turn

  const dirKey = headings[nextDir]!;
  let nextIdx = here.dir[dirKey];
  if (nextIdx < 0) {
    // fallback: any neighbor
    if (here.neighbors.length > 0)
      nextIdx = here.neighbors[Math.floor(Math.random() * here.neighbors.length)]!;
    else return;
  }
  const next = world.roadGraph[nextIdx]!;
  // Apply right-lane offset: perpendicular to direction of travel, to the right
  const dx = next.x - here.x;
  const dy = next.y - here.y;
  const d = Math.hypot(dx, dy) || 1;
  const px = -dy / d;
  const py = dx / d;
  // "right" of forward = rotate forward by +90deg; the perpendicular (px,py) above is +90
  v.aiTargetX = next.x + px * LANE_OFFSET;
  v.aiTargetY = next.y + py * LANE_OFFSET;
  v.aiLastNode = nextIdx;
  v.aiHeading = nextDir;
}

// ============================================================================
// POLICE PURSUIT DRIVING
// ============================================================================

function drivePolicePursuit(
  h: Human,
  v: Vehicle,
  dt: number,
  world: WorldData,
  state: GameState,
) {
  const player = state.player;
  // Predict player position
  const lead = 0.4;
  const pvx = player.inVehicle ? player.inVehicle.vx : player.vx;
  const pvy = player.inVehicle ? player.inVehicle.vy : player.vy;
  const tx = player.x + pvx * lead;
  const ty = player.y + pvy * lead;

  // Coordinate: cars pick distinct strategies based on their index
  //   car 0: tail (chase from behind)
  //   car 1: cutoff (drive to an intersection ahead of the player)
  //   car 2: parallel chase one block to the LEFT of the player
  //   car 3: BOX-IN — parallel chase one block to the RIGHT of the player
  //          (combined with cars 0 and 2 this forms a 3-sided box)
  //   car 4+: trail support
  const cops = state.vehicles.filter((c) => c.driver?.kind === "police" && c.driver.inVehicle === c);
  const myIdx = cops.indexOf(v);

  let targetX = tx;
  let targetY = ty;
  if (myIdx === 1) {
    // Cutoff: project player position WAY ahead, snap to nearest intersection
    const farX = player.x + pvx * 1.4;
    const farY = player.y + pvy * 1.4;
    let best: RoadNode | null = null;
    let bestD = Infinity;
    for (const n of world.roadGraph) {
      const d = (n.x - farX) ** 2 + (n.y - farY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    if (best) {
      targetX = best.x;
      targetY = best.y;
    }
  } else if (myIdx === 2) {
    // Parallel LEFT side
    const sideA = Math.atan2(pvy, pvx) + Math.PI / 2;
    targetX = tx + Math.cos(sideA) * 120;
    targetY = ty + Math.sin(sideA) * 120;
  } else if (myIdx === 3) {
    // BOX-IN — parallel RIGHT side (opposite of car 2). Together they pinch the
    // player's car between them so a swerve into either lane runs into a unit.
    const sideA = Math.atan2(pvy, pvx) - Math.PI / 2;
    targetX = tx + Math.cos(sideA) * 120;
    targetY = ty + Math.sin(sideA) * 120;
  }
  // car 0 and 4+ tail directly

  const desired = angleTo(v.x, v.y, targetX, targetY);
  let diff = desired - v.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  v.steer = clamp(diff * 2.5, -1, 1);

  const dToPlayer = dist(v.x, v.y, player.x, player.y);
  v.throttle = dToPlayer > 60 ? 1 : 0.4;
  v.brake = 0;

  // PIT: if close behind and aligned with player's vehicle, ram them
  if (player.inVehicle && v.pitTimer <= 0 && dToPlayer < 50) {
    const playerVel = Math.hypot(player.inVehicle.vx, player.inVehicle.vy);
    if (playerVel > 60) {
      // Steer slightly into the back-corner of player's car
      const targetSide = Math.random() < 0.5 ? -1 : 1;
      const aimA = angleTo(v.x, v.y, player.inVehicle.x, player.inVehicle.y);
      let d2 = aimA - v.angle;
      while (d2 > Math.PI) d2 -= Math.PI * 2;
      while (d2 < -Math.PI) d2 += Math.PI * 2;
      v.steer = clamp((d2 + targetSide * 0.4) * 2.5, -1, 1);
      v.throttle = 1;
      v.pitTimer = 2.5;
    }
  }

  // Drive-by shoot — only at wanted ≥ 4. At 1-3 stars cops use the cruiser
  // to ram, PIT, and box-in for an arrest, but no lethal gunfire from the
  // car. Matches the on-foot non-lethal arrest rules above.
  if (state.wantedLevel >= 4 && h.fireTimer <= 0 && dToPlayer < 200) {
    const a = angleTo(v.x, v.y, player.x, player.y);
    fireBulletWithLead(state, h, player, 16);
    h.fireTimer = 0.7;
    void a;
  }

  // If facing very wrong way, brake to avoid wide oversteer
  if (Math.abs(diff) > 1.5 && Math.hypot(v.vx, v.vy) > 100) {
    v.brake = 0.7;
    v.throttle = 0.2;
  }
}

// ============================================================================
// SHOOTING (with lead prediction)
// ============================================================================

export function fireBullet(
  state: GameState,
  shooter: Human,
  angle: number,
  damage: number,
) {
  if (shooter.weapon === "fist") return;
  if (shooter.ammo <= 0 && !shooter.isPlayer) return;
  if (shooter.ammo > 0) shooter.ammo -= 1;
  const sp = 600;
  const sx = shooter.x + Math.cos(angle) * 6;
  const sy = shooter.y + Math.sin(angle) * 6;
  state.bullets.push({
    x: sx,
    y: sy,
    vx: Math.cos(angle) * sp,
    vy: Math.sin(angle) * sp,
    life: 0.6,
    damage,
    owner: shooter.id,
  });
  for (let i = 0; i < 4; i++) {
    state.particles.push({
      x: sx,
      y: sy,
      vx: Math.cos(angle + rand(-0.3, 0.3)) * rand(40, 90),
      vy: Math.sin(angle + rand(-0.3, 0.3)) * rand(40, 90),
      life: 0.08,
      maxLife: 0.08,
      size: 1.5,
      kind: "muzzle",
      color: "#fff080",
      rotation: 0,
      rotationSpeed: 0,
    });
  }
}

export function fireBulletWithLead(
  state: GameState,
  shooter: Human,
  target: Human,
  damage: number,
) {
  // Predict where target will be in ~0.3s
  const bulletSpeed = 600;
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const d = Math.hypot(dx, dy);
  const t = d / bulletSpeed;
  const tvx = target.inVehicle ? target.inVehicle.vx : target.vx;
  const tvy = target.inVehicle ? target.inVehicle.vy : target.vy;
  const px = target.x + tvx * t;
  const py = target.y + tvy * t;
  // Add inaccuracy
  const inacc = (target.inVehicle ? 0.15 : 0.1);
  const a = angleTo(shooter.x, shooter.y, px, py) + rand(-inacc, inacc);
  fireBullet(state, shooter, a, damage);
}

export function bustPlayer(state: GameState) {
  // Just flag the bust; the main game loop runs the cinematic, respawn,
  // money/weapon penalties, and despawn of nearby cops/gangs.
  if (state.endScreen) return;
  state.player.busted = true;
}
