export type Vec2 = { x: number; y: number };

export type VehicleKind =
  | "sedan"
  | "muscle"
  | "truck"
  | "police"
  | "sports"
  | "taxi";

export type HumanKind = "player" | "pedestrian" | "gang" | "police";

export type WeatherKind = "clear" | "rain" | "storm" | "fog" | "snow" | "wind";

export type TimeOfDay = "day" | "dusk" | "night";

export type WeaponKind = "fist" | "pistol" | "smg" | "shotgun" | "rifle" | "sniper" | "rpg" | "flamethrower";

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  steer: number;
  throttle: number;
  brake: number;
  handbrake: number;
  maxSpeed: number;
  accel: number;
  handling: number;
  mass: number;
  hp: number;
  maxHp: number;
  width: number;
  length: number;
  color: string;
  driver: Human | null;
  // visuals
  damage: number; // 0..1
  onFire: boolean;
  fireTimer: number;
  // ai cooldown
  aiTimer: number;
  aiTargetAngle: number;
  aiThrottle: number;
  // current waypoint along the road network
  aiTargetX: number;
  aiTargetY: number;
  // last visited intersection node index (-1 if unknown)
  aiLastNode: number;
  // current heading direction at last node: 0=N, 1=E, 2=S, 3=W
  aiHeading: number;
  // honk timer (HUD/audio cue)
  honkTimer: number;
  // turn signal: -1 left, 0 none, 1 right
  signal: number;
  // PIT cooldown for police
  pitTimer: number;
  // Time spent essentially immobile while throttle is requested — used by AI to
  // detect being wedged on a wall/prop and trigger a reverse-out recovery.
  stuckTimer: number;
  // Positive = currently in a reverse-out recovery; counts down to zero.
  reverseTimer: number;
  // Time spent waiting for crossing traffic — used to break deadlocks.
  yieldingTimer: number;
  // Time spent being blocked by other cars/objects while wanting to move.
  blockedTimer: number;
  // behavior
  drivingStyle: "aggressive" | "cautious" | "normal";
  // visual variation (0..1) for rust, spoilers, etc.
  visualVariant: number;
}

export interface Human {
  id: number;
  kind: HumanKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  inVehicle: Vehicle | null;
  // ai
  aiState:
  | "idle"
  | "wander"
  | "flee"
  | "chase"
  | "attack"
  | "patrol"
  | "fleeOnFoot"
  | "panic"
  | "downed"
  | "witness"
  | "cover"
  | "investigate"
  | "retreat"
  | "roadblock"
  | "surrender"
  | "fight";
  aiTimer: number;
  aiTargetX: number;
  aiTargetY: number;
  // optional path of waypoints (sidewalk navigation)
  aiPath: { x: number; y: number }[];
  // strafe phase for combat
  strafeDir: number;
  // panic source - direction to flee from
  panicFromX: number;
  panicFromY: number;
  // last witnessed crime time (for witness behavior)
  witnessTimer: number;
  // squad role: 0=suppressor, 1=flanker, 2=cutoff, 3=reserve
  squadRole: number;
  // gang turf — anchor position; gangs only aggro near home
  homeX: number;
  homeY: number;
  walkPhase: number;
  shirtColor: string;
  pantsColor: string;
  hairColor: string;
  weapon: WeaponKind;
  ammo: number;
  fireTimer: number;
  // Melee swing animation: 0..PUNCH_DURATION; sprite extends the lead arm
  // forward while > 0. Drives both player and AI fist attacks.
  punchTimer: number;
  // tag
  isPlayer: boolean;
  busted: boolean;
  // death animation progress 0..1 (0 = standing, 1 = fully collapsed)
  deathAnim: number;
  // Brief invulnerability after a vehicle hit (player only — prevents one
  // frame of car-overlap from instantly draining all HP).
  hitCooldown: number;
  // Sprint stamina (player only). 1 = full, 0 = exhausted (must regen before
  // sprinting again). Decreases while sprinting, regenerates while walking.
  stamina: number;
  staminaLocked: boolean;
  // New AI / Social properties
  groupId?: number;
  behavior: "normal" | "jogger" | "slow";
  chatTimer: number;
  bravery: number; // 0..1
  witnessCrimePos?: { x: number; y: number };
}

