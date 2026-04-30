// Main game orchestration: spawning, ticking systems, weather, missions
import type {
  GameState,
  Human,
  Vehicle,
  WeatherKind,
  TimeOfDay,
  Pickup,
  Mission,
  PropKind,
} from "./types";
import { generateWorld, TILE, MAP_TILES, findNearestRoad, isSolidAt } from "./world";
import type { WorldData } from "./world";
import {
  createHuman,
  createVehicle,
  createAnimal,
  createBirdFlock,
  createProp,
  VEHICLE_KINDS,
} from "./factory";
import { audioEngine } from "./audio";
import {
  updateVehicle,
  updateHuman,
  vehicleVsVehicle,
  vehicleVsHuman,
  spawnFire,
  spawnSmoke,
  spawnBlood,
  explodeVehicle,
  raiseWanted,
  addScore,
} from "./physics";
import { updateHumanAI, fireBullet, bustPlayer } from "./ai";
import { clamp, dist, distSq, lerpAngle, pick, rand } from "./utils";
import { enterInterior, updateInterior } from "./interior";

const TARGET_VEHICLES = 28;
const TARGET_PEDS = 36;
const TARGET_GANG = 6;
const SPAWN_RADIUS = 700;
const DESPAWN_RADIUS = 1100;

export interface Game {
  world: WorldData;
  state: GameState;
}

export function createGame(seed = 42): Game {
  const world = generateWorld(seed);
  // Find a road tile near map center
  const cx = (MAP_TILES / 2) * TILE;
  const cy = (MAP_TILES / 2) * TILE;
  const spawn = findNearestRoad(world, cx, cy);
  const player = createHuman("player", spawn.x, spawn.y, 0);
  const state: GameState = {
    player,
    vehicles: [],
    humans: [player],
    animals: [],
    birdFlocks: [],
    props: [],
    bullets: [],
    particles: [],
    skidMarks: [],
    decals: [],
    pickups: [],
    windAngle: rand(0, Math.PI * 2),
    windStrength: 0.4,
    camera: { x: spawn.x, y: spawn.y, zoom: 2.4, shake: 0 },
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      enter: false,
      fire: false,
      handbrake: false,
      sprint: false,
      mouseX: 0,
      mouseY: 0,
      mouseDown: false,
      nearbyShopId: null,
    },
    weather: "clear",
    timeOfDay: "day",
    worldTime: 8 * 60, // start at 8am, in minutes
    wantedLevel: 0,
    wantedDecayTimer: 0,
    score: 0,
    money: 100,
    combo: 0,
    comboTimer: 0,
    paused: false,
    mapWidth: world.pixelWidth,
    mapHeight: world.pixelHeight,
    mapSeed: seed,
    musicState: "calm",
    notifications: [],
    damageFlash: 0,
    combatTimer: 0,
    endScreen: null,
    shopOverlay: null,
    spawnPoint: { x: spawn.x, y: spawn.y },
    interior: null,
    interiorReturnX: spawn.x,
    interiorReturnY: spawn.y,
    interiorInteractActive: false,
    missions: [],
    activeMission: null,
    missionsCompleted: 0,
    missionSpawnTimer: 6,
    trafficPhase: 0,
    trafficPhaseTimer: 0,
  };
  // Scatter environment props: trees on grass, hydrants/mailboxes/lamps along sidewalks
  for (let ty = 0; ty < world.tiles.length; ty++) {
    const row = world.tiles[ty]!;
    for (let tx = 0; tx < row.length; tx++) {
      const t = row[tx]!;
      const wx = tx * TILE + TILE / 2;
      const wy = ty * TILE + TILE / 2;
      if (t.type === "grass") {
        // Park grass uses variant 4-7. Higher variants = denser greenery.
        const isPark = (t.variant ?? 0) >= 4;
        const base = isPark ? 0.55 : 0.10;
        if (Math.random() < base) {
          // Pick a random tree species
          const r = Math.random();
          const species: PropKind =
            r < 0.45 ? "tree" : r < 0.7 ? "oak" : r < 0.88 ? "pine" : "palm";
          state.props.push(
            createProp(species, wx + rand(-10, 10), wy + rand(-10, 10), Math.floor(rand(0, 4))),
          );
        }
        if (Math.random() < (isPark ? 0.22 : 0.05)) {
          state.props.push(createProp("bush", wx + rand(-12, 12), wy + rand(-12, 12)));
        }
        // Flowers — colorful little patches
        if (Math.random() < (isPark ? 0.18 : 0.04)) {
          state.props.push(
            createProp("flowers", wx + rand(-12, 12), wy + rand(-12, 12), Math.floor(rand(0, 4))),
          );
        }
        // Tall grass tufts
        if (Math.random() < 0.20) {
          state.props.push(
            createProp("tallgrass", wx + rand(-12, 12), wy + rand(-12, 12), Math.floor(rand(0, 3))),
          );
        }
        // Rare cactus
        if (!isPark && Math.random() < 0.015) {
          state.props.push(createProp("cactus", wx + rand(-8, 8), wy + rand(-8, 8)));
        }
        if (isPark && Math.random() < 0.04) {
          state.props.push(createProp("bench", wx, wy));
        }
      } else if (t.type === "plaza") {
        // Fountain centerpiece on every plaza tile
        state.props.push(createProp("fountain", wx, wy));
      } else if (t.type === "sidewalk") {
        if (Math.random() < 0.04) {
          state.props.push(createProp("hydrant", wx + rand(-6, 6), wy + rand(-6, 6)));
        } else if (Math.random() < 0.03) {
          state.props.push(createProp("mailbox", wx + rand(-6, 6), wy + rand(-6, 6)));
        } else if (Math.random() < 0.05) {
          state.props.push(createProp("trashcan", wx + rand(-6, 6), wy + rand(-6, 6)));
        } else if (Math.random() < 0.06) {
          state.props.push(createProp("lamp", wx + rand(-4, 4), wy + rand(-4, 4)));
        }
      }
    }
  }

  // Spawn some pickups along roads
  for (let i = 0; i < 14; i++) {
    const node = pick(world.roadGraph);
    const kinds: Pickup["kind"][] = [
      "health",
      "ammo",
      "armor",
      "ammo",
      "wantedClear",
      "speed",
    ];
    state.pickups.push({
      x: node.x + rand(-50, 50),
      y: node.y + rand(-50, 50),
      kind: pick(kinds),
      bob: rand(0, Math.PI * 2),
    });
  }
  return { world, state };
}

