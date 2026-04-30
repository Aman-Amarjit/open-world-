// Interior scenes: when the player walks into an enterable shop they switch
// from the city overworld into a hand-crafted interior room. They can walk
// around, browse fixtures, and approach a counter to receive the shop service.
import type { GameState, Particle } from "./types";
import type { Shop, ShopKind } from "./world";
import { audioEngine } from "./audio";
import { pick, rand, shadeHex } from "./utils";

// ---- TYPES ----

export type InteriorPropKind =
  | "counter"
  | "shelf"
  | "register"
  | "rack"
  | "weaponDisplay"
  | "ammoCrate"
  | "bed"
  | "medCabinet"
  | "ivStand"
  | "monitor"
  | "deskLamp"
  | "table"
  | "chair"
  | "stool"
  | "stove"
  | "fridge"
  | "fryer"
  | "couch"
  | "tv"
  | "rug"
  | "plantPot"
  | "trash"
  | "lockerSign"
  | "vendingMachine"
  | "fluorescentLight"
  | "doormat"
  | "stack"
  | "pillar";

export interface InteriorProp {
  kind: InteriorPropKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;       // rotation
  variant?: number;
  solid?: boolean;
  // optional color overrides
  color?: string;
}

export type InteriorRole = "clerk" | "doctor" | "patient" | "patron" | "cook" | "guard" | "civilian";

export interface InteriorNPC {
  id: number;
  role: InteriorRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  walkPhase: number;
  // home / wander anchor
  homeX: number;
  homeY: number;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  // tiny chat bubble timer
  speakTimer: number;
  speakLine: string;
}

export interface Interior {
  shopId: number;
  shopKind: ShopKind;
  shopName: string;
  signColor: string;
  // room dimensions (interior space, in pixels)
  width: number;
  height: number;
  // visual
  floorColor: string;
  floorAccent: string;
  wallColor: string;
  wallTrim: string;
  // collision rectangles (in addition to the room walls)
  walls: { x: number; y: number; w: number; h: number }[];
  // decorative + collidable props
  props: InteriorProp[];
  npcs: InteriorNPC[];
  // exit door rectangle (player must stand on it and press E)
  exit: { x: number; y: number; w: number; h: number };
  // counter / interaction zone for the shop service
  interact: { x: number; y: number; w: number; h: number; label: string };
  // PLAYER INSIDE
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  pAngle: number;
  pWalkPhase: number;
  // gameplay timers
  enterTimer: number;       // intro fade-in
  actionCooldown: number;   // service cooldown
  exitCooldown: number;     // grace period after entering
  flashTimer: number;       // brief flash when service used
  flashColor: string;
  // misc
  particles: Particle[];
  bannerMsg: string | null;
  bannerTimer: number;
}

// ---- CONFIG: pricing & effect labels per shop ----
export const INTERIOR_SHOP_INFO: Record<
  ShopKind,
  { label: string; cost: number; cooldown: number }
> = {
  hospital:    { label: "Heal at counter — $50", cost: 50,  cooldown: 1.5 },
  gun_shop:    { label: "Buy pistol + 50 rounds — $100", cost: 100, cooldown: 1.5 },
  ammu:        { label: "Buy SMG + 100 rounds — $200", cost: 200, cooldown: 1.5 },
  food:        { label: "Order food (free) +25 HP", cost: 0,   cooldown: 1.5 },
  safehouse:   { label: "Save spawn (free) — full heal", cost: 0,   cooldown: 1.5 },
  pay_n_spray: { label: "Respray car — $100", cost: 100, cooldown: 1.5 },
};

// ---- GENERATION ----
// Shops are entered on foot. pay_n_spray is handled by the legacy overlay.
const ROOM_W = 360;
const ROOM_H = 260;
const WALL_THICK = 12;
const DOOR_W = 36;

let _npcId = 1;
function nid(): number { return _npcId++; }

const SKIN_TONES = ["#d4a378", "#b88860", "#8a5d3b", "#e8c8a0", "#a07050"];
const HAIR_COLORS = ["#1a1a1a", "#3a2410", "#6a4a2a", "#a07040", "#d4b070", "#5a4030"];

function makeNPC(
  role: InteriorRole,
  x: number,
  y: number,
  shirt: string,
  pants: string,
): InteriorNPC {
  return {
    id: nid(),
    role,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    walkPhase: Math.random() * Math.PI * 2,
    homeX: x,
    homeY: y,
    shirtColor: shirt,
    pantsColor: pants,
    hairColor: pick(HAIR_COLORS),
    speakTimer: 0,
    speakLine: "",
  };
}

function emptyInterior(shop: Shop): Interior {
  return {
    shopId: shop.id,
    shopKind: shop.kind,
    shopName: shop.name,
    signColor: shop.color,
    width: ROOM_W,
    height: ROOM_H,
    floorColor: "#5a5048",
    floorAccent: "#3a342c",
    wallColor: "#3a3a44",
    wallTrim: "#1a1a22",
    walls: [],
    props: [],
    npcs: [],
    exit: { x: ROOM_W / 2 - DOOR_W / 2, y: ROOM_H - WALL_THICK, w: DOOR_W, h: WALL_THICK },
    interact: { x: ROOM_W / 2 - 50, y: WALL_THICK + 30, w: 100, h: 40, label: "Service" },
    px: ROOM_W / 2,
    py: ROOM_H - WALL_THICK - 18,
    pvx: 0,
    pvy: 0,
    pAngle: -Math.PI / 2,
    pWalkPhase: 0,
    enterTimer: 0.6,
    actionCooldown: 0,
    exitCooldown: 0.7,
    flashTimer: 0,
    flashColor: "#ffffff",
    particles: [],
    bannerMsg: null,
    bannerTimer: 0,
  };
}

export function buildInterior(shop: Shop): Interior {
  const ir = emptyInterior(shop);
  // door at south wall — already set in emptyInterior
  switch (shop.kind) {
    case "hospital":      decorHospital(ir);  break;
    case "gun_shop":      decorGunShop(ir);   break;
    case "ammu":          decorAmmu(ir);      break;
    case "food":          decorFood(ir);      break;
    case "safehouse":     decorSafehouse(ir); break;
    case "pay_n_spray":   decorGarage(ir);    break;
  }
  return ir;
}

// ---- DECOR FUNCTIONS ----