export type AnimalKind = "dog" | "cat" | "pigeon" | "deer" | "bear" | "wolf" | "cow" | "boar";

export interface Animal {
  id: number;
  kind: AnimalKind;
  breed: number; // visual variation
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  hp: number;
  state: "wander" | "flee" | "downed" | "sit" | "sniff" | "chase" | "bark" | "attack" | "follow" | "stalk" | "graze";
  // followTimer: how long dog has been peacefully near player (seconds)
  followTimer?: number;
  stateTimer: number;
  walkPhase: number;
  furColor: string;
  // pigeons hop and occasionally take flight
  flyZ: number; // altitude offset (visual)
  flyTimer: number;
  panicFromX: number;
  panicFromY: number;
  targetId?: number; // for chasing other animals
  // home / wander anchor
  homeX: number;
  homeY: number;
}

export interface BirdFlock {
  id: number;
  // center position (above the ground)
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number; // # of birds
  altitude: number; // 0..1 (visual scale + shadow distance)
  life: number;
  flapPhase: number;
}

export type PropKind =
  | "tree"
  | "pine"
  | "palm"
  | "oak"
  | "bush"
  | "flowers"
  | "tallgrass"
  | "cactus"
  | "hydrant"
  | "mailbox"
  | "bench"
  | "trashcan"
  | "lamp"
  | "fountain";

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  variant: number;
  // collision radius (0 = decorative, no collision)
  solidRadius: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  owner: number; // human id
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: "smoke" | "spark" | "fire" | "blood" | "debris" | "rain" | "leaf" | "muzzle" | "dust" | "snow" | "feather";
  color: string;
  rotation: number;
  rotationSpeed: number;
}

