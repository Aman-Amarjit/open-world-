import type { GameState } from "@/game/types";
import type { WorldData, ShopKind } from "@/game/world";

interface Props {
  state: GameState;
  world: WorldData;
}

const SHOP_PROMPTS: Record<ShopKind, string> = {
  hospital:    "Enter Hospital — $50",
  gun_shop:    "Buy Pistol Ammo — $100",
  ammu:        "Buy SMG — $200",
  food:        "Eat (free) — +25 HP",
  pay_n_spray: "Pay 'n' Spray — $100 (need car)",
  safehouse:   "Save Spawn (free)",
};

export function HUD({ state, world }: Props) {
  const p = state.player;
  const hpPct = (p.hp / p.maxHp) * 100;
  const stamPct = Math.max(0, Math.min(1, p.stamina)) * 100;
  const stars = Array.from({ length: 6 }, (_, i) => i < state.wantedLevel);
  const hour = Math.floor((state.worldTime / 60) % 24);
  const min = Math.floor(state.worldTime % 60);
  const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;

  // Mini-map
  const mapSize = 160;
  const worldScale = mapSize / state.mapWidth;

  return (
    <div className="hud">
      {/* Top bar */}
      <div className="hud-top">
        <div className="hud-card">
          <div className="hud-label">SCORE</div>
          <div className="hud-value" data-testid="hud-score">
            {Math.floor(state.score).toLocaleString()}
          </div>
        </div>
        <div className="hud-card">
          <div className="hud-label">CASH</div>
          <div className="hud-value money" data-testid="hud-money">
            ${Math.floor(state.money).toLocaleString()}
          </div>
        </div>
        <div className="hud-card">
          <div className="hud-label">TIME</div>
          <div className="hud-value">{timeStr}</div>
        </div>
        <div className="hud-card">
          <div className="hud-label">WEATHER</div>
          <div className="hud-value">{state.weather.toUpperCase()}</div>
        </div>
      </div>

      {/* Wanted stars */}
      <div className="hud-wanted">
        {stars.map((on, i) => (
          <span key={i} className={`star ${on ? "on" : ""}`}>
            ★
          </span>
        ))}
      </div>

      {/* Combo */}
      {state.combo > 1 && (
        <div className="hud-combo">x{state.combo} COMBO</div>
      )}

      {/* Active mission tracker */}
      {state.activeMission && (
        <div
          className="hud-mission"
          style={{ borderColor: state.activeMission.markerColor }}
        >
          <div
            className="hud-mission-tag"
            style={{ color: state.activeMission.markerColor }}
          >
            ACTIVE MISSION
          </div>
          <div className="hud-mission-name">{state.activeMission.name}</div>
          <div className="hud-mission-desc">{state.activeMission.description}</div>
          <div className="hud-mission-meta">
            <span className="hud-mission-reward">
              ${state.activeMission.reward}
            </span>
            {state.activeMission.type === "escape" &&
              state.activeMission.remainingTime !== undefined && (
                <span className="hud-mission-timer">
                  {Math.max(0, Math.ceil(state.activeMission.remainingTime))}s
                </span>
              )}
            <span className="hud-mission-dist">
              {Math.floor(
                Math.hypot(
                  state.activeMission.targetX - p.x,
                  state.activeMission.targetY - p.y,
                ) / 10,
              )}
              m
            </span>
          </div>
        </div>
      )}

      {/* Available mission marker hint */}
      {!state.activeMission && state.missions.length > 0 && (
        <div
          className="hud-mission available"
          style={{ borderColor: state.missions[0]!.markerColor }}
        >
          <div
            className="hud-mission-tag"
            style={{ color: state.missions[0]!.markerColor }}
          >
            JOB AVAILABLE
          </div>
          <div className="hud-mission-name">{state.missions[0]!.name}</div>
          <div className="hud-mission-desc">{state.missions[0]!.description}</div>
          <div className="hud-mission-meta">
            <span className="hud-mission-reward">
              ${state.missions[0]!.reward}
            </span>
            <span className="hud-mission-dist">
              {Math.floor(
                Math.hypot(
                  state.missions[0]!.targetX - p.x,
                  state.missions[0]!.targetY - p.y,
                ) / 10,
              )}
              m
            </span>
          </div>
        </div>
      )}

      {/* Bottom-left HP and ammo */}
      <div className="hud-bottom-left">
        <div className="hp-card">
          <div className="hud-label">HEALTH</div>
          <div className="hp-bar">
            <div
              className="hp-fill"
              style={{ width: `${hpPct}%` }}
              data-testid="hp-fill"
            />
          </div>
          <div className="hud-value small">
            {Math.floor(p.hp)} / {p.maxHp}
          </div>
          {!p.inVehicle && (
            <>
              <div className="hud-label" style={{ marginTop: 6 }}>
                STAMINA {p.staminaLocked ? "(WINDED)" : ""}
              </div>
              <div className="hp-bar small">
                <div
                  className="hp-fill"
                  style={{
                    width: `${stamPct}%`,
                    background: p.staminaLocked
                      ? "linear-gradient(90deg,#a04040,#cf6868)"
                      : "linear-gradient(90deg,#3aa0ff,#7ad0ff)",
                  }}
                  data-testid="stamina-fill"
                />
              </div>
            </>
          )}
        </div>
        <div className="weapon-card">
          <div className="hud-label">{p.weapon.toUpperCase()}</div>
          <div className="hud-value small ammo">{p.ammo} rounds</div>
        </div>
        {p.inVehicle && (
          <div className="vehicle-card">
            <div className="hud-label">VEHICLE</div>
            <div className="hud-value small">{p.inVehicle.kind.toUpperCase()}</div>
            <div className="hp-bar small">
              <div
                className="hp-fill veh"
                style={{ width: `${(p.inVehicle.hp / p.inVehicle.maxHp) * 100}%` }}
              />
            </div>
            <div className="hud-value tiny">
              {Math.round(Math.hypot(p.inVehicle.vx, p.inVehicle.vy) * 0.6)} mph
            </div>
          </div>
        )}
      </div>

      {/* Mini-map */}
      <div className="hud-minimap">
        <svg width={mapSize} height={mapSize} viewBox={`0 0 ${mapSize} ${mapSize}`}>
          <rect width={mapSize} height={mapSize} fill="#0d1015" />
          {/* river */}
          <rect
            x={0}
            y={39 * 64 * worldScale}
            width={mapSize}
            height={5 * 64 * worldScale}
            fill="#1f3d6a"
          />
          {/* roads */}
          {Array.from({ length: 8 }, (_, i) => i * 10 + 4).map((t) => (
            <g key={`r${t}`}>
              <line
                x1={0}
                x2={mapSize}
                y1={(t + 2) * 64 * worldScale}
                y2={(t + 2) * 64 * worldScale}
                stroke="#3a3a3a"
                strokeWidth={2}
              />
              <line
                y1={0}
                y2={mapSize}
                x1={(t + 2) * 64 * worldScale}
                x2={(t + 2) * 64 * worldScale}
                stroke="#3a3a3a"
                strokeWidth={2}
              />
            </g>
          ))}
          {/* vehicles */}
          {state.vehicles.map((v) => (
            <circle
              key={v.id}
              cx={v.x * worldScale}
              cy={v.y * worldScale}
              r={1.5}
              fill={v.kind === "police" ? "#4a90ff" : "#888"}
            />
          ))}
          {/* hostile humans */}
          {state.humans
            .filter((h) => h.kind === "police" || h.kind === "gang")
            .map((h) => (
              <circle
                key={h.id}
                cx={h.x * worldScale}
                cy={h.y * worldScale}
                r={1.2}
                fill={h.kind === "police" ? "#4a90ff" : "#e84040"}
              />
            ))}
          {/* pickups */}
          {state.pickups.map((p, i) => (
            <rect
              key={i}
              x={p.x * worldScale - 1}
              y={p.y * worldScale - 1}
              width={2}
              height={2}
              fill="#ffd040"
            />
          ))}
          {/* shops */}
          {world.shops.map((s) => (
            <rect
              key={`shop${s.id}`}
              x={s.doorX * worldScale - 2}
              y={s.doorY * worldScale - 2}
              width={4}
              height={4}
              fill={s.color}
              stroke="#000"
              strokeWidth={0.5}
            />
          ))}
          {/* mission markers */}
          {state.missions.map((m) => (
            <g key={m.id}>
              <circle
                cx={m.targetX * worldScale}
                cy={m.targetY * worldScale}
                r={4}
                fill={m.markerColor}
                opacity={0.4}
              />
              <circle
                cx={m.targetX * worldScale}
                cy={m.targetY * worldScale}
                r={2}
                fill={m.markerColor}
              />
            </g>
          ))}
          {state.activeMission && (
            <g>
              <circle
                cx={state.activeMission.targetX * worldScale}
                cy={state.activeMission.targetY * worldScale}
                r={5}
                fill="none"
                stroke={state.activeMission.markerColor}
                strokeWidth={1.2}
              />
              <circle
                cx={state.activeMission.targetX * worldScale}
                cy={state.activeMission.targetY * worldScale}
                r={2.5}
                fill={state.activeMission.markerColor}
              />
              <line
                x1={p.x * worldScale}
                y1={p.y * worldScale}
                x2={state.activeMission.targetX * worldScale}
                y2={state.activeMission.targetY * worldScale}
                stroke={state.activeMission.markerColor}
                strokeWidth={0.8}
                strokeDasharray="2 3"
                opacity={0.7}
              />
            </g>
          )}
          {/* player */}
          <circle
            cx={p.x * worldScale}
            cy={p.y * worldScale}
            r={2.5}
            fill="#3aff90"
          />
          <circle
            cx={p.x * worldScale}
            cy={p.y * worldScale}
            r={4}
            fill="none"
            stroke="#3aff90"
            opacity={0.5}
          />
          {/* viewport box */}
          <rect
            x={(state.camera.x - window.innerWidth / 2 / state.camera.zoom) * worldScale}
            y={(state.camera.y - window.innerHeight / 2 / state.camera.zoom) * worldScale}
            width={(window.innerWidth / state.camera.zoom) * worldScale}
            height={(window.innerHeight / state.camera.zoom) * worldScale}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
          />
        </svg>
      </div>

      {/* Notifications */}
      <div className="hud-notifs">
        {state.notifications.map((n, i) => (
          <div
            key={i}
            className="notif"
            style={{
              color: n.color,
              opacity: Math.min(1, n.life),
            }}
          >
            {n.text}
          </div>
        ))}
      </div>

      {/* Shop entry prompt (overworld only) */}
      {!state.interior && state.input.nearbyShopId !== null && !state.shopOverlay && (() => {
        const s = world.shops.find((sh) => sh.id === state.input.nearbyShopId);
        if (!s) return null;
        return (
          <div className="hud-shop-prompt" style={{ borderColor: s.color }}>
            <div className="hud-shop-name" style={{ color: s.color }}>
              {s.name}
            </div>
            <div className="hud-shop-action">{SHOP_PROMPTS[s.kind]}</div>
            <div className="hud-shop-key">
              Press <kbd>E</kbd> to enter
            </div>
          </div>
        );
      })()}

      {/* Interior banner — show shop name + small exit hint */}
      {state.interior && (
        <div className="hud-interior-banner" style={{ borderColor: state.interior.signColor }}>
          <div className="hud-interior-name" style={{ color: state.interior.signColor }}>
            {state.interior.shopName}
          </div>
          <div className="hud-interior-hint">
            <kbd>WASD</kbd> walk · <kbd>E</kbd> at counter to use · walk to door to exit
          </div>
        </div>
      )}

      {/* Shop interior overlay (brief in-shop scene after entering) */}
      {state.shopOverlay && (() => {
        const s = world.shops.find((sh) => sh.id === state.shopOverlay!.shopId);
        if (!s) return null;
        const t = state.shopOverlay.timer / state.shopOverlay.duration;
        const alpha = Math.min(1, t * 4) * Math.min(1, (1 - t) * 4 + t);
        return (
          <div className="hud-shop-overlay" style={{ opacity: alpha }}>
            <div className="hud-shop-interior" style={{ borderColor: s.color }}>
              <div
                className="hud-shop-interior-title"
                style={{ color: s.color, textShadow: `0 0 12px ${s.color}` }}
              >
                {s.name}
              </div>
              <div className="hud-shop-interior-msg">
                {state.shopOverlay.message.split("\n").slice(1).join(" ")}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Controls hint */}
      <div className="hud-controls">
        <span>WASD move</span>
        <span>E enter/exit</span>
        <span>Space/Click fire</span>
        <span>Shift sprint / handbrake</span>
        <span>P pause</span>
      </div>
    </div>
  );
}