export function tick(game: Game, dt: number) {
  const { state, world } = game;
  if (state.paused) return;

  // ---- INTERIOR MODE: world is paused, only the interior simulation runs ----
  if (state.interior) {
    updateInterior(state, dt);
    // Notifications still fade so messages clear nicely
    for (let i = state.notifications.length - 1; i >= 0; i--) {
      state.notifications[i]!.life -= dt;
      if (state.notifications[i]!.life <= 0) state.notifications.splice(i, 1);
    }
    if (state.damageFlash > 0) state.damageFlash = Math.max(0, state.damageFlash - dt * 2);
    return;
  }

  // Time of day cycles every 4 minutes real time = full day
  state.worldTime += dt * 6; // 1 sec real = 6 game min
  const hour = (state.worldTime / 60) % 24;
  let newTOD: TimeOfDay = "day";
  if (hour < 6 || hour > 20) newTOD = "night";
  else if (hour < 7.5 || hour > 18.5) newTOD = "dusk";
  state.timeOfDay = newTOD;

  // Weather change every ~120s
  if (Math.floor(state.worldTime / 60) % 6 === 0 && Math.random() < 0.001) {
    const opts: WeatherKind[] = ["clear", "clear", "rain", "fog", "storm", "snow", "wind"];
    state.weather = pick(opts);
  }
  // Wind drifts slowly so leaves/snow look natural
  state.windAngle += (Math.sin(state.worldTime * 0.03) * 0.5 - 0.25) * dt;
  state.windStrength =
    state.weather === "wind"
      ? 1.4
      : state.weather === "storm"
        ? 1.1
        : state.weather === "snow"
          ? 0.5
          : state.weather === "rain"
            ? 0.7
            : 0.3;

  // Shop interaction first — so the E press is consumed by the shop before
  // the vehicle enter/exit logic sees it. Without this order, pressing E on
  // foot near a shop is swallowed by the "enter vehicle" branch and pressing
  // E in a car next to Pay 'n' Spray exits the car instead of triggering the
  // service.
  if (!state.endScreen) {
    updateShops(state, world, dt);
  }

  // Player input -> movement (skip while end-screen overlay is up)
  if (!state.endScreen) {
    applyPlayerInput(state, dt);
  }

  // Update vehicles
  for (const v of state.vehicles) updateVehicle(v, dt, world, state);
  // Update humans (AI then physics)
  for (const h of state.humans) {
    if (!h.isPlayer) updateHumanAI(h, dt, world, state);
  }
  for (const h of state.humans) updateHuman(h, dt, world, state);

  // Vehicle collisions
  vehicleVsVehicle(state);
  vehicleVsHuman(state);

  // Bullets
  updateBullets(state, dt, world);

  // Particles
  updateParticles(state, dt);

  // Skid marks fade
  for (let i = state.skidMarks.length - 1; i >= 0; i--) {
    state.skidMarks[i]!.alpha -= dt * 0.05;
    if (state.skidMarks[i]!.alpha <= 0) state.skidMarks.splice(i, 1);
  }

  // Decals fade slowly
  for (const d of state.decals) {
    d.alpha = Math.max(0.4, d.alpha - dt * 0.005);
  }

  // Pickup collection
  collectPickups(state);

  // Missions: spawn / progress / complete
  tickMissions(state, world, dt);

  // Shop interaction (enter doors when on foot)
  updateShops(state, world, dt);

  // Wanted decay
  if (state.wantedLevel > 0 && state.combatTimer <= 0) {
    state.wantedDecayTimer -= dt;
    if (state.wantedDecayTimer <= 0) {
      state.wantedLevel = Math.max(0, state.wantedLevel - 1);
      state.wantedDecayTimer = 30;
    }
  }
  if (state.combatTimer > 0) state.combatTimer -= dt;

  // Combo timer
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // Notifications fade
  for (let i = state.notifications.length - 1; i >= 0; i--) {
    state.notifications[i]!.life -= dt;
    if (state.notifications[i]!.life <= 0) state.notifications.splice(i, 1);
  }

  // Damage flash decay
  if (state.damageFlash > 0) state.damageFlash = Math.max(0, state.damageFlash - dt * 2);

  // Per-human car-hit i-frame countdown (player + every NPC). Without this,
  // any human that ever got brushed by a car would stay at hitCooldown=0.4
  // forever and become invulnerable to traffic.
  for (const h of state.humans) {
    if (h.hitCooldown > 0) {
      h.hitCooldown = Math.max(0, h.hitCooldown - dt);
    }
  }

  // ---- TRAFFIC SIGNAL PHASE ----
  // Toggle the city-wide N-S / E-W signal phase. Each green window is
  // TRAFFIC_GREEN seconds. The yellow window is implicit — drivers begin
  // braking based on the timer at lights, but the phase only flips at the end.
  state.trafficPhaseTimer += dt;
  const TRAFFIC_GREEN = 14;
  if (state.trafficPhaseTimer >= TRAFFIC_GREEN) {
    state.trafficPhase = (state.trafficPhase === 0 ? 1 : 0) as 0 | 1;
    state.trafficPhaseTimer = 0;
  }

  // Camera follow
  updateCamera(state, dt);

  // Spawn / despawn entities
  manageSpawns(state, world);

  // Weather particles
  if (state.weather === "rain" || state.weather === "storm") {
    spawnRainParticles(state);
  } else if (state.weather === "snow") {
    spawnSnowParticles(state);
  } else if (state.weather === "wind") {
    spawnLeafParticles(state);
  }

  // Update animals + bird flocks
  updateAnimals(state, dt, world);
  updateBirdFlocks(state, dt);

  // Music mood
  updateMusicMood(state);

  // Health regen if not in combat
  if (state.combatTimer <= 0 && state.player.hp < state.player.maxHp) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + dt * 2);
  }

  // Player death (WASTED) - kicks off cinematic overlay (with 1.4s dying anim first)
  if (state.player.hp <= 0 && !state.endScreen) {
    state.endScreen = { kind: "wasted", timer: 3, dyingTimer: 1.4 };
    state.damageFlash = 1;
    state.combatTimer = 0;
    state.player.deathAnim = 0;
    // Eject from vehicle so the body falls in the street
    if (state.player.inVehicle) {
      state.player.inVehicle.driver = null;
      state.player.inVehicle = null;
    }
  }

  // Player busted by police (also a cinematic overlay, no dying anim)
  if (state.player.busted && !state.endScreen) {
    state.endScreen = { kind: "busted", timer: 3, dyingTimer: 0 };
    if (state.player.inVehicle) {
      state.player.inVehicle.driver = null;
      state.player.inVehicle = null;
    }
  }
  state.player.busted = false;

  // Tick the end-screen overlay; on completion, respawn the player far from trouble
  if (state.endScreen) {
    if (state.endScreen.dyingTimer > 0) {
      // DYING PHASE: animate the death; do NOT tick overlay timer yet
      state.endScreen.dyingTimer -= dt;
      // deathAnim ramps from 0 -> 1 over 1.4s
      state.player.deathAnim = Math.min(
        1,
        state.player.deathAnim + dt / 1.4,
      );
      // body slumps and stops
      state.player.vx *= Math.pow(0.001, dt);
      state.player.vy *= Math.pow(0.001, dt);
      // tilt body angle slowly
      state.player.angle += dt * 0.6;
      // grow blood pool decal once
      if (state.player.deathAnim > 0.4 && state.player.deathAnim < 0.45) {
        state.decals.push({
          x: state.player.x,
          y: state.player.y,
          size: 22,
          rotation: Math.random() * Math.PI * 2,
          alpha: 0.85,
          kind: "blood",
        });
      }
      // periodic blood spurt
      if (Math.random() < 0.3) {
        state.particles.push({
          x: state.player.x + rand(-3, 3),
          y: state.player.y + rand(-3, 3),
          vx: rand(-30, 30),
          vy: rand(-30, 30),
          life: 0.6,
          maxLife: 0.6,
          size: 2,
          kind: "blood",
          color: "#a01818",
          rotation: 0,
          rotationSpeed: 0,
        });
      }
      // Camera zooms in slightly
      state.camera.zoom = Math.min(3.4, state.camera.zoom + dt * 0.6);
      return;
    }
    state.endScreen.timer -= dt;
    // Freeze gameplay velocities while the overlay is up
    state.player.vx = 0;
    state.player.vy = 0;
    if (state.endScreen.timer <= 0) {
      const wasBusted = state.endScreen.kind === "busted";
      state.endScreen = null;
      state.player.hp = state.player.maxHp;
      state.wantedLevel = 0;
      state.combatTimer = 0;
      state.money = Math.floor(state.money * (wasBusted ? 0.7 : 0.5));
      if (wasBusted) {
        // Strip ammo down so the player can't immediately re-aggro
        state.player.ammo = 0;
        state.player.weapon = "fist";
      }
      // Respawn at the player's claimed safehouse (initial spawn point at game start).
      // Falls back to a fresh road tile if for some reason we have no spawn point.
      const safe = state.spawnPoint
        ?? findSafeRespawn(world, state, state.player.x, state.player.y);
      state.player.x = safe.x;
      state.player.y = safe.y;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.deathAnim = 0;
      state.camera.zoom = 2.4;
      // Despawn nearby cops/gangs to give a fresh start
      for (let i = state.humans.length - 1; i >= 0; i--) {
        const h = state.humans[i]!;
        if (h.isPlayer) continue;
        if (h.kind !== "police" && h.kind !== "gang") continue;
        if (dist(h.x, h.y, state.player.x, state.player.y) < 600) {
          if (h.inVehicle) {
            h.inVehicle.driver = null;
            h.inVehicle = null;
          }
          state.humans.splice(i, 1);
        }
      }
    }
  }
}

