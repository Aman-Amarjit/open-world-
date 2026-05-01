// Factories for creating vehicles and humans
import type {
  Vehicle,
  VehicleKind,
  Human,
  HumanKind,
  WeaponKind,
  Animal,
  BirdFlock,
  Prop,
  PropKind,
} from "./types";
import { newId, pick, rand } from "./utils";

const VEHICLE_SPECS: Record<
  VehicleKind,
  {
    maxSpeed: number;
    accel: number;
    handling: number;
    mass: number;
    hp: number;
    width: number;
    length: number;
    colors: string[];
  }
> = {
  sedan: {
    maxSpeed: 220,
    accel: 220,
    handling: 2.6,
    mass: 1.0,
    hp: 80,
    width: 16,
    length: 26,
    colors: ["#3a6a9a", "#9a3a3a", "#6a8a3a", "#daa830", "#aaaaaa", "#5a3a7a"],
  },
  muscle: {
    maxSpeed: 320,
    accel: 320,
    handling: 2.0,
    mass: 1.2,
    hp: 60,
    width: 17,
    length: 28,
    colors: ["#c83030", "#1a1a1a", "#f0c020", "#3a3a8a", "#207a30"],
  },
  truck: {
    maxSpeed: 160,
    accel: 140,
    handling: 1.4,
    mass: 2.0,
    hp: 200,
    width: 20,
    length: 36,
    colors: ["#5a4a3a", "#3a4a3a", "#7a5a3a", "#4a4a5a"],
  },
  police: {
    maxSpeed: 280,
    accel: 280,
    handling: 3.0,
    mass: 1.0,
    hp: 120,
    width: 17,
    length: 28,
    colors: ["#1a1a1a"],
  },
  sports: {
    maxSpeed: 400,
    accel: 380,
    handling: 3.6,
    mass: 0.85,
    hp: 50,
    width: 16,
    length: 26,
    colors: ["#e84020", "#f0c020", "#1a1a1a", "#ffffff", "#5a30a0"],
  },
  taxi: {
    maxSpeed: 200,
    accel: 200,
    handling: 2.4,
    mass: 1.0,
    hp: 70,
    width: 16,
    length: 26,
    colors: ["#f0c030"],
  },
};

export function createVehicle(
  kind: VehicleKind,
  x: number,
  y: number,
  angle = 0,
): Vehicle {
  const spec = VEHICLE_SPECS[kind];
  return {
    id: newId(),
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    angle,
    steer: 0,
    throttle: 0,
    brake: 0,
    handbrake: 0,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    handling: spec.handling,
    mass: spec.mass,
    hp: spec.hp,
    maxHp: spec.hp,
    width: spec.width,
    length: spec.length,
    color: pick(spec.colors),
    driver: null,
    damage: 0,
    onFire: false,
    fireTimer: 0,
    aiTimer: 0,
    aiTargetAngle: angle,
    aiThrottle: 0,
    aiTargetX: x,
    aiTargetY: y,
    aiLastNode: -1,
    aiHeading: 0,
    honkTimer: 0,
    signal: 0,
    pitTimer: 0,
    stuckTimer: 0,
    reverseTimer: 0,
    yieldingTimer: 0,
    blockedTimer: 0,
    drivingStyle: Math.random() < 0.2 ? "aggressive" : Math.random() < 0.3 ? "cautious" : "normal",
    visualVariant: Math.random(),
  };
}

const HUMAN_SPECS: Record<
  HumanKind,
  {
    hp: number;
    speed: number;
    weapon: WeaponKind;
    ammo: number;
    shirts: string[];
    pants: string[];
    hairs: string[];
  }
> = {
  player: {
    hp: 100,
    speed: 60,
    weapon: "fist",
    ammo: 0,
    shirts: ["#ffd040"],
    pants: ["#3a3a8a"],
    hairs: ["#3a2a1a"],
  },
  pedestrian: {
    hp: 30,
    speed: 28,
    weapon: "fist",
    ammo: 0,
    shirts: ["#a08a70", "#5a8a4a", "#9a4a4a", "#3a6a8a", "#c0a8e0", "#ffaa50", "#308870"],
    pants: ["#3a3a3a", "#5a3a2a", "#1a1a3a", "#4a4a2a", "#3a2a3a"],
    hairs: ["#1a1a1a", "#5a3a1a", "#a06a3a", "#daa830", "#888888"],
  },
  gang: {
    hp: 60,
    speed: 36,
    weapon: "pistol",
    ammo: 30,
    shirts: ["#1a1a1a", "#3a1a1a", "#1a3a1a"],
    pants: ["#0a0a0a", "#1a1a1a"],
    hairs: ["#0a0a0a", "#3a2a1a"],
  },
  police: {
    hp: 80,
    speed: 38,
    weapon: "pistol",
    ammo: 60,
    shirts: ["#1a3a6a"],
    pants: ["#0a1a3a"],
    hairs: ["#1a1a1a", "#5a3a1a", "#888888"],
  },
};