function decorHospital(ir: Interior) {
  ir.floorColor = "#dde4e8";       // sterile tile
  ir.floorAccent = "#b8c2c8";
  ir.wallColor = "#eaf2f4";
  ir.wallTrim = "#7a9aa8";
  ir.interact.label = "RECEPTION — heal $50";

  // Reception counter
  ir.props.push({ kind: "counter", x: ROOM_W / 2 - 60, y: WALL_THICK + 24, w: 120, h: 22, solid: true, color: "#e8e8ec" });
  ir.props.push({ kind: "register", x: ROOM_W / 2 + 36, y: WALL_THICK + 28, w: 14, h: 12, color: "#bbbbbb" });
  ir.props.push({ kind: "monitor", x: ROOM_W / 2 - 50, y: WALL_THICK + 28, w: 16, h: 12, color: "#1a2e3a" });
  ir.props.push({ kind: "deskLamp", x: ROOM_W / 2 - 26, y: WALL_THICK + 28, w: 8, h: 8 });

  // Beds along the right wall (each has IV stand)
  for (let i = 0; i < 2; i++) {
    const by = 90 + i * 80;
    ir.props.push({ kind: "bed", x: ROOM_W - 80, y: by, w: 56, h: 30, solid: true, color: "#f0f0f5", variant: i });
    ir.props.push({ kind: "ivStand", x: ROOM_W - 86, y: by + 4, w: 6, h: 28, solid: true });
    ir.props.push({ kind: "monitor", x: ROOM_W - 22, y: by + 6, w: 14, h: 12, color: "#0a3a5a" });
  }
  // Med cabinets along left wall
  ir.props.push({ kind: "medCabinet", x: 24, y: 80, w: 28, h: 20, solid: true, color: "#ffffff" });
  ir.props.push({ kind: "medCabinet", x: 24, y: 110, w: 28, h: 20, solid: true, color: "#ffffff" });
  ir.props.push({ kind: "medCabinet", x: 24, y: 140, w: 28, h: 20, solid: true, color: "#ffffff" });

  // Waiting area chairs
  for (let i = 0; i < 4; i++) {
    ir.props.push({ kind: "chair", x: 30 + i * 26, y: ROOM_H - 80, w: 16, h: 14, solid: true, color: "#3a78a8" });
  }
  // Plant pot
  ir.props.push({ kind: "plantPot", x: 30, y: ROOM_H - 50, w: 16, h: 18, solid: true });
  // Doormat
  ir.props.push({ kind: "doormat", x: ROOM_W / 2 - 28, y: ROOM_H - WALL_THICK - 16, w: 56, h: 14 });
  // Fluorescent lights
  ir.props.push({ kind: "fluorescentLight", x: ROOM_W / 2 - 50, y: 30, w: 100, h: 6 });
  ir.props.push({ kind: "fluorescentLight", x: ROOM_W / 2 - 50, y: 130, w: 100, h: 6 });

  // NPCs: doctor behind counter, a patient on first bed, a patron in chair
  ir.npcs.push(makeNPC("doctor", ROOM_W / 2 - 6, WALL_THICK + 14, "#ffffff", "#a4c4d8"));
  ir.npcs.push(makeNPC("patient", ROOM_W - 60, 100, "#a8e0e0", "#5a7a8a"));
  ir.npcs.push(makeNPC("civilian", 40, ROOM_H - 70, "#c84050", "#3a3a3a"));
}

function decorGunShop(ir: Interior) {
  ir.floorColor = "#322a22";
  ir.floorAccent = "#1a140e";
  ir.wallColor = "#5a4a3a";
  ir.wallTrim = "#2a1f15";
  ir.interact.label = "COUNTER — buy pistol $100";

  // Counter spans the back wall
  ir.props.push({ kind: "counter", x: WALL_THICK + 30, y: WALL_THICK + 30, w: ROOM_W - 60 - WALL_THICK * 2, h: 22, solid: true, color: "#3a2a1c" });
  ir.props.push({ kind: "register", x: ROOM_W / 2 - 8, y: WALL_THICK + 36, w: 16, h: 12, color: "#222" });

  // Weapon display rack on back wall (above counter)
  for (let i = 0; i < 5; i++) {
    ir.props.push({
      kind: "weaponDisplay",
      x: WALL_THICK + 40 + i * 50,
      y: WALL_THICK + 14,
      w: 40,
      h: 14,
      variant: i,
    });
  }
  // Glass display cases on the side walls
  ir.props.push({ kind: "rack", x: 24, y: 90, w: 24, h: 50, solid: true, color: "#1a1a22" });
  ir.props.push({ kind: "rack", x: 24, y: 150, w: 24, h: 50, solid: true, color: "#1a1a22" });
  ir.props.push({ kind: "rack", x: ROOM_W - 48, y: 90, w: 24, h: 50, solid: true, color: "#1a1a22" });
  ir.props.push({ kind: "rack", x: ROOM_W - 48, y: 150, w: 24, h: 50, solid: true, color: "#1a1a22" });

  // Stack of ammo crates near entrance
  ir.props.push({ kind: "ammoCrate", x: 70, y: ROOM_H - 80, w: 22, h: 18, solid: true, variant: 0 });
  ir.props.push({ kind: "ammoCrate", x: 92, y: ROOM_H - 80, w: 22, h: 18, solid: true, variant: 1 });
  ir.props.push({ kind: "ammoCrate", x: 81, y: ROOM_H - 98, w: 22, h: 18, solid: true, variant: 2 });
  ir.props.push({ kind: "stack", x: ROOM_W - 100, y: ROOM_H - 80, w: 30, h: 22, solid: true });

  // NPCs: clerk behind counter, a patron browsing
  ir.npcs.push(makeNPC("clerk", ROOM_W / 2, WALL_THICK + 18, "#1a1a1a", "#3a2a1c"));
  ir.npcs.push(makeNPC("patron", 100, 130, "#3a3a3a", "#5a3a22"));
  ir.npcs.push(makeNPC("guard", ROOM_W - 80, 130, "#0a0a0a", "#1a1a1a"));

  // Doormat and lights
  ir.props.push({ kind: "doormat", x: ROOM_W / 2 - 28, y: ROOM_H - WALL_THICK - 16, w: 56, h: 14 });
  ir.props.push({ kind: "fluorescentLight", x: ROOM_W / 2 - 60, y: 90, w: 120, h: 5 });
  ir.props.push({ kind: "lockerSign", x: ROOM_W / 2 - 60, y: WALL_THICK + 4, w: 120, h: 8 });
}

function decorAmmu(ir: Interior) {
  decorGunShop(ir);
  ir.interact.label = "COUNTER — buy SMG $200";
  // shift palette / vibe slightly more militaristic
  ir.wallColor = "#3a4a3a";
  ir.wallTrim = "#1a221a";
  ir.floorColor = "#272722";
  ir.floorAccent = "#15150f";
}