function findSafeRespawn(
  world: WorldData,
  state: GameState,
  fromX: number,
  fromY: number,
): { x: number; y: number } {
  // Try several random road nodes; pick one far from the danger zone
  let best = world.roadGraph[0]!;
  let bestScore = -Infinity;
  for (let i = 0; i < 20; i++) {
    const n = world.roadGraph[Math.floor(Math.random() * world.roadGraph.length)]!;
    const d = dist(n.x, n.y, fromX, fromY);
    // prefer far from the current spot; small noise to vary
    const score = d + Math.random() * 50;
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return { x: best.x, y: best.y };
}

function applyPlayerInput(state: GameState, dt: number) {
  const p = state.player;
  const inp = state.input;
  if (p.inVehicle) {
    const v = p.inVehicle;
    const turn = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    v.steer = turn;
    v.handbrake = inp.handbrake ? 1 : 0;
    // Smart throttle/brake: down-arrow brakes when moving forward, reverses when stopped.
    const fwdSpeed = v.vx * Math.cos(v.angle) + v.vy * Math.sin(v.angle);
    v.brake = 0;
    v.throttle = 0;
    if (inp.up) {
      if (fwdSpeed < -5) {
        v.brake = 1; // Brake out of reverse
      } else {
        v.throttle = 1;
      }
    } else if (inp.down) {
      if (fwdSpeed > 10) {
        v.brake = 1; // Brake from forward motion
      } else {
        v.throttle = -0.6; // Reverse (slower than forward)
      }
    }
    // Exit
    if (inp.enter) {
      inp.enter = false;
      exitVehicle(state);
    }
    // Drive-by shoot
    if (inp.fire) {
      tryFire(state, p);
    }
  } else {
    // On foot
    let mx = 0;
    let my = 0;
    if (inp.up) my -= 1;
    if (inp.down) my += 1;
    if (inp.left) mx -= 1;
    if (inp.right) mx += 1;
    const m = Math.hypot(mx, my);
    // ---- SPRINT (Shift) ----
    // Hold Shift while moving on foot to sprint at ~1.65× speed. Stamina
    // drains while sprinting and regenerates while jogging or standing.
    // When stamina hits 0 the player is "winded" — sprint locks out until
    // stamina recovers above 35%. This stops the player from infinitely
    // tap-spamming sprint during chases.
    if (p.staminaLocked && p.stamina > 0.35) p.staminaLocked = false;
    const wantsSprint = inp.sprint && m > 0 && !p.staminaLocked;
    if (wantsSprint) {
      p.stamina = Math.max(0, p.stamina - dt * 0.42);
      if (p.stamina <= 0) p.staminaLocked = true;
    } else {
      // Faster regen when standing still, slower while walking
      const regen = m > 0 ? 0.18 : 0.32;
      p.stamina = Math.min(1, p.stamina + dt * regen);
    }
    const sprintMul = wantsSprint ? 1.65 : 1;
    if (m > 0) {
      mx /= m;
      my /= m;
      p.vx = mx * p.speed * sprintMul;
      p.vy = my * p.speed * sprintMul;
    } else {
      p.vx = 0;
      p.vy = 0;
    }
    // Aim with mouse if mouse is moving / fire pressed
    // mouse coords are in screen space, convert
    if (inp.mouseDown || inp.fire) {
      // Translate mouse screen pos to world via state.camera
      const screenCx = window.innerWidth / 2;
      const screenCy = window.innerHeight / 2;
      const wx = state.camera.x + (inp.mouseX - screenCx) / state.camera.zoom;
      const wy = state.camera.y + (inp.mouseY - screenCy) / state.camera.zoom;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
      tryFire(state, p);
    }
    // Enter vehicle — only consume the E press if a vehicle is actually
    // nearby; otherwise let `updateShops` get a chance to see it so the
    // player can walk into shops.
    if (inp.enter) {
      const v = nearestVehicle(state, p, 30);
      if (v) {
        inp.enter = false;
        // Carjack if occupied
        if (v.driver && v.driver !== p) {
          const occupant = v.driver;
          occupant.inVehicle = null;
          occupant.x = v.x + Math.cos(v.angle + Math.PI / 2) * 16;
          occupant.y = v.y + Math.sin(v.angle + Math.PI / 2) * 16;
          occupant.aiState = occupant.kind === "police" ? "chase" : "flee";
          if (occupant.kind === "police") {
            raiseWanted(state, 2);
          } else {
            raiseWanted(state, 1);
          }
          state.notifications.push({
            text: "Carjacked!",
            life: 1.5,
            color: "#ffaa30",
          });
        }
        v.driver = p;
        p.inVehicle = v;
      }
    }
  }
}

function tryFire(state: GameState, p: Human) {
  // Bare fists branch into a melee swing instead of a gunshot.
  if (p.weapon === "fist") {
    tryPunch(state, p);
    return;
  }
  if (p.fireTimer > 0) return;
  if (p.ammo <= 0) return;
  p.ammo -= 1;
  fireBullet(state, p, p.angle, 25);
  audioEngine.playGunshot();
  // Slight cooldown by weapon
  p.fireTimer =
    p.weapon === "smg" ? 0.07 : p.weapon === "shotgun" ? 0.7 : 0.18;
  // Recoil: shotgun is heavy, others almost imperceptible
  const recoil = p.weapon === "shotgun" ? 3 : p.weapon === "smg" ? 0.4 : 0.8;
  state.camera.shake = Math.max(state.camera.shake, recoil);
  // If shooting raises wanted
  raiseWanted(state, 1);
  state.combatTimer = Math.max(state.combatTimer, 4);
}

// ---- MELEE / PUNCH --------------------------------------------------------
// A punch is a short-range cone in front of the attacker. It hits the closest
// human or vehicle within PUNCH_RANGE whose direction lies within ~50° of the
// attacker's facing. Damage is moderate (one-shot for ordinary peds, several
// hits for cops/gangs) and applies knockback. Punching another actor is the
// trigger for the "rules" below — peds may panic OR fight back, cops escalate
// the wanted level, gangs go straight to attack, and car drivers either bail
// out swinging or floor the gas in fear.
const PUNCH_RANGE = 14;
const PUNCH_CAR_RANGE = 18;
const PUNCH_DURATION = 0.28;
const PUNCH_COOLDOWN = 0.42;
const PUNCH_DAMAGE = 22;

function tryPunch(state: GameState, p: Human) {
  if (p.fireTimer > 0) return;
  // Lock both timers — fireTimer gates re-swinging, punchTimer drives the
  // visible arm-extension animation in sprites.ts.
  p.fireTimer = PUNCH_COOLDOWN;
  p.punchTimer = PUNCH_DURATION;
  audioEngine.playPunch();
  state.camera.shake = Math.max(state.camera.shake, 0.6);

  const ca = Math.cos(p.angle);
  const sa = Math.sin(p.angle);

  // Try humans first — they're the more common and more interesting target.
  let hitHuman: Human | null = null;
  let bestD = PUNCH_RANGE * PUNCH_RANGE;
  for (const h of state.humans) {
    if (h === p) continue;
    if (h.deathAnim > 0) continue;
    const dx = h.x - p.x;
    const dy = h.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > bestD) continue;
    // Cone check: target must be roughly in front of the puncher
    const dot = dx * ca + dy * sa;
    if (dot < 0) continue;
    const d = Math.sqrt(d2);
    if (d > 0 && dot / d < 0.55) continue; // ~57° half-cone
    bestD = d2;
    hitHuman = h;
  }
  if (hitHuman) {
    applyPunchToHuman(state, p, hitHuman);
    return;
  }

  // Otherwise try a car — denting the bodywork is the "rule" for cars.
  let hitCar: Vehicle | null = null;
  let bestCarD = PUNCH_CAR_RANGE * PUNCH_CAR_RANGE;
  for (const v of state.vehicles) {
    const dx = v.x - p.x;
    const dy = v.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > bestCarD) continue;
    const dot = dx * ca + dy * sa;
    if (dot < 0) continue;
    const d = Math.sqrt(d2);
    if (d > 0 && dot / d < 0.4) continue;
    bestCarD = d2;
    hitCar = v;
  }
  if (hitCar) {
    applyPunchToVehicle(state, p, hitCar);
  }
}