export interface SkidMark {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export interface Decal {
  x: number;
  y: number;
  kind: "blood" | "scorch" | "oil";
  size: number;
  alpha: number;
  rotation: number;
}

export interface Pickup {
  x: number;
  y: number;
  kind: "health" | "ammo" | "armor" | "wantedClear" | "speed";
  bob: number;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  reward: number;
  scoreReward: number;
  targetX: number;
  targetY: number;
  state: "available" | "active" | "complete" | "failed";
  type: "reach" | "destroy" | "collect" | "escape" | "eliminate";
  // For destroy/eliminate: id of target entity to chase
  targetId?: number;
  // For escape: countdown remaining (seconds)
  timeLimit?: number;
  remainingTime?: number;
  // Visual
  markerColor: string;
  icon: string;
  // Story campaign tag
  storyId?: string;
}

// ---- STORY / CUTSCENE SYSTEM ----
export interface DialogueLine {
  speaker: string;
  role: string;
  color: string;
  text: string;
  side: "left" | "right";
  isNarration?: boolean;
}

export interface StoryCutscene {
  lines: DialogueLine[];
  index: number;
  phase: "intro" | "outro";
  missionIdx: number;
  // What to do when all lines are shown:
  //   "start_mission" — activate the story mission normally
  //   "advance_story" — mark complete, start timer for next mission
  //   "end_game"     — show story complete screen
  onComplete: "start_mission" | "advance_story" | "end_game";
}

export interface StoryProgress {
  // Whether the story campaign is active
  enabled: boolean;
  // Index into STORY_MISSIONS (0-20). -1 = not started
  missionIdx: number;
  // Whether the current mission's marker is already on the map
  markerSpawned: boolean;
  // Countdown before placing the next mission marker (after outro)
  nextMissionTimer: number;
  // Active dialogue/cutscene; null when no cutscene
  cutscene: StoryCutscene | null;
  // True after final mission complete
  complete: boolean;
  // Act banner to show (set briefly when act changes)
  actBanner: string;
  actBannerTimer: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  shake: number;
}

export interface Input {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  enter: boolean;
  fire: boolean;
  handbrake: boolean;
  // Shift is reused for two purposes depending on context:
  //   - In a vehicle: handbrake (`handbrake`).
  //   - On foot: sprint (`sprint`).
  // Both flags are set/cleared together by the input layer so the player can
  // hold Shift universally; the player-update code picks whichever is
  // appropriate for the current state.
  sprint: boolean;
  // mouse
  mouseX: number;
  mouseY: number;
  mouseDown: boolean;
  // Set each tick by updateShops when player is standing at a shop door.
  nearbyShopId: number | null;
  weaponWheelOpen: boolean;
  // Set true for one frame when Space or E is pressed — consumed by story cutscene system
  dialogueAdvance: boolean;
}

export interface GameState {
  player: Human;
  vehicles: Vehicle[];
  humans: Human[];
  animals: Animal[];
  birdFlocks: BirdFlock[];
  props: Prop[];
  bullets: Bullet[];
  particles: Particle[];
  skidMarks: SkidMark[];
  decals: Decal[];
  pickups: Pickup[];
  // global wind direction (radians) and strength
  windAngle: number;
  windStrength: number;
  camera: Camera;
  input: Input;
  weather: WeatherKind;
  timeOfDay: TimeOfDay;
  worldTime: number; // seconds
  wantedLevel: number; // 0..6
  wantedDecayTimer: number;
  score: number;
  money: number;
  combo: number;
  comboTimer: number;
  paused: boolean;
  mapWidth: number;
  mapHeight: number;
  mapSeed: number;
  // audio music state
  musicState: "calm" | "chase" | "combat" | "radio";
  // notifications
  notifications: { text: string; life: number; color: string }[];
  // damage flash
  damageFlash: number;
  // explosions for music
  combatTimer: number;
  // post-bust / post-wasted full-screen overlay
  endScreen: { kind: "busted" | "wasted"; timer: number; dyingTimer: number } | null;
  // Shop interior overlay (shown briefly after entering a shop)
  shopOverlay: {
    shopId: number;
    timer: number; // counts down to 0
    duration: number; // total
    message: string;
  } | null;
  // Player respawn point — updated when entering a safehouse
  spawnPoint: { x: number; y: number };
  // ---- INTERIOR (shop) MODE ----
  // When set, the world is paused and the interior scene is rendered/ticked.
  interior: import("./interior").Interior | null;
  // Where to drop the player after exiting the interior (just outside the door).
  interiorReturnX: number;
  interiorReturnY: number;
  // True when player stands in the shop's interaction zone (HUD prompt).
  interiorInteractActive: boolean;
  // ---- MISSIONS ----
  // Pool of missions waiting on the map (player walks over icon to start).
  missions: Mission[];
  // Mission currently being run.
  activeMission: Mission | null;
  // Lifetime counter for stats / radio chatter.
  missionsCompleted: number;
  // Cooldown before next mission spawns once map is empty.
  missionSpawnTimer: number;
  // ---- STORY CAMPAIGN ----
  story: StoryProgress;
  // ---- TRAFFIC SIGNALS ----
  // City-wide synchronized signal. `trafficPhase` cycles 0 → 1 every
  // TRAFFIC_CYCLE seconds (with a brief yellow window at end of each phase):
  //   phase 0  = N-S green  (cars on vertical roads go, horizontal stops)
  //   phase 1  = E-W green  (cars on horizontal roads go, vertical stops)
  trafficPhase: 0 | 1;
  // Time spent in current phase (resets on toggle).
  trafficPhaseTimer: number;
  // Police search logic
  lastKnownPlayerPos: { x: number; y: number } | null;
  policeSearchTimer: number;
}