function decorFood(ir: Interior) {
  ir.floorColor = "#e0c060";
  ir.floorAccent = "#a87a30";
  ir.wallColor = "#ffe080";
  ir.wallTrim = "#d09020";
  ir.interact.label = "ORDER — Burger combo (free) +25 HP";

  // Counter at back
  ir.props.push({ kind: "counter", x: ROOM_W / 2 - 80, y: WALL_THICK + 30, w: 160, h: 22, solid: true, color: "#c84020" });
  ir.props.push({ kind: "register", x: ROOM_W / 2 - 8, y: WALL_THICK + 36, w: 16, h: 12, color: "#fff048" });
  // Behind counter: kitchen equipment
  ir.props.push({ kind: "stove", x: WALL_THICK + 30, y: WALL_THICK + 6, w: 26, h: 18, solid: true });
  ir.props.push({ kind: "fryer", x: WALL_THICK + 60, y: WALL_THICK + 6, w: 22, h: 18, solid: true });
  ir.props.push({ kind: "fridge", x: ROOM_W - WALL_THICK - 32, y: WALL_THICK + 6, w: 22, h: 22, solid: true });
  ir.props.push({ kind: "lockerSign", x: ROOM_W / 2 - 60, y: WALL_THICK + 4, w: 120, h: 8, color: "#c84020" });

  // Tables w/ chairs in dining area
  const tables: [number, number][] = [
    [80, 130], [200, 130], [80, 200], [200, 200],
  ];
  for (const [tx, ty] of tables) {
    ir.props.push({ kind: "table", x: tx - 14, y: ty - 14, w: 28, h: 28, solid: true });
    ir.props.push({ kind: "chair", x: tx - 22, y: ty - 6, w: 10, h: 10, solid: true });
    ir.props.push({ kind: "chair", x: tx + 12, y: ty - 6, w: 10, h: 10, solid: true });
    ir.props.push({ kind: "chair", x: tx - 6, y: ty - 22, w: 10, h: 10, solid: true });
  }
  // Vending machine
  ir.props.push({ kind: "vendingMachine", x: ROOM_W - 50, y: ROOM_H - 80, w: 26, h: 36, solid: true });
  // Trash
  ir.props.push({ kind: "trash", x: 30, y: ROOM_H - 60, w: 16, h: 18, solid: true });
  ir.props.push({ kind: "doormat", x: ROOM_W / 2 - 28, y: ROOM_H - WALL_THICK - 16, w: 56, h: 14, color: "#c84020" });
  ir.props.push({ kind: "fluorescentLight", x: ROOM_W / 2 - 50, y: 100, w: 100, h: 5 });

  // NPCs: cook + cashier + 2 patrons
  ir.npcs.push(makeNPC("cook", WALL_THICK + 60, WALL_THICK + 24, "#ffffff", "#1a1a1a"));
  ir.npcs.push(makeNPC("clerk", ROOM_W / 2 - 18, WALL_THICK + 16, "#c84020", "#3a2a1c"));
  ir.npcs.push(makeNPC("patron", 72, 130, "#5fa8ff", "#3a3a3a"));
  ir.npcs.push(makeNPC("patron", 200, 130, "#a040c0", "#1a1a1a"));
}

function decorSafehouse(ir: Interior) {
  ir.floorColor = "#9a7a5a";
  ir.floorAccent = "#6a4a2a";
  ir.wallColor = "#c8b89a";
  ir.wallTrim = "#7a5a3a";
  ir.interact.label = "BED — sleep / save spawn (full heal)";

  // Cozy bed in the back
  ir.props.push({ kind: "bed", x: ROOM_W / 2 - 28, y: WALL_THICK + 20, w: 56, h: 36, solid: true, color: "#a04030", variant: 0 });
  // Couch + TV
  ir.props.push({ kind: "couch", x: ROOM_W / 2 - 50, y: ROOM_H - 90, w: 100, h: 28, solid: true, color: "#5a4030" });
  ir.props.push({ kind: "tv", x: ROOM_W / 2 - 18, y: ROOM_H - 130, w: 36, h: 22, solid: true });
  ir.props.push({ kind: "rug", x: ROOM_W / 2 - 60, y: ROOM_H - 170, w: 120, h: 70, color: "#c8a060" });

  // Side table & lamp
  ir.props.push({ kind: "table", x: 40, y: 90, w: 26, h: 26, solid: true, color: "#8a5a3a" });
  ir.props.push({ kind: "deskLamp", x: 50, y: 92, w: 8, h: 12 });
  // Plants
  ir.props.push({ kind: "plantPot", x: ROOM_W - 50, y: 90, w: 16, h: 18, solid: true });
  ir.props.push({ kind: "plantPot", x: 28, y: ROOM_H - 50, w: 16, h: 18, solid: true });

  // Doormat
  ir.props.push({ kind: "doormat", x: ROOM_W / 2 - 28, y: ROOM_H - WALL_THICK - 16, w: 56, h: 14, color: "#5a4030" });
  // Move interact zone over the bed
  ir.interact.x = ROOM_W / 2 - 30;
  ir.interact.y = WALL_THICK + 24;
  ir.interact.w = 60;
  ir.interact.h = 40;
}

function decorGarage(ir: Interior) {
  // Pay 'n' spray garage. Player inside vehicle when this is shown.
  ir.floorColor = "#3a3a3a";
  ir.floorAccent = "#2a2a2a";
  ir.wallColor = "#454040";
  ir.wallTrim = "#1f1f1f";
  ir.interact.label = "RESPRAY — $100 (use car)";

  // Tool wall
  ir.props.push({ kind: "lockerSign", x: ROOM_W / 2 - 60, y: WALL_THICK + 4, w: 120, h: 8, color: "#3affc8" });
  ir.props.push({ kind: "shelf", x: WALL_THICK + 8, y: WALL_THICK + 30, w: 60, h: 10, solid: true });
  ir.props.push({ kind: "shelf", x: WALL_THICK + 8, y: WALL_THICK + 50, w: 60, h: 10, solid: true });
  ir.props.push({ kind: "shelf", x: ROOM_W - WALL_THICK - 68, y: WALL_THICK + 30, w: 60, h: 10, solid: true });
  ir.props.push({ kind: "shelf", x: ROOM_W - WALL_THICK - 68, y: WALL_THICK + 50, w: 60, h: 10, solid: true });

  // Pillars
  ir.props.push({ kind: "pillar", x: 50, y: 130, w: 14, h: 14, solid: true });
  ir.props.push({ kind: "pillar", x: ROOM_W - 64, y: 130, w: 14, h: 14, solid: true });
  // Mechanic
  ir.npcs.push(makeNPC("clerk", ROOM_W / 2, 100, "#3affc8", "#1f1f1f"));
}

// ---- ENTER / EXIT ----
export function enterInterior(state: GameState, shop: Shop): boolean {
  // pay_n_spray uses a different flow (vehicle-based) — caller handles that.
  if (state.interior) return false;
  // Save the spot to return to (just outside the door)
  state.interiorReturnX = shop.doorX;
  state.interiorReturnY = shop.doorY;
  state.interior = buildInterior(shop);
  // little interior sound cue
  playInteriorChime();
  state.notifications.push({ text: `Welcome to ${shop.name}`, life: 2.0, color: shop.color });
  return true;
}