function applyPunchToHuman(state: GameState, attacker: Human, victim: Human) {
  victim.hp -= PUNCH_DAMAGE;
  // Knockback impulse — pushed away from the attacker
  const a = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
  victim.vx += Math.cos(a) * 90;
  victim.vy += Math.sin(a) * 90;
  spawnBlood(state, victim.x, victim.y);
  // The attacker only triggers the wider "crime" rules when it's the player.
  // AI vs AI fistfights stay between them and don't escalate the wanted level.
  if (!attacker.isPlayer) return;

  // ---- Reaction rules per kind ----
  if (victim.kind === "police") {
    // Hitting a cop is an immediate felony.
    raiseWanted(state, 2);
    victim.aiState = "chase";
    state.combatTimer = Math.max(state.combatTimer, 6);
    state.notifications.push({
      text: "Assaulting an officer!",
      life: 2,
      color: "#ff5050",
    });
  } else if (victim.kind === "gang") {
    // Gangs always retaliate with their gun.
    victim.aiState = "attack";
    state.combatTimer = Math.max(state.combatTimer, 6);
  } else {
    // Pedestrian: 35% chance they fight back, otherwise they panic and flee.
    // Either way it's a witnessed assault — a small wanted bump, occasional
    // witness reports the player to the police.
    raiseWanted(state, 1);
    state.combatTimer = Math.max(state.combatTimer, 4);
    if (Math.random() < 0.35) {
      victim.aiState = "fight";
      victim.aiTimer = 6;
      victim.aiTargetX = attacker.x;
      victim.aiTargetY = attacker.y;
    } else {
      victim.aiState = "panic";
      victim.aiTimer = Math.max(victim.aiTimer, 4);
      victim.panicFromX = attacker.x;
      victim.panicFromY = attacker.y;
    }
  }
}

function applyPunchToVehicle(state: GameState, attacker: Human, v: Vehicle) {
  // Dent the bodywork. Damage is on a 0..1 scale; a punch is light.
  v.damage = Math.min(1, v.damage + 0.06);
  // Tiny bounce so the hit reads
  const a = Math.atan2(v.y - attacker.y, v.x - attacker.x);
  v.vx += Math.cos(a) * 20;
  v.vy += Math.sin(a) * 20;
  if (!attacker.isPlayer) return;

  // ---- Driver reaction rules ----
  if (v.driver && v.driver !== attacker) {
    const driver = v.driver;
    if (driver.kind === "police") {
      // Cop bails to chase on foot
      raiseWanted(state, 1);
    } else if (driver.kind === "gang") {
      // Gang member bails out and opens fire
      driver.inVehicle = null;
      v.driver = null;
      driver.x = v.x + Math.cos(v.angle + Math.PI / 2) * 16;
      driver.y = v.y + Math.sin(v.angle + Math.PI / 2) * 16;
      driver.aiState = "attack";
      state.combatTimer = Math.max(state.combatTimer, 5);
    } else {
      // Civilian driver: 25% bail-and-fight, otherwise speed away in panic
      if (Math.random() < 0.25) {
        driver.inVehicle = null;
        v.driver = null;
        driver.x = v.x + Math.cos(v.angle + Math.PI / 2) * 16;
        driver.y = v.y + Math.sin(v.angle + Math.PI / 2) * 16;
        driver.aiState = "fight";
        driver.aiTimer = 5;
        driver.aiTargetX = attacker.x;
        driver.aiTargetY = attacker.y;
      } else {
        driver.aiState = "flee";
        driver.aiTimer = 6;
        driver.panicFromX = attacker.x;
        driver.panicFromY = attacker.y;
      }
    }
  }
}

function exitVehicle(state: GameState) {
  const p = state.player;
  const v = p.inVehicle;
  if (!v) return;
  v.driver = null;
  p.inVehicle = null;
  // place player to the side
  p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 16;
  p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 16;
  p.vx = 0;
  p.vy = 0;
}

function nearestVehicle(
  state: GameState,
  h: Human,
  r: number,
): Vehicle | null {
  let best: Vehicle | null = null;
  let bestD = r * r;
  for (const v of state.vehicles) {
    const d = (v.x - h.x) ** 2 + (v.y - h.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function updateBullets(state: GameState, dt: number, world: WorldData) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i]!;
    b.life -= dt;
    // Sub-step the bullet so fast bullets cannot tunnel through walls or actors.
    const stepLen = 6; // pixels per substep
    const totalDist = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(totalDist / stepLen));
    const sx = (b.vx * dt) / steps;
    const sy = (b.vy * dt) / steps;
    let hit = false;
    let hitWall = false;
    for (let s = 0; s < steps && !hit; s++) {
      b.x += sx;
      b.y += sy;
      // Wall collision: building tiles, props, etc. block the round.
      if (isSolidAt(world, b.x, b.y)) {
        hit = true;
        hitWall = true;
        break;
      }
    }
    if (hitWall) {
      // Spark + smoke puff at impact, then drop the bullet.
      for (let k = 0; k < 5; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(40, 110);
        state.particles.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.18 + Math.random() * 0.18,
          maxLife: 0.36,
          size: 0.8 + Math.random() * 1.2,
          kind: "spark",
          color: "#ffd060",
          rotation: 0,
          rotationSpeed: 0,
        });
      }
      state.particles.push({
        x: b.x,
        y: b.y,
        vx: 0,
        vy: -10,
        life: 0.4,
        maxLife: 0.4,
        size: 3,
        kind: "smoke",
        color: "#bbbbbb",
        rotation: 0,
        rotationSpeed: 0,
      });
      state.bullets.splice(i, 1);
      continue;
    }
    // hit humans
    for (const h of state.humans) {
      if (h.id === b.owner) continue;
      if (h.inVehicle) continue;
      if (h.hp <= 0) continue;
      const dx = h.x - b.x;
      const dy = h.y - b.y;
      if (dx * dx + dy * dy < 5 * 5) {
        h.hp -= b.damage;
        spawnBlood(state, h.x, h.y);
        hit = true;
        if (h.hp <= 0) {
          if (b.owner === state.player.id) {
            addScore(state, h.kind === "police" ? 200 : 50, h.kind === "police" ? "Cop down +200" : "Kill +50");
            raiseWanted(state, h.kind === "police" ? 2 : 1);
            // Drop a cash pickup so killing actually pays out.
            const cash = h.kind === "police" ? 75 : h.kind === "gang" ? 50 : 15;
            state.money += cash;
            state.notifications.push({
              text: `+$${cash}`,
              life: 1.0,
              color: "#30c870",
            });
          }
          // damage reaction
        } else if (h.kind === "pedestrian") {
          h.aiState = "flee";
        } else if (b.owner === state.player.id) {
          // they fight back already
          state.combatTimer = Math.max(state.combatTimer, 4);
        }
        if (b.owner !== state.player.id && h === state.player) {
          state.damageFlash = 1;
        }
        break;
      }
    }
    if (!hit) {
      // hit vehicles
      for (const v of state.vehicles) {
        const dx = v.x - b.x;
        const dy = v.y - b.y;
        if (dx * dx + dy * dy < (v.length / 2) * (v.length / 2)) {
          v.hp -= b.damage * 0.6;
          // sparks
          state.particles.push({
            x: b.x,
            y: b.y,
            vx: -b.vx * 0.1 + rand(-30, 30),
            vy: -b.vy * 0.1 + rand(-30, 30),
            life: 0.2,
            maxLife: 0.2,
            size: 1.2,
            kind: "spark",
            color: "#ffd040",
            rotation: 0,
            rotationSpeed: 0,
          });
          hit = true;
          break;
        }
      }
    }
    if (hit || b.life <= 0) {
      state.bullets.splice(i, 1);
    }
  }
}

// Shop pricing/effects table.
const SHOP_INFO: Record<
  import("./world").ShopKind,
  { label: string; cost: number; cooldown: number }
> = {
  hospital:    { label: "Heal",            cost: 50,  cooldown: 8 },
  gun_shop:    { label: "Buy ammo+pistol", cost: 100, cooldown: 4 },
  pay_n_spray: { label: "Respray",         cost: 100, cooldown: 6 },
  food:        { label: "Eat (+25 HP)",    cost: 0,   cooldown: 6 },
  safehouse:   { label: "Save spawn",      cost: 0,   cooldown: 5 },
  ammu:        { label: "Buy SMG ammo",    cost: 200, cooldown: 4 },
};