export function createHuman(
  kind: HumanKind,
  x: number,
  y: number,
  angle = 0,
): Human {
  const spec = HUMAN_SPECS[kind];
  return {
    id: newId(),
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    angle,
    hp: spec.hp,
    maxHp: spec.hp,
    speed: spec.speed,
    inVehicle: null,
    aiState: kind === "player" ? "idle" : "wander",
    aiTimer: 0,
    aiTargetX: x,
    aiTargetY: y,
    aiPath: [],
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    panicFromX: x,
    panicFromY: y,
    witnessTimer: 0,
    squadRole: 0,
    homeX: x,
    homeY: y,
    walkPhase: rand(0, Math.PI * 2),
    shirtColor: pick(spec.shirts),
    pantsColor: pick(spec.pants),
    hairColor: pick(spec.hairs),
    weapon: spec.weapon,
    ammo: spec.ammo,
    ownedGuns: spec.weapon !== "fist" ? [spec.weapon] : [],
    fireTimer: 0,
    punchTimer: 0,
    isPlayer: kind === "player",
    busted: false,
    deathAnim: 0,
    hitCooldown: 0,
    stamina: 1,
    staminaLocked: false,
    behavior: kind === "pedestrian" ? (Math.random() < 0.15 ? "jogger" : Math.random() < 0.15 ? "slow" : "normal") : "normal",
    chatTimer: 0,
    bravery: kind === "pedestrian" ? rand(0, 0.6) : rand(0.5, 1.0),
    groupId: -1,
    witnessCrimePos: undefined,
  };
}

const DOG_COLORS = ["#6b4a2b", "#3a2418", "#c9a06b", "#222", "#dcb98a", "#7a5b3a"];
const CAT_COLORS = ["#2b2b2b", "#cc9b58", "#dadada", "#56402b", "#e7d4a3"];

export function createAnimal(
  kind: import("./types").AnimalKind,
  x: number,
  y: number,
): Animal {
  const specs: Record<import("./types").AnimalKind, { hp: number; speed: number; colors: string[] }> = {
    dog: { hp: 30, speed: 110, colors: ["#6b4a2b", "#3a2418", "#c9a06b", "#222", "#dcb98a", "#7a5b3a"] },
    cat: { hp: 18, speed: 140, colors: ["#2b2b2b", "#cc9b58", "#dadada", "#56402b", "#e7d4a3"] },
    pigeon: { hp: 6, speed: 70, colors: ["#7e8a99"] },
    deer: { hp: 45, speed: 160, colors: ["#8b5e3c", "#a0785a"] },
    bear: { hp: 200, speed: 120, colors: ["#3d2b1f", "#1a130f"] },
    wolf: { hp: 60, speed: 180, colors: ["#7f8c8d", "#2c3e50"] },
    cow: { hp: 120, speed: 40, colors: ["#fdfdfd"] },
    boar: { hp: 80, speed: 150, colors: ["#4a3a2a", "#2a1a0a"] },
  };
  const spec = specs[kind] || specs.dog;
  return {
    id: newId(),
    kind,
    breed: Math.floor(Math.random() * 4),
    x,
    y,
    vx: 0,
    vy: 0,
    angle: rand(0, Math.PI * 2),
    speed: spec.speed,
    hp: spec.hp,
    state: "wander",
    stateTimer: rand(0.5, 3),
    walkPhase: rand(0, Math.PI * 2),
    furColor: pick(spec.colors),
    flyZ: 0,
    flyTimer: 0,
    panicFromX: x,
    panicFromY: y,
    homeX: x,
    homeY: y,
  };
}

export function createBirdFlock(x: number, y: number, vx: number, vy: number): BirdFlock {
  return {
    id: newId(),
    x,
    y,
    vx,
    vy,
    size: Math.floor(rand(4, 12)),
    altitude: rand(0.6, 1),
    life: rand(8, 14),
    flapPhase: rand(0, Math.PI * 2),
  };
}

export function createProp(
  kind: PropKind,
  x: number,
  y: number,
  variant = 0,
): Prop {
  const solidRadius =
    kind === "tree" || kind === "oak" ? 14
      : kind === "pine" ? 12
        : kind === "palm" ? 10
          : kind === "cactus" ? 7
            : kind === "fountain" ? 18
              : kind === "lamp" ? 6
                : kind === "hydrant" ? 7
                  : kind === "mailbox" ? 9
                    : kind === "bench" ? 12
                      : kind === "trashcan" ? 9
                        : 0;
  return { kind, x, y, variant, solidRadius };
}

export const VEHICLE_KINDS: VehicleKind[] = [
  "sedan",
  "sedan",
  "sedan",
  "muscle",
  "truck",
  "sports",
  "taxi",
];