function playInteriorChime() {
  // No public chime in audioEngine; reuse pickup sfx as a soft "ding"
  try { audioEngine.playPickup(); } catch { /* noop */ }
}

export function exitInterior(state: GameState) {
  if (!state.interior) return;
  state.interior = null;
  // Place player just outside the door, facing south
  state.player.x = state.interiorReturnX;
  state.player.y = state.interiorReturnY + 28; // a tile away from the building
  state.player.vx = 0;
  state.player.vy = 0;
}

// ---- SIMULATION TICK ----
const PLAYER_SPEED = 90; // px/sec inside interior

export function updateInterior(state: GameState, dt: number) {
  const ir = state.interior;
  if (!ir) return;
  // Tick timers
  ir.enterTimer = Math.max(0, ir.enterTimer - dt);
  ir.exitCooldown = Math.max(0, ir.exitCooldown - dt);
  ir.actionCooldown = Math.max(0, ir.actionCooldown - dt);
  ir.flashTimer = Math.max(0, ir.flashTimer - dt);
  if (ir.bannerTimer > 0) ir.bannerTimer = Math.max(0, ir.bannerTimer - dt);

  // PLAYER MOVEMENT
  const inp = state.input;
  let mx = 0, my = 0;
  if (inp.up) my -= 1;
  if (inp.down) my += 1;
  if (inp.left) mx -= 1;
  if (inp.right) mx += 1;
  const m = Math.hypot(mx, my);
  if (m > 0) {
    mx /= m; my /= m;
    ir.pvx = mx * PLAYER_SPEED;
    ir.pvy = my * PLAYER_SPEED;
    ir.pAngle = Math.atan2(my, mx);
    ir.pWalkPhase += dt * 12;
  } else {
    ir.pvx = 0;
    ir.pvy = 0;
  }
  // Move with collision
  movePlayerInInterior(ir, dt);

  // EXIT — walking onto the doormat tile + grace period passed
  if (
    ir.exitCooldown <= 0 &&
    ir.py + 5 >= ir.exit.y &&
    ir.px >= ir.exit.x &&
    ir.px <= ir.exit.x + ir.exit.w
  ) {
    exitInterior(state);
    return;
  }

  // INTERACT — standing in front of counter + press E
  const inInteract =
    ir.px >= ir.interact.x &&
    ir.px <= ir.interact.x + ir.interact.w &&
    ir.py >= ir.interact.y - 24 &&
    ir.py <= ir.interact.y + ir.interact.h + 24;

  if (inInteract && inp.enter && ir.actionCooldown <= 0) {
    inp.enter = false;
    triggerInteriorAction(state);
  } else if (inp.enter && ir.exitCooldown <= 0 && !inInteract) {
    // Allow E to exit (alternative)
    // only if player near the door
    const onDoor =
      ir.py + 5 >= ir.exit.y - 12 &&
      ir.px >= ir.exit.x - 6 &&
      ir.px <= ir.exit.x + ir.exit.w + 6;
    if (onDoor) {
      inp.enter = false;
      exitInterior(state);
      return;
    }
  }

  // Stash interact state on input so HUD can render a prompt
  state.interiorInteractActive = inInteract && ir.actionCooldown <= 0;

  // NPC IDLE WANDER
  for (const n of ir.npcs) {
    n.walkPhase += dt * 8;
    n.speakTimer = Math.max(0, n.speakTimer - dt);
    // small wander
    if (Math.random() < 0.005) {
      n.vx = rand(-15, 15);
      n.vy = rand(-15, 15);
      // re-anchor
      if (Math.hypot(n.x - n.homeX, n.y - n.homeY) > 30) {
        n.vx = (n.homeX - n.x) * 0.3;
        n.vy = (n.homeY - n.y) * 0.3;
      }
    } else {
      n.vx *= Math.pow(0.5, dt * 3);
      n.vy *= Math.pow(0.5, dt * 3);
    }
    if (Math.hypot(n.vx, n.vy) > 1) {
      n.angle = Math.atan2(n.vy, n.vx);
    } else {
      // face the player when idle and close
      const d = Math.hypot(ir.px - n.x, ir.py - n.y);
      if (d < 60) n.angle = Math.atan2(ir.py - n.y, ir.px - n.x);
    }
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    // clamp to room
    n.x = Math.max(WALL_THICK + 6, Math.min(ROOM_W - WALL_THICK - 6, n.x));
    n.y = Math.max(WALL_THICK + 6, Math.min(ROOM_H - WALL_THICK - 6, n.y));
  }

  // PARTICLES
  for (let i = ir.particles.length - 1; i >= 0; i--) {
    const p = ir.particles[i]!;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += dt * 30;
    if (p.life <= 0) ir.particles.splice(i, 1);
  }

  // Ambient particles per shop kind
  if (Math.random() < 0.2 * dt + 0.05) {
    if (ir.shopKind === "food") {
      // steam from kitchen
      ir.particles.push({
        x: WALL_THICK + 50 + rand(-5, 20),
        y: WALL_THICK + 14,
        vx: rand(-5, 5),
        vy: -rand(20, 40),
        life: 1.4,
        maxLife: 1.4,
        size: 2.5,
        kind: "smoke",
        color: "#ffffff",
        rotation: 0,
        rotationSpeed: 0,
      });
    } else if (ir.shopKind === "hospital") {
      // soft cleansing dust motes
      if (Math.random() < 0.05) {
        ir.particles.push({
          x: rand(20, ROOM_W - 20),
          y: rand(20, 40),
          vx: rand(-5, 5),
          vy: rand(2, 8),
          life: 2.0,
          maxLife: 2.0,
          size: 1.0,
          kind: "smoke",
          color: "#cce8ff",
          rotation: 0,
          rotationSpeed: 0,
        });
      }
    }
  }
}

function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function movePlayerInInterior(ir: Interior, dt: number) {
  const PR = 5; // player collision radius (square)
  // Try X axis first
  const newX = ir.px + ir.pvx * dt;
  if (!isBlocked(ir, newX, ir.py, PR)) {
    ir.px = newX;
  }
  const newY = ir.py + ir.pvy * dt;
  if (!isBlocked(ir, ir.px, newY, PR)) {
    ir.py = newY;
  }
  // Hard clamp inside walls (doorway lets player exit beyond wall)
  ir.px = Math.max(WALL_THICK + PR, Math.min(ir.width - WALL_THICK - PR, ir.px));
  // Allow stepping a little past the door edge for exit triggering
  const isAtDoor = ir.px >= ir.exit.x && ir.px <= ir.exit.x + ir.exit.w;
  const yMax = isAtDoor ? ir.height - 2 : ir.height - WALL_THICK - PR;
  ir.py = Math.max(WALL_THICK + PR, Math.min(yMax, ir.py));
}