let shopCooldownTimer = 0;

function updateShops(state: GameState, world: WorldData, dt: number) {
  if (shopCooldownTimer > 0) shopCooldownTimer -= dt;
  state.input.nearbyShopId = null;
  if (state.shopOverlay) {
    state.shopOverlay.timer -= dt;
    if (state.shopOverlay.timer <= 0) state.shopOverlay = null;
    // Block other shop input while overlay is visible
    return;
  }
  if (state.endScreen) return;
  const p = state.player;
  // Find the nearest shop door within 60px (one tile).
  let nearest: { shop: import("./world").Shop; d: number } | null = null;
  for (const shop of world.shops) {
    const dx = shop.doorX - p.x;
    const dy = shop.doorY - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 60) continue;
    if (!nearest || d < nearest.d) nearest = { shop, d };
  }
  if (!nearest) return;
  const shop = nearest.shop;
  // Pay 'n' Spray needs the player in a vehicle; everything else is on-foot.
  if (shop.kind === "pay_n_spray") {
    if (!p.inVehicle) return;
  } else if (p.inVehicle) {
    return;
  }
  // Stash the shop reference on the input system so HUD can read it.
  state.input.nearbyShopId = shop.id;
  if (state.input.enter && shopCooldownTimer <= 0) {
    state.input.enter = false;
    enterShop(state, shop);
    shopCooldownTimer = 0.5;
  }
}

function enterShop(state: GameState, shop: import("./world").Shop) {
  const p = state.player;
  // Pay 'n' Spray is a quick drive-in service — keep the legacy brief overlay.
  if (shop.kind === "pay_n_spray") {
    const info = SHOP_INFO[shop.kind];
    if (state.money < info.cost) {
      state.notifications.push({
        text: `Need $${info.cost}`,
        life: 1.4,
        color: "#ff5050",
      });
      return;
    }
    if (p.inVehicle) {
      p.inVehicle.hp = p.inVehicle.maxHp;
      p.inVehicle.color = pick([
        "#5a90ff", "#30c870", "#ffd040", "#a040ff",
        "#ff5060", "#ff8040", "#40d4d8", "#e0e0e0",
      ]);
      p.inVehicle.damage = 0;
    }
    state.wantedLevel = 0;
    state.combatTimer = 0;
    state.money -= info.cost;
    const msg = "RESPRAYED — wanted clear";
    state.shopOverlay = {
      shopId: shop.id,
      timer: 1.6,
      duration: 1.6,
      message: `${shop.name}\n${msg}`,
    };
    state.notifications.push({ text: msg, life: 1.6, color: shop.color });
    return;
  }
  // ALL other shops: open a real interior scene.
  enterInterior(state, shop);
}

function updateAnimals(state: GameState, dt: number, world: WorldData) {
  const p = state.player;
  for (const a of state.animals) {
    a.walkPhase += dt * (a.kind === "pigeon" ? 12 : a.kind === "cat" ? 9 : 7);
    a.stateTimer -= dt;
    if (a.hp <= 0) {
      // dead — let stateTimer count up so despawn can clean up
      a.state = "downed";
      a.vx *= Math.pow(0.001, dt);
      a.vy *= Math.pow(0.001, dt);
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.stateTimer += dt * 2; // reuse for despawn timer
      continue;
    }
    // SCARE check: gunshots, vehicles, player nearby
    const dPlayer = dist(a.x, a.y, p.x, p.y);
    let scared = false;
    let sx = a.x;
    let sy = a.y;
    if (dPlayer < (a.kind === "pigeon" ? 70 : a.kind === "cat" ? 60 : 80)) {
      scared = true;
      sx = p.x;
      sy = p.y;
    }
    // Vehicles within range
    for (const v of state.vehicles) {
      const dv = dist(a.x, a.y, v.x, v.y);
      const sp = Math.hypot(v.vx, v.vy);
      if (dv < 90 && sp > 50) {
        scared = true;
        sx = v.x;
        sy = v.y;
        break;
      }
    }
    // Bullets snap closeby
    for (const b of state.bullets) {
      if (dist(a.x, a.y, b.x, b.y) < 80) {
        scared = true;
        sx = b.x;
        sy = b.y;
        break;
      }
    }
    if (scared) {
      a.state = "flee";
      a.stateTimer = 2.5;
      a.panicFromX = sx;
      a.panicFromY = sy;
      // Pigeons take flight when scared
      if (a.kind === "pigeon" && a.flyZ < 0.05) {
        a.flyTimer = 3;
        // emit feather particles
        for (let f = 0; f < 3; f++) {
          state.particles.push({
            x: a.x,
            y: a.y,
            vx: rand(-30, 30),
            vy: rand(-30, 30),
            life: 1.5,
            maxLife: 1.5,
            size: 1.5,
            kind: "feather",
            color: "#cfd6dd",
            rotation: rand(0, Math.PI * 2),
            rotationSpeed: rand(-3, 3),
          });
        }
      }
    }
    if (a.state === "flee") {
      const dx = a.x - a.panicFromX;
      const dy = a.y - a.panicFromY;
      const d = Math.hypot(dx, dy) || 1;
      const speed = a.speed * 1.6;
      a.vx = (dx / d) * speed;
      a.vy = (dy / d) * speed;
      a.angle = Math.atan2(a.vy, a.vx);
      if (a.stateTimer <= 0) a.state = "wander";
    } else {
      // Wander toward a fresh nearby spot
      if (a.stateTimer <= 0) {
        const r = a.kind === "cat" ? 60 : 90;
        const target = {
          x: a.homeX + rand(-r, r),
          y: a.homeY + rand(-r, r),
        };
        a.panicFromX = target.x;
        a.panicFromY = target.y;
        a.stateTimer = rand(2, 5);
      }
      const dx = a.panicFromX - a.x;
      const dy = a.panicFromY - a.y;
      const d = Math.hypot(dx, dy) || 1;
      // pigeons hop in tiny bursts
      const sp =
        a.kind === "pigeon"
          ? a.speed * 0.5 * (Math.sin(a.walkPhase) > 0.6 ? 1 : 0)
          : a.speed * 0.45;
      a.vx = (dx / d) * sp;
      a.vy = (dy / d) * sp;
      if (sp > 1) a.angle = Math.atan2(a.vy, a.vx);
    }
    // Pigeon flight altitude visualization
    if (a.flyTimer > 0) {
      a.flyTimer -= dt;
      a.flyZ = Math.min(1, a.flyZ + dt * 4);
    } else {
      a.flyZ = Math.max(0, a.flyZ - dt * 2);
    }
    // ---- COLLISION: keep land animals OUT OF BUILDINGS ----
    // Pigeons in flight (flyZ > 0.3) are airborne and may pass over solid
    // tiles. Cats and dogs walk on the ground and must respect walls. We do
    // axis-separated movement so an animal sliding along a wall keeps moving
    // along the unblocked axis instead of getting stuck.
    const airborne = a.kind === "pigeon" && a.flyZ > 0.3;
    const nx = a.x + a.vx * dt;
    const ny = a.y + a.vy * dt;
    if (airborne) {
      a.x = nx;
      a.y = ny;
    } else {
      if (!isSolidAt(world, nx, a.y)) a.x = nx;
      else a.vx = -a.vx * 0.4; // bounce off
      if (!isSolidAt(world, a.x, ny)) a.y = ny;
      else a.vy = -a.vy * 0.4;
    }
    // Vehicle roadkill
    for (const v of state.vehicles) {
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 60) continue;
      const dvx = a.x - v.x;
      const dvy = a.y - v.y;
      const d = Math.hypot(dvx, dvy);
      if (d < 16 && a.flyZ < 0.3) {
        a.hp = 0;
        a.vx = (dvx / d) * sp * 0.5;
        a.vy = (dvy / d) * sp * 0.5;
        a.stateTimer = 0;
        // blood splat
        for (let f = 0; f < 6; f++) {
          state.particles.push({
            x: a.x,
            y: a.y,
            vx: rand(-60, 60),
            vy: rand(-60, 60),
            life: 0.6,
            maxLife: 0.6,
            size: 1.5,
            kind: "blood",
            color: "#a01818",
            rotation: 0,
            rotationSpeed: 0,
          });
        }
        if (a.kind === "dog" || a.kind === "cat") {
          // small wanted bump for animal cruelty (if witnessed = wanted system handles this)
          state.notifications.push({
            text: a.kind === "dog" ? "Dog hit!" : "Cat hit!",
            life: 1,
            color: "#ff7070",
          });
        }
        break;
      }
    }
    // Bullet hits
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi]!;
      if (dist(a.x, a.y, b.x, b.y) < 8 && a.flyZ < 0.3) {
        a.hp = 0;
        a.stateTimer = 0;
        for (let f = 0; f < 5; f++) {
          state.particles.push({
            x: a.x,
            y: a.y,
            vx: rand(-40, 40),
            vy: rand(-40, 40),
            life: 0.6,
            maxLife: 0.6,
            size: 1.5,
            kind: "blood",
            color: "#a01818",
            rotation: 0,
            rotationSpeed: 0,
          });
        }
        state.bullets.splice(bi, 1);
        break;
      }
    }
    // Loose world clamp
    a.x = clamp(a.x, 8, world.pixelWidth - 8);
    a.y = clamp(a.y, 8, world.pixelHeight - 8);
  }
}