function isBlocked(ir: Interior, x: number, y: number, r: number): boolean {
  // wall rects
  const px = x - r, py = y - r, pw = r * 2, ph = r * 2;
  for (const w of ir.walls) {
    if (rectsIntersect(px, py, pw, ph, w.x, w.y, w.w, w.h)) return true;
  }
  for (const p of ir.props) {
    if (!p.solid) continue;
    if (rectsIntersect(px, py, pw, ph, p.x, p.y, p.w, p.h)) return true;
  }
  return false;
}

function triggerInteriorAction(state: GameState) {
  const ir = state.interior!;
  const info = INTERIOR_SHOP_INFO[ir.shopKind];
  const p = state.player;
  if (state.money < info.cost) {
    ir.bannerMsg = `INSUFFICIENT FUNDS — $${info.cost}`;
    ir.bannerTimer = 1.6;
    ir.flashColor = "#ff5050";
    ir.flashTimer = 0.4;
    return;
  }
  let msg = "";
  switch (ir.shopKind) {
    case "hospital":
      p.hp = p.maxHp;
      state.money -= info.cost;
      msg = "FULL HEALTH RESTORED";
      ir.flashColor = "#80ff80";
      break;
    case "food":
      p.hp = Math.min(p.maxHp, p.hp + 25);
      msg = "DELICIOUS! +25 HP";
      ir.flashColor = "#fff048";
      break;
    case "gun_shop":
      p.ammo += 50;
      if (p.weapon === "fist") p.weapon = "pistol";
      state.money -= info.cost;
      msg = "PISTOL +50 ROUNDS";
      ir.flashColor = "#cce8ff";
      break;
    case "ammu":
      p.ammo += 100;
      p.weapon = "smg";
      state.money -= info.cost;
      msg = "SMG +100 ROUNDS";
      ir.flashColor = "#ffaa30";
      break;
    case "safehouse":
      state.spawnPoint = { x: state.interiorReturnX, y: state.interiorReturnY };
      p.hp = p.maxHp;
      msg = "SAFEHOUSE SAVED — full heal";
      ir.flashColor = "#80ffaa";
      break;
    case "pay_n_spray":
      // shouldn't usually be reached on foot
      msg = "GET IN A CAR";
      break;
  }
  ir.bannerMsg = msg;
  ir.bannerTimer = 1.6;
  ir.flashTimer = 0.45;
  ir.actionCooldown = info.cooldown;
  state.notifications.push({ text: msg, life: 1.6, color: ir.signColor });
  // little spark burst at counter
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    ir.particles.push({
      x: ir.interact.x + ir.interact.w / 2,
      y: ir.interact.y + ir.interact.h / 2,
      vx: Math.cos(a) * rand(20, 60),
      vy: Math.sin(a) * rand(20, 60) - 20,
      life: 0.6,
      maxLife: 0.6,
      size: 1.2,
      kind: "spark",
      color: ir.flashColor,
      rotation: 0,
      rotationSpeed: 0,
    });
  }
  playInteriorChime();
}