function updateBirdFlocks(state: GameState, dt: number) {
  for (const f of state.birdFlocks) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    f.flapPhase += dt * 8;
  }
}

function updateParticles(state: GameState, dt: number) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]!;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === "smoke") {
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vy -= dt * 8;
    } else if (p.kind === "fire") {
      p.vy -= dt * 30;
      p.vx *= 0.9;
    } else if (p.kind === "spark" || p.kind === "muzzle") {
      p.vx *= 0.92;
      p.vy *= 0.92;
    } else if (p.kind === "blood" || p.kind === "debris") {
      p.vx *= 0.94;
      p.vy *= 0.94;
    } else if (p.kind === "rain") {
      // travels straight, no change
    } else if (p.kind === "snow") {
      // gentle drift with wind
      const wx = Math.cos(state.windAngle) * state.windStrength * 30;
      const wy = Math.sin(state.windAngle) * state.windStrength * 30;
      p.vx = wx + Math.sin(p.life * 4 + p.rotation) * 12;
      p.vy = 35 + wy * 0.4;
    } else if (p.kind === "leaf" || p.kind === "feather") {
      const wx = Math.cos(state.windAngle) * state.windStrength * 70;
      const wy = Math.sin(state.windAngle) * state.windStrength * 70;
      p.vx = wx + Math.sin(p.life * 6 + p.rotation) * 30;
      p.vy = wy + Math.cos(p.life * 5 + p.rotation) * 20;
    }
    p.rotation += p.rotationSpeed * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  // cap particle count
  if (state.particles.length > 800) state.particles.splice(0, 200);
}

function spawnSnowParticles(state: GameState) {
  for (let i = 0; i < 5; i++) {
    state.particles.push({
      x: state.camera.x + rand(-700, 700),
      y: state.camera.y - 500 + rand(-100, 100),
      vx: 0,
      vy: 35,
      life: 6,
      maxLife: 6,
      size: rand(1.2, 2.4),
      kind: "snow",
      color: "rgba(255,255,255,0.85)",
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-1, 1),
    });
  }
}

function spawnLeafParticles(state: GameState) {
  for (let i = 0; i < 2; i++) {
    state.particles.push({
      x: state.camera.x + rand(-700, 700),
      y: state.camera.y + rand(-500, 500),
      vx: 0,
      vy: 0,
      life: 4,
      maxLife: 4,
      size: rand(1.5, 3),
      kind: "leaf",
      color: pick(["#cf6a2a", "#d8a03a", "#7c8a3b", "#a83822"]),
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-3, 3),
    });
  }
}

function spawnRainParticles(state: GameState) {
  const count = state.weather === "storm" ? 8 : 4;
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: state.camera.x + rand(-600, 600),
      y: state.camera.y - 400 + rand(-100, 100),
      vx: -60 + rand(-20, 20),
      vy: 800 + rand(-50, 50),
      life: 0.6,
      maxLife: 0.6,
      size: 0.8,
      kind: "rain",
      color: "rgba(180,210,255,0.55)",
      rotation: 0,
      rotationSpeed: 0,
    });
  }
}

function collectPickups(state: GameState) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i]!;
    pk.bob += 0.05;
    if (distSq(pk.x, pk.y, p.x, p.y) < 16 * 16) {
      if (pk.kind === "health") {
        p.hp = Math.min(p.maxHp, p.hp + 50);
        state.notifications.push({ text: "+50 HP", life: 1.2, color: "#30c870" });
      } else if (pk.kind === "ammo") {
        p.ammo += 30;
        state.notifications.push({ text: "+30 AMMO", life: 1.2, color: "#3a90e8" });
      } else if (pk.kind === "armor") {
        p.maxHp = 150;
        p.hp = p.maxHp;
        state.notifications.push({ text: "+ARMOR", life: 1.2, color: "#a0a8b8" });
      } else if (pk.kind === "wantedClear") {
        state.wantedLevel = 0;
        state.notifications.push({ text: "Wanted cleared", life: 1.2, color: "#ffe040" });
      } else if (pk.kind === "speed") {
        // small score boost
        state.money += 50;
        state.notifications.push({ text: "+$50", life: 1.2, color: "#30c870" });
      }
      audioEngine.playPickup();
      state.pickups.splice(i, 1);
    }
  }
  // Replenish pickups
  if (state.pickups.length < 14 && Math.random() < 0.01) {
    // replenish at random road node
    return;
  }
}

function updateCamera(state: GameState, dt: number) {
  const p = state.player;
  let tx = p.x;
  let ty = p.y;
  if (p.inVehicle) {
    const v = p.inVehicle;
    // Lead camera using the car's facing direction (stable; doesn't oscillate
    // when the velocity vector flickers during turns)
    const sp = Math.hypot(v.vx, v.vy);
    const lookAmt = Math.min(90, sp * 0.3);
    tx = v.x + Math.cos(v.angle) * lookAmt;
    ty = v.y + Math.sin(v.angle) * lookAmt;
  }
  // Smoother camera follow
  const lerp = Math.min(1, dt * 3);
  state.camera.x += (tx - state.camera.x) * lerp;
  state.camera.y += (ty - state.camera.y) * lerp;
  // Zoom: closer on foot, wider in fast vehicle
  let targetZoom = 2.4;
  if (p.inVehicle) {
    const sp = Math.hypot(p.inVehicle.vx, p.inVehicle.vy);
    targetZoom = clamp(2.4 - sp / 600, 1.5, 2.4);
  }
  state.camera.zoom += (targetZoom - state.camera.zoom) * lerp;
  // Shake decays much faster so it only registers as a quick punch, never a constant rumble
  state.camera.shake = Math.max(0, state.camera.shake - dt * 22);
  // Clamp camera to world
  state.camera.x = clamp(state.camera.x, 200, state.mapWidth - 200);
  state.camera.y = clamp(state.camera.y, 200, state.mapHeight - 200);
}