// ---- RENDER ----
export function renderInterior(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewW: number,
  viewH: number,
) {
  const ir = state.interior!;
  // Backdrop — dark vignette around the room
  ctx.fillStyle = "#08080c";
  ctx.fillRect(0, 0, viewW, viewH);

  // Center the room with a fixed zoom so it always fits
  const zoom = Math.min(viewW / (ROOM_W + 80), viewH / (ROOM_H + 100));
  const offX = (viewW - ROOM_W * zoom) / 2;
  const offY = (viewH - ROOM_H * zoom) / 2;
  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(zoom, zoom);
  ctx.imageSmoothingEnabled = false;

  // FLOOR — checkerboard tile pattern
  drawFloor(ctx, ir);

  // Walls (north/west/east/south with door cutout)
  drawWalls(ctx, ir);

  // Sign mounted on north wall (large)
  drawShopSign(ctx, ir);

  // Props sorted so back-most draw first
  const propsSorted = [...ir.props].sort((a, b) => a.y - b.y);
  for (const p of propsSorted) {
    if (
      p.kind === "rug" || p.kind === "doormat" || p.kind === "fluorescentLight" ||
      p.kind === "lockerSign"
    ) {
      // already grouped — but draw them earlier
    }
  }
  // Draw "background" props first (rug, doormat, lights, signs)
  for (const p of ir.props) {
    if (p.kind === "rug" || p.kind === "doormat") drawProp(ctx, ir, p);
  }
  // Then collidable props in y-sorted order, mixing player + npcs
  type Drawable = { y: number; draw: () => void };
  const drawables: Drawable[] = [];
  for (const p of ir.props) {
    if (p.kind === "rug" || p.kind === "doormat" || p.kind === "fluorescentLight" || p.kind === "lockerSign") continue;
    drawables.push({ y: p.y + p.h, draw: () => drawProp(ctx, ir, p) });
  }
  for (const n of ir.npcs) {
    drawables.push({ y: n.y, draw: () => drawInteriorHuman(ctx, n) });
  }
  // Player drawable
  drawables.push({
    y: ir.py,
    draw: () => drawInteriorPlayer(ctx, ir),
  });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Overhead lights / signs draw on top
  for (const p of ir.props) {
    if (p.kind === "fluorescentLight" || p.kind === "lockerSign") drawProp(ctx, ir, p);
  }

  // Interaction zone glow
  drawInteractZone(ctx, ir, state);

  // Exit door highlight
  drawExitDoor(ctx, ir);

  // Particles
  for (const p of ir.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    if (p.kind === "smoke") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.2 - a), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Flash overlay when an action triggers
  if (ir.flashTimer > 0) {
    ctx.fillStyle = ir.flashColor;
    ctx.globalAlpha = ir.flashTimer * 0.6;
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    ctx.globalAlpha = 1;
  }

  // Banner message above counter
  if (ir.bannerMsg && ir.bannerTimer > 0) {
    const a = Math.min(1, ir.bannerTimer * 2);
    ctx.globalAlpha = a;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(ir.bannerMsg).width + 20;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(ROOM_W / 2 - tw / 2, ir.interact.y + ir.interact.h + 12, tw, 22);
    ctx.strokeStyle = ir.flashColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(ROOM_W / 2 - tw / 2 + 0.5, ir.interact.y + ir.interact.h + 12 + 0.5, tw - 1, 21);
    ctx.fillStyle = ir.flashColor;
    ctx.fillText(ir.bannerMsg, ROOM_W / 2, ir.interact.y + ir.interact.h + 23);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Outer vignette (after restoring world transform)
  const grd = ctx.createRadialGradient(
    viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.35,
    viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.7,
  );
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, viewW, viewH);

  // Enter fade-in
  if (ir.enterTimer > 0) {
    ctx.fillStyle = `rgba(0,0,0,${ir.enterTimer / 0.6})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, ir: Interior) {
  ctx.fillStyle = ir.floorColor;
  ctx.fillRect(0, 0, ir.width, ir.height);
  // Checker pattern
  const tile = 24;
  ctx.fillStyle = ir.floorAccent;
  for (let y = 0; y < ir.height; y += tile) {
    for (let x = 0; x < ir.width; x += tile) {
      if (((x / tile) + (y / tile)) % 2 === 0) {
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }
  // Subtle grout lines
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= ir.width; x += tile) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ir.height); ctx.stroke();
  }
  for (let y = 0; y <= ir.height; y += tile) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ir.width, y); ctx.stroke();
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, ir: Interior) {
  // North wall
  ctx.fillStyle = ir.wallColor;
  ctx.fillRect(0, 0, ir.width, WALL_THICK);
  // West / East
  ctx.fillRect(0, 0, WALL_THICK, ir.height);
  ctx.fillRect(ir.width - WALL_THICK, 0, WALL_THICK, ir.height);
  // South wall (with door cutout)
  ctx.fillRect(0, ir.height - WALL_THICK, ir.exit.x, WALL_THICK);
  ctx.fillRect(
    ir.exit.x + ir.exit.w,
    ir.height - WALL_THICK,
    ir.width - (ir.exit.x + ir.exit.w),
    WALL_THICK,
  );
  // Wall trim shadow at bottom of each wall (creates depth)
  ctx.fillStyle = ir.wallTrim;
  ctx.fillRect(0, WALL_THICK - 3, ir.width, 3);
  ctx.fillRect(WALL_THICK - 3, 0, 3, ir.height);
  ctx.fillRect(ir.width - WALL_THICK, 0, 3, ir.height);
  ctx.fillRect(0, ir.height - WALL_THICK, ir.exit.x, 3);
  ctx.fillRect(ir.exit.x + ir.exit.w, ir.height - WALL_THICK, ir.width - (ir.exit.x + ir.exit.w), 3);

  // Brick courses on north wall (subtle)
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5;
  for (let y = 2; y < WALL_THICK - 2; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ir.width, y);
    ctx.stroke();
  }

  // Outside-the-door dark step (suggests asphalt)
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(ir.exit.x, ir.height - 4, ir.exit.w, 4);
  // Door frame
  ctx.strokeStyle = ir.wallTrim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ir.exit.x, ir.height - WALL_THICK);
  ctx.lineTo(ir.exit.x, ir.height);
  ctx.moveTo(ir.exit.x + ir.exit.w, ir.height - WALL_THICK);
  ctx.lineTo(ir.exit.x + ir.exit.w, ir.height);
  ctx.stroke();
}

function drawShopSign(ctx: CanvasRenderingContext2D, ir: Interior) {
  // Big sign on north wall above counter
  const sx = ir.width / 2;
  const sy = WALL_THICK + 2;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  const bw = ir.shopName.length * 8 + 24;
  ctx.fillRect(sx - bw / 2, 1, bw, WALL_THICK - 2);
  ctx.strokeStyle = ir.signColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx - bw / 2 + 0.5, 1.5, bw - 1, WALL_THICK - 3);
  ctx.fillStyle = ir.signColor;
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = ir.signColor;
  ctx.shadowBlur = 4;
  ctx.fillText(ir.shopName, sx, WALL_THICK / 2 + 1);
  ctx.shadowBlur = 0;
}

function drawProp(ctx: CanvasRenderingContext2D, ir: Interior, p: InteriorProp) {
  switch (p.kind) {
    case "counter": {
      ctx.fillStyle = p.color || "#3a2a1c";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // Top
      ctx.fillStyle = shadeHex(p.color || "#3a2a1c", 30);
      ctx.fillRect(p.x, p.y - 3, p.w, 5);
      // Front shadow
      ctx.fillStyle = shadeHex(p.color || "#3a2a1c", -25);
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
      // Glass top sheen
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(p.x + 4, p.y - 1, p.w - 30, 1);
      break;
    }
    case "register": {
      ctx.fillStyle = p.color || "#222";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#0a4060";
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 4);
      ctx.fillStyle = "#7affb0";
      ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, 2);
      break;
    }
    case "monitor": {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = p.color || "#1a3a5a";
      ctx.fillRect(p.x + 1, p.y + 1, p.w - 2, p.h - 4);
      // scan lines
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 1; i < p.h - 4; i += 2) ctx.fillRect(p.x + 1, p.y + 1 + i, p.w - 2, 1);
      // stand
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(p.x + p.w / 2 - 2, p.y + p.h - 3, 4, 3);
      break;
    }
    case "deskLamp": {
      // base + arm + shade
      ctx.fillStyle = "#222";
      ctx.fillRect(p.x + 1, p.y + p.h - 2, p.w - 2, 2);
      ctx.fillRect(p.x + p.w / 2 - 0.5, p.y + 2, 1, p.h - 2);
      ctx.fillStyle = "#f0d048";
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y, p.w / 2, 0, Math.PI);
      ctx.fill();
      // glow
      ctx.fillStyle = "rgba(255,220,140,0.45)";
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + 4, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "weaponDisplay": {
      // Wall-mounted weapon silhouette
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      // weapon shape varies by variant
      ctx.fillStyle = "#cccccc";
      const v = (p.variant ?? 0) % 4;
      if (v === 0) {
        // pistol
        ctx.fillRect(p.x + 8, p.y + 5, 14, 3);
        ctx.fillRect(p.x + 12, p.y + 8, 4, 4);
      } else if (v === 1) {
        // smg
        ctx.fillRect(p.x + 4, p.y + 4, 28, 4);
        ctx.fillRect(p.x + 12, p.y + 8, 6, 4);
      } else if (v === 2) {
        // shotgun
        ctx.fillRect(p.x + 4, p.y + 5, 32, 4);
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(p.x + 4, p.y + 5, 8, 4);
      } else {
        // ar
        ctx.fillRect(p.x + 4, p.y + 4, 32, 3);
        ctx.fillRect(p.x + 16, p.y + 7, 4, 5);
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(p.x + 4, p.y + 4, 6, 3);
      }
      break;
    }
    case "ammoCrate": {
      ctx.fillStyle = "#5a4a2a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#3a2e15";
      ctx.fillRect(p.x, p.y, p.w, 3);
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      ctx.fillStyle = "#c8a040";
      ctx.font = "bold 5px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AMMO", p.x + p.w / 2, p.y + p.h / 2);
      break;
    }
    case "rack": {
      ctx.fillStyle = p.color || "#1a1a22";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // glass shelves
      for (let i = 0; i < 3; i++) {
        const sy = p.y + 8 + i * ((p.h - 8) / 3);
        ctx.fillStyle = "rgba(180,220,255,0.18)";
        ctx.fillRect(p.x + 2, sy, p.w - 4, 3);
        ctx.fillStyle = "#cccccc";
        // little items
        for (let j = 0; j < 3; j++) {
          ctx.fillRect(p.x + 4 + j * 5, sy - 4, 3, 4);
        }
      }
      break;
    }
    case "bed": {
      // mattress
      ctx.fillStyle = p.color || "#f0f0f5";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // pillow at one end
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x + 4, p.y + 4, 16, 10);
      // blanket
      ctx.fillStyle = shadeHex(p.color || "#a04030", -20);
      ctx.fillRect(p.x + 22, p.y + 4, p.w - 26, p.h - 8);
      // frame
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      break;
    }
    case "ivStand": {
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(p.x + p.w / 2 - 0.5, p.y, 1, p.h);
      ctx.fillRect(p.x, p.y + p.h - 1, p.w, 2);
      // bag
      ctx.fillStyle = "#f0c0c0";
      ctx.beginPath();
      ctx.ellipse(p.x + p.w / 2, p.y + 4, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "medCabinet": {
      ctx.fillStyle = p.color || "#ffffff";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "#1a1a22";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      // red cross
      ctx.fillStyle = "#c83040";
      ctx.fillRect(p.x + p.w / 2 - 1, p.y + 4, 2, p.h - 8);
      ctx.fillRect(p.x + 4, p.y + p.h / 2 - 1, p.w - 8, 2);
      break;
    }
    case "table": {
      ctx.fillStyle = p.color || "#a08060";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = shadeHex(p.color || "#a08060", -25);
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      // tray on table for food
      if (ir.shopKind === "food") {
        ctx.fillStyle = "#c84020";
        ctx.fillRect(p.x + p.w / 2 - 6, p.y + p.h / 2 - 3, 12, 6);
        ctx.fillStyle = "#ffe080";
        ctx.fillRect(p.x + p.w / 2 - 4, p.y + p.h / 2 - 1, 8, 2);
      }
      break;
    }
    case "chair":
    case "stool": {
      ctx.fillStyle = p.color || "#3a78a8";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = shadeHex(p.color || "#3a78a8", -20);
      ctx.fillRect(p.x, p.y + p.h - 2, p.w, 2);
      // back rest
      if (p.kind === "chair") {
        ctx.fillRect(p.x, p.y - 4, p.w, 4);
      }
      break;
    }
    case "stove": {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // burners
      ctx.fillStyle = "#1a1a1a";
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.arc(p.x + 6 + i * 12, p.y + 4 + j * 8, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // flame
      ctx.fillStyle = "#ff6020";
      ctx.beginPath();
      ctx.arc(p.x + 6, p.y + 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "fryer": {
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#f0d048";
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 6);
      ctx.fillStyle = "#a07a30";
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 2);
      break;
    }
    case "fridge": {
      ctx.fillStyle = "#cccccc";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(p.x, p.y + p.h / 2, p.w, 1);
      ctx.fillStyle = "#222";
      ctx.fillRect(p.x + p.w - 4, p.y + 3, 1, 4);
      ctx.fillRect(p.x + p.w - 4, p.y + p.h / 2 + 3, 1, 4);
      break;
    }
    case "couch": {
      ctx.fillStyle = p.color || "#5a4030";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // cushions
      ctx.fillStyle = shadeHex(p.color || "#5a4030", 18);
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(p.x + 4 + i * (p.w - 8) / 3, p.y + 4, (p.w - 14) / 3, p.h - 12);
      }
      // armrests
      ctx.fillStyle = shadeHex(p.color || "#5a4030", -20);
      ctx.fillRect(p.x, p.y, 6, p.h);
      ctx.fillRect(p.x + p.w - 6, p.y, 6, p.h);
      break;
    }
    case "tv": {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // screen content (animated noise)
      const t = performance.now() / 200;
      ctx.fillStyle = "#1a4a8a";
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 6; i++) {
        const yy = (Math.sin(t + i) + 1) * (p.h - 6) / 2;
        ctx.fillRect(p.x + 2, p.y + 2 + yy, p.w - 4, 1);
      }
      // stand
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(p.x + p.w / 2 - 4, p.y + p.h, 8, 3);
      break;
    }
    case "rug": {
      ctx.fillStyle = p.color || "#c8a060";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = shadeHex(p.color || "#c8a060", -25);
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
      // pattern
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(p.x + 8 + i * (p.w - 16) / 3, p.y + 6);
        ctx.lineTo(p.x + 8 + i * (p.w - 16) / 3, p.y + p.h - 6);
      }
      ctx.stroke();
      break;
    }
    case "doormat": {
      ctx.fillStyle = p.color || "#3a3a3a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      for (let i = 0; i < p.w; i += 3) {
        ctx.beginPath();
        ctx.moveTo(p.x + i, p.y);
        ctx.lineTo(p.x + i, p.y + p.h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "bold 5px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("EXIT", p.x + p.w / 2, p.y + p.h / 2);
      break;
    }
    case "plantPot": {
      ctx.fillStyle = "#7a4030";
      ctx.fillRect(p.x, p.y + p.h - 6, p.w, 6);
      ctx.fillStyle = "#3a7a30";
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2 - 2, p.y + 4, 5, 0, Math.PI * 2);
      ctx.arc(p.x + p.w / 2 + 3, p.y + 2, 5, 0, Math.PI * 2);
      ctx.arc(p.x + p.w / 2, p.y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "trash": {
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(p.x, p.y + 2, p.w, p.h - 2);
      ctx.fillStyle = "#222";
      ctx.fillRect(p.x - 1, p.y, p.w + 2, 3);
      break;
    }
    case "vendingMachine": {
      ctx.fillStyle = "#c83040";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(p.x + 2, p.y + 4, p.w - 4, p.h * 0.5);
      // bottles
      ctx.fillStyle = "#5fa8ff";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(p.x + 4 + i * 6, p.y + 6, 4, 8);
      }
      ctx.fillStyle = "#fff048";
      ctx.fillRect(p.x + 2, p.y + p.h * 0.65, p.w - 4, 3);
      // slot
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(p.x + p.w / 2 - 4, p.y + p.h - 8, 8, 3);
      break;
    }
    case "fluorescentLight": {
      // ceiling lamp band drawn near top of room
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // glow
      ctx.fillStyle = "rgba(255,255,200,0.18)";
      ctx.fillRect(p.x - 6, p.y - 4, p.w + 12, p.h + 12);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      break;
    }
    case "lockerSign": {
      // colored band over the counter
      ctx.fillStyle = p.color || "#ffd84a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(p.x, p.y + p.h - 1, p.w, 1);
      break;
    }
    case "pillar": {
      ctx.fillStyle = "#7a7a7a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#5a5a5a";
      ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
      break;
    }
    case "shelf": {
      ctx.fillStyle = "#6a4a2a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#3a2a18";
      ctx.fillRect(p.x, p.y + p.h - 1, p.w, 1);
      // small items on the shelf
      ctx.fillStyle = "#ccc";
      for (let i = 0; i < Math.floor(p.w / 8); i++) {
        ctx.fillRect(p.x + 2 + i * 8, p.y - 4, 4, 4);
      }
      break;
    }
    case "stack": {
      // Crates stacked
      ctx.fillStyle = "#5a4a2a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#7a5a32";
      ctx.fillRect(p.x, p.y, p.w, 2);
      ctx.fillStyle = "#3a2e15";
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.beginPath();
      ctx.moveTo(p.x + p.w / 2, p.y);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h);
      ctx.stroke();
      break;
    }
  }
}

function drawInteractZone(ctx: CanvasRenderingContext2D, ir: Interior, state: GameState) {
  if (!state.interiorInteractActive) {
    // Subtle marker only
    const t = performance.now() / 600;
    const a = 0.15 + Math.sin(t) * 0.05;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(ir.interact.x, ir.interact.y + ir.interact.h + 6, ir.interact.w, 2);
    return;
  }
  // Pulsing highlight + prompt
  const t = performance.now() / 200;
  const a = 0.5 + Math.sin(t) * 0.3;
  ctx.strokeStyle = ir.signColor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = a;
  ctx.strokeRect(ir.interact.x, ir.interact.y, ir.interact.w, ir.interact.h);
  ctx.globalAlpha = 1;
  // E prompt
  const px = ir.interact.x + ir.interact.w / 2;
  const py = ir.interact.y + ir.interact.h + 14;
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  const tw = ctx.measureText("E").width + 50;
  // measure label
  ctx.font = "bold 8px sans-serif";
  const w2 = ctx.measureText(ir.interact.label).width + 28;
  ctx.fillRect(px - w2 / 2, py - 6, w2, 12);
  ctx.strokeStyle = ir.signColor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(px - w2 / 2 + 0.5, py - 5.5, w2 - 1, 11);
  ctx.fillStyle = "#ffe080";
  ctx.fillText("E", px - w2 / 2 + 8, py);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText("  " + ir.interact.label, px - w2 / 2 + 8, py);
  ctx.textAlign = "center";
}

function drawExitDoor(ctx: CanvasRenderingContext2D, ir: Interior) {
  // Glow on the doormat tile
  const t = performance.now() / 400;
  const a = 0.25 + Math.sin(t) * 0.15;
  const grd = ctx.createRadialGradient(
    ir.exit.x + ir.exit.w / 2, ir.exit.y + ir.exit.h / 2,
    0,
    ir.exit.x + ir.exit.w / 2, ir.exit.y + ir.exit.h / 2,
    24,
  );
  grd.addColorStop(0, `rgba(120,255,120,${a})`);
  grd.addColorStop(1, "rgba(120,255,120,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(ir.exit.x - 12, ir.exit.y - 10, ir.exit.w + 24, ir.exit.h + 20);
}

function drawInteriorPlayer(ctx: CanvasRenderingContext2D, ir: Interior) {
  // Re-use a top-down style human (slightly larger than overworld)
  drawTopDownHuman(
    ctx,
    ir.px,
    ir.py,
    ir.pAngle,
    ir.pWalkPhase,
    "#3aaa50",   // shirt: green
    "#1a1a22",   // pants
    "#3a2410",   // hair
    true,
  );
}

function drawInteriorHuman(ctx: CanvasRenderingContext2D, n: InteriorNPC) {
  drawTopDownHuman(
    ctx,
    n.x,
    n.y,
    n.angle,
    n.walkPhase,
    n.shirtColor,
    n.pantsColor,
    n.hairColor,
    false,
    n.role,
  );
}

function drawTopDownHuman(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  phase: number,
  shirt: string,
  pants: string,
  hair: string,
  isPlayer: boolean,
  role?: InteriorRole,
) {
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 4, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const moving = Math.abs(Math.sin(phase * 4)) > 0.1;
  const swing = moving ? Math.sin(phase) * 1.5 : 0;
  const shirtDark = shadeHex(shirt, -25);
  const skin = "#d4a378";
  const skinDark = shadeHex(skin, -25);

  // Legs (drawn before torso)
  ctx.fillStyle = pants;
  ctx.beginPath();
  ctx.ellipse(-1, -2 + swing, 1.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-1, 2 - swing, 1.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shoes
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(-2.5, -2 + swing, 1.4, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-2.5, 2 - swing, 1.4, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso (oval)
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirtDark;
  ctx.beginPath();
  ctx.ellipse(-1, 1.2, 2, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 3.4, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Arms
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(0.6, -3.6 - swing * 0.3, 1.1, 1.8, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.6, 3.6 + swing * 0.3, 1.1, 1.8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Hands
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(2.2, -3.8 - swing * 0.2, 0.7, 0, Math.PI * 2);
  ctx.arc(2.2, 3.8 + swing * 0.2, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(2.2, 0, 2.6, 2.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // jaw shadow
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(2.2, 1.2, 1.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // ear
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(1.7, -1.7, 0.5, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(2.2, 0, 2.6, 2.9, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Hair / hat per role
  if (role === "doctor") {
    // White medic cap
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(2.2, -1.2, 2.2, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // red cross
    ctx.fillStyle = "#c83040";
    ctx.fillRect(1.8, -1.6, 0.8, 1.4);
    ctx.fillRect(1.4, -1.2, 1.6, 0.6);
  } else if (role === "cook") {
    // Tall white chef's hat
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(2.4, -2.4, 2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(0.6, -1.6, 3.6, 0.8);
  } else if (role === "guard") {
    // Sunglasses + black cap
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.ellipse(2.2, -1.4, 2.1, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.fillRect(2.8, -0.6, 1.6, 0.5);
  } else {
    // Hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(2.2, -1.4, 2.1, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeHex(hair, -25);
    ctx.beginPath();
    ctx.ellipse(1.6, -1.7, 1.1, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player highlight ring
  if (isPlayer) {
    ctx.strokeStyle = "rgba(255,220,40,0.85)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(0.5, 0, 5.6, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Player arrow (faces direction of movement) — drawn in screen space above head
  if (isPlayer) {
    ctx.save();
    ctx.translate(x, y - 11);
    ctx.fillStyle = "#3aff90";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-2, -3);
    ctx.lineTo(2, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