function manageSpawns(state: GameState, world: WorldData) {
  const p = state.player;
  // Despawn far away
  for (let i = state.vehicles.length - 1; i >= 0; i--) {
    const v = state.vehicles[i]!;
    if (v.driver?.isPlayer) continue;
    if (dist(v.x, v.y, p.x, p.y) > DESPAWN_RADIUS) {
      // Also remove driver
      if (v.driver) {
        const di = state.humans.indexOf(v.driver);
        if (di >= 0) state.humans.splice(di, 1);
      }
      state.vehicles.splice(i, 1);
    }
  }
  for (let i = state.humans.length - 1; i >= 0; i--) {
    const h = state.humans[i]!;
    if (h.isPlayer) continue;
    if (h.inVehicle) continue;
    if (h.hp <= 0) continue;
    if (dist(h.x, h.y, p.x, p.y) > DESPAWN_RADIUS) {
      state.humans.splice(i, 1);
    }
  }
  // Spawn vehicles
  let vCount = state.vehicles.length;
  let tries = 0;
  while (vCount < TARGET_VEHICLES && tries < 8) {
    tries++;
    const node = pick(world.roadGraph);
    const dx = node.x - p.x;
    const dy = node.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 400 || d > SPAWN_RADIUS) continue;
    const angle = Math.random() < 0.5 ? 0 : Math.PI / 2;
    const kind =
      state.wantedLevel >= 2 && Math.random() < 0.35
        ? "police"
        : pick(VEHICLE_KINDS);
    const v = createVehicle(kind, node.x, node.y, angle);
    state.vehicles.push(v);
    // Spawn driver
    const driverKind = kind === "police" ? "police" : "pedestrian";
    const driver = createHuman(driverKind, node.x, node.y, angle);
    driver.inVehicle = v;
    v.driver = driver;
    if (driverKind === "police") driver.aiState = "chase";
    state.humans.push(driver);
    vCount++;
  }
  // Spawn peds
  let pedCount = state.humans.filter((h) => h.kind === "pedestrian" && !h.inVehicle).length;
  tries = 0;
  while (pedCount < TARGET_PEDS && tries < 10) {
    tries++;
    const angle = Math.random() * Math.PI * 2;
    const r = rand(300, SPAWN_RADIUS);
    const x = p.x + Math.cos(angle) * r;
    const y = p.y + Math.sin(angle) * r;
    const road = findNearestRoad(world, x, y);
    // step off-road onto sidewalk
    const ped = createHuman("pedestrian", road.x + rand(-24, 24), road.y + rand(-24, 24));
    state.humans.push(ped);
    pedCount++;
  }
  // Spawn gang occasionally
  let gangCount = state.humans.filter((h) => h.kind === "gang").length;
  if (gangCount < TARGET_GANG && Math.random() < 0.02) {
    const node = pick(world.roadGraph);
    if (dist(node.x, node.y, p.x, p.y) > 400 && dist(node.x, node.y, p.x, p.y) < SPAWN_RADIUS) {
      state.humans.push(createHuman("gang", node.x + rand(-30, 30), node.y + rand(-30, 30)));
    }
  }
  // Spawn extra cops based on wanted
  if (state.wantedLevel >= 1) {
    const wantCops = state.wantedLevel * 2;
    const cops = state.humans.filter((h) => h.kind === "police").length;
    if (cops < wantCops && Math.random() < 0.06) {
      const node = pick(world.roadGraph);
      if (dist(node.x, node.y, p.x, p.y) > 350 && dist(node.x, node.y, p.x, p.y) < SPAWN_RADIUS) {
        // Spawn cop in a cruiser
        const v = createVehicle("police", node.x, node.y, Math.random() * Math.PI * 2);
        const cop = createHuman("police", node.x, node.y, 0);
        cop.aiState = "chase";
        cop.inVehicle = v;
        v.driver = cop;
        state.vehicles.push(v);
        state.humans.push(cop);
      }
    }
  }
  // ROADBLOCK — at wanted >= 3, occasionally spawn a parked cop car + 2 cops
  // at an intersection ahead of the player on the road network
  if (state.wantedLevel >= 3 && Math.random() < 0.004) {
    spawnRoadblock(state, world);
  }

  // ANIMALS — keep a soft target around player
  for (let i = state.animals.length - 1; i >= 0; i--) {
    const a = state.animals[i]!;
    if (dist(a.x, a.y, p.x, p.y) > DESPAWN_RADIUS || a.hp <= 0 && a.stateTimer > 4) {
      state.animals.splice(i, 1);
    }
  }
  const TARGET_ANIMALS = 14;
  if (state.animals.length < TARGET_ANIMALS && Math.random() < 0.04) {
    const angle = Math.random() * Math.PI * 2;
    const r = rand(300, SPAWN_RADIUS);
    const x = p.x + Math.cos(angle) * r;
    const y = p.y + Math.sin(angle) * r;
    // Prefer non-road tiles for spawn
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const t = world.tiles[ty]?.[tx];
    if (t && (t.type === "grass" || t.type === "sidewalk")) {
      const roll = Math.random();
      const kind: "dog" | "cat" | "pigeon" =
        roll < 0.45 ? "pigeon" : roll < 0.8 ? "dog" : "cat";
      // Pigeons spawn in small clusters
      if (kind === "pigeon") {
        const n = 2 + Math.floor(Math.random() * 4);
        for (let j = 0; j < n; j++) {
          state.animals.push(
            createAnimal(kind, x + rand(-18, 18), y + rand(-18, 18)),
          );
        }
      } else {
        state.animals.push(createAnimal(kind, x, y));
      }
    }
  }

  // BIRD FLOCKS overhead — purely decorative
  for (let i = state.birdFlocks.length - 1; i >= 0; i--) {
    const f = state.birdFlocks[i]!;
    if (f.life <= 0 || dist(f.x, f.y, p.x, p.y) > DESPAWN_RADIUS + 400) {
      state.birdFlocks.splice(i, 1);
    }
  }
  if (state.birdFlocks.length < 3 && Math.random() < 0.01) {
    const angle = Math.random() * Math.PI * 2;
    const r = SPAWN_RADIUS + 100;
    const x = p.x + Math.cos(angle) * r;
    const y = p.y + Math.sin(angle) * r;
    // Fly toward roughly the opposite side, plus wind
    const dirX = -Math.cos(angle) + Math.cos(state.windAngle) * 0.4;
    const dirY = -Math.sin(angle) + Math.sin(state.windAngle) * 0.4;
    const dl = Math.hypot(dirX, dirY) || 1;
    const speed = rand(60, 120);
    state.birdFlocks.push(createBirdFlock(x, y, (dirX / dl) * speed, (dirY / dl) * speed));
  }
}

function spawnRoadblock(state: GameState, world: WorldData) {
  const p = state.player;
  const pvx = p.inVehicle ? p.inVehicle.vx : p.vx;
  const pvy = p.inVehicle ? p.inVehicle.vy : p.vy;
  const psp = Math.hypot(pvx, pvy);
  if (psp < 30) return; // need direction
  // Aim ~500-700 px ahead of the player
  const aheadX = p.x + (pvx / psp) * 600;
  const aheadY = p.y + (pvy / psp) * 600;
  // Snap to nearest intersection
  let best = world.roadGraph[0]!;
  let bestD = Infinity;
  for (const n of world.roadGraph) {
    const d = (n.x - aheadX) ** 2 + (n.y - aheadY) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  if (dist(best.x, best.y, p.x, p.y) < 350) return; // too close to be fair
  // Park a patrol car perpendicular to player travel direction
  const blockA = Math.atan2(pvy, pvx) + Math.PI / 2;
  const car = createVehicle("police", best.x, best.y, blockA);
  car.vx = 0;
  car.vy = 0;
  state.vehicles.push(car);
  // Two cops crouched behind it
  for (let i = 0; i < 2; i++) {
    const ox = Math.cos(blockA + Math.PI) * 18 + (i - 0.5) * 20;
    const oy = Math.sin(blockA + Math.PI) * 18 + (i - 0.5) * 20;
    const cop = createHuman("police", best.x + ox, best.y + oy, 0);
    cop.aiState = "chase";
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    state.humans.push(cop);
  }
  state.notifications.push({
    text: "ROADBLOCK AHEAD!",
    life: 3,
    color: "#5fa8ff",
  });
}

// =====================================================================
//                          MISSION SYSTEM
// =====================================================================
// Missions appear as floating glowing pillars on the map. Walk over one
// to start it. Each mission picks one of five archetypes:
//   reach       — drive/run to a waypoint (delivery)
//   collect     — same as reach but framed as picking something up
//   destroy     — wreck a specified vehicle
//   eliminate   — take out a specific gang member
//   escape      — survive a wanted-level chase for X seconds
// Completing a mission pays cash + score and bumps the lifetime counter.
function tickMissions(state: GameState, world: WorldData, dt: number) {
  // Clear stale "available" markers if their target entity vanished
  for (let i = state.missions.length - 1; i >= 0; i--) {
    const m = state.missions[i]!;
    if (m.type === "destroy" && m.targetId !== undefined) {
      const v = state.vehicles.find((vv) => vv.id === m.targetId);
      if (!v) {
        state.missions.splice(i, 1);
        continue;
      }
      // Pin the marker to the live target's position so the player can chase it.
      m.targetX = v.x;
      m.targetY = v.y;
    } else if (m.type === "eliminate" && m.targetId !== undefined) {
      const h = state.humans.find((hh) => hh.id === m.targetId && hh.hp > 0);
      if (!h) {
        state.missions.splice(i, 1);
        continue;
      }
      m.targetX = h.x;
      m.targetY = h.y;
    }
  }

  // Spawn a fresh mission marker if there's nothing on the map and no active mission
  state.missionSpawnTimer -= dt;
  if (
    !state.activeMission &&
    state.missions.length === 0 &&
    state.missionSpawnTimer <= 0
  ) {
    const m = generateMission(state, world);
    if (m) state.missions.push(m);
    state.missionSpawnTimer = rand(10, 18);
  }

  // Activate available missions when player walks over their marker (on foot or in car)
  if (!state.activeMission) {
    const px = state.player.x;
    const py = state.player.y;
    for (let i = state.missions.length - 1; i >= 0; i--) {
      const m = state.missions[i]!;
      if (distSq(px, py, m.targetX, m.targetY) < 22 * 22) {
        state.missions.splice(i, 1);
        activateMission(state, world, m);
        break;
      }
    }
  } else {
    // Active mission progress
    const m = state.activeMission;
    if (m.type === "reach" || m.type === "collect") {
      if (
        distSq(state.player.x, state.player.y, m.targetX, m.targetY) <
        28 * 28
      ) {
        completeMission(state);
      }
    } else if (m.type === "destroy") {
      const v = state.vehicles.find((vv) => vv.id === m.targetId);
      if (!v || v.hp <= 0) {
        completeMission(state);
      } else {
        m.targetX = v.x;
        m.targetY = v.y;
      }
    } else if (m.type === "eliminate") {
      const h = state.humans.find((hh) => hh.id === m.targetId);
      if (!h || h.hp <= 0) {
        completeMission(state);
      } else {
        m.targetX = h.x;
        m.targetY = h.y;
      }
    } else if (m.type === "escape") {
      m.remainingTime = (m.remainingTime ?? 0) - dt;
      // pin marker to player so it tracks
      m.targetX = state.player.x;
      m.targetY = state.player.y;
      if (state.wantedLevel === 0) {
        completeMission(state);
      } else if ((m.remainingTime ?? 0) <= 0) {
        // Surviving the timer with cops still active = success
        if (state.wantedLevel <= 1) completeMission(state);
        else failMission(state, "Too hot — survived but mission failed");
      }
    }
  }
}

function generateMission(state: GameState, world: WorldData): Mission | null {
  const px = state.player.x;
  const py = state.player.y;
  // Pick a road node 350-900px away from the player so it isn't trivial
  const candidates = world.roadGraph.filter((n) => {
    const d = Math.hypot(n.x - px, n.y - py);
    return d > 350 && d < 900;
  });
  if (candidates.length === 0) return null;
  const node = pick(candidates);

  // Decide type. Bias toward gameplay variety.
  const r = Math.random();
  let type: Mission["type"];
  if (r < 0.32) type = "reach";
  else if (r < 0.55) type = "collect";
  else if (r < 0.75) type = "destroy";
  else if (r < 0.92) type = "eliminate";
  else type = "escape";

  // For destroy: pick a random non-police vehicle near the chosen node
  if (type === "destroy") {
    const candVeh = state.vehicles.filter(
      (v) =>
        v.kind !== "police" &&
        !v.driver?.isPlayer &&
        Math.hypot(v.x - node.x, v.y - node.y) < 600,
    );
    if (candVeh.length === 0) {
      // fall back to "reach" so we still spawn something
      type = "reach";
    } else {
      const target = pick(candVeh);
      return {
        id: `m_${Math.floor(Math.random() * 1e9).toString(36)}`,
        name: "REPO JOB",
        description: `Wreck the ${target.kind.toUpperCase()} — boss wants it gone`,
        reward: 600,
        scoreReward: 800,
        targetX: target.x,
        targetY: target.y,
        state: "available",
        type: "destroy",
        targetId: target.id,
        markerColor: "#ff5c30",
        icon: "✖",
      };
    }
  }

  // For eliminate: spawn a fresh gang member at the node so it always works
  if (type === "eliminate") {
    const target = createHuman("gang", node.x + rand(-12, 12), node.y + rand(-12, 12));
    target.weapon = Math.random() < 0.5 ? "pistol" : "smg";
    target.ammo = 80;
    target.hp = 90;
    target.maxHp = 90;
    state.humans.push(target);
    return {
      id: `m_${Math.floor(Math.random() * 1e9).toString(36)}`,
      name: "HIT CONTRACT",
      description: "Take out the rival enforcer",
      reward: 800,
      scoreReward: 1200,
      targetX: target.x,
      targetY: target.y,
      state: "available",
      type: "eliminate",
      targetId: target.id,
      markerColor: "#a050ff",
      icon: "☠",
    };
  }

  if (type === "escape") {
    return {
      id: `m_${Math.floor(Math.random() * 1e9).toString(36)}`,
      name: "HEAT TEST",
      description: "Pick up heat (★+) then survive 60s",
      reward: 700,
      scoreReward: 1000,
      targetX: node.x,
      targetY: node.y,
      state: "available",
      type: "escape",
      timeLimit: 60,
      remainingTime: 60,
      markerColor: "#ff3868",
      icon: "★",
    };
  }

  if (type === "collect") {
    return {
      id: `m_${Math.floor(Math.random() * 1e9).toString(36)}`,
      name: "PICKUP",
      description: "Grab the briefcase at the marker",
      reward: 350,
      scoreReward: 500,
      targetX: node.x,
      targetY: node.y,
      state: "available",
      type: "collect",
      markerColor: "#3acfff",
      icon: "■",
    };
  }

  // reach (delivery)
  return {
    id: `m_${Math.floor(Math.random() * 1e9).toString(36)}`,
    name: "DELIVERY",
    description: "Drive to the drop-off marker",
    reward: 400,
    scoreReward: 600,
    targetX: node.x,
    targetY: node.y,
    state: "available",
    type: "reach",
    markerColor: "#3aff90",
    icon: "▲",
  };
}

function activateMission(state: GameState, world: WorldData, m: Mission) {
  m.state = "active";
  // For reach/collect, re-pick a destination far from the marker so the player
  // actually has to travel.
  if (m.type === "reach" || m.type === "collect") {
    const candidates = world.roadGraph.filter((n) => {
      const d = Math.hypot(n.x - state.player.x, n.y - state.player.y);
      return d > 500 && d < 1100;
    });
    if (candidates.length > 0) {
      const dest = pick(candidates);
      m.targetX = dest.x;
      m.targetY = dest.y;
    }
  }
  if (m.type === "escape") {
    // Force a wanted star so the chase actually happens
    raiseWanted(state, 2);
    m.remainingTime = m.timeLimit ?? 60;
  }
  state.activeMission = m;
  state.notifications.push({
    text: `${m.name} STARTED`,
    life: 2.4,
    color: m.markerColor,
  });
  audioEngine.playPickup();
}

function completeMission(state: GameState) {
  const m = state.activeMission;
  if (!m) return;
  state.activeMission = null;
  state.missionsCompleted += 1;
  state.money += m.reward;
  addScore(state, m.scoreReward);
  state.notifications.push({
    text: `MISSION COMPLETE +$${m.reward}`,
    life: 3,
    color: "#30c870",
  });
  audioEngine.playPickup();
  // Brief gap before next mission marker spawns
  state.missionSpawnTimer = 5;
}

function failMission(state: GameState, msg: string) {
  state.activeMission = null;
  state.notifications.push({
    text: msg,
    life: 3,
    color: "#ff4060",
  });
  state.missionSpawnTimer = 8;
}

function updateMusicMood(state: GameState) {
  let mood: GameState["musicState"] = "calm";
  if (state.combatTimer > 0 || state.wantedLevel >= 3) mood = "combat";
  else if (state.wantedLevel >= 1) mood = "chase";
  else if (state.player.inVehicle) mood = "radio";
  if (mood !== state.musicState) {
    state.musicState = mood;
    audioEngine.setMood(mood);
  }
}
