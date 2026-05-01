import type { GameState, WeaponKind } from "@/game/types";
import { TILE } from "@/game/world";
import type { WorldData, ShopKind } from "@/game/world";
import { STORY_MISSIONS, ACT_INTROS } from "@/game/story";
import { GUN_SHOP_ITEMS, AMMU_SHOP_ITEMS } from "@/game/interior";

interface Props {
  state: GameState;
  world: WorldData;
}

const SHOP_PROMPTS: Record<ShopKind, string> = {
  hospital: "Enter Hospital — $50",
  gun_shop: "Browse weapons catalog",
  ammu: "Browse ammo & weapons",
  food: "Eat (free) — +25 HP",
  pay_n_spray: "Pay 'n' Spray — $100 (need car)",
  safehouse: "Save Spawn (free)",
};

export function HUD({ state, world }: Props) {
  const p = state.player;
  const hpPct = (p.hp / p.maxHp) * 100;
  const stamPct = Math.max(0, Math.min(1, p.stamina)) * 100;
  const stars = Array.from({ length: 6 }, (_, i) => i < state.wantedLevel);
  const hour = Math.floor((state.worldTime / 60) % 24);
  const min = Math.floor(state.worldTime % 60);
  const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;

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

      {/* Story campaign progress badge */}
      {state.story.enabled && !state.story.complete && (
        <div style={{
          marginBottom: 8,
          background: "rgba(0,0,0,0.65)",
          border: "1px solid rgba(232,184,32,0.4)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 11,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
        }}>
          <div style={{ color: "#e8b820", fontWeight: 700, marginBottom: 2 }}>
            BLOOD &amp; CHROME
          </div>
          <div style={{ color: "#aaaaaa" }}>
            {state.story.complete
              ? "✓ COMPLETE"
              : state.story.missionIdx < STORY_MISSIONS.length
              ? `${ACT_INTROS[STORY_MISSIONS[state.story.missionIdx]?.act ?? 1] ?? ""} • M${state.story.missionIdx + 1} / ${STORY_MISSIONS.length}`
              : "COMPLETE"}
          </div>
        </div>
      )}
      {state.story.complete && (
        <div style={{
          marginBottom: 8,
          background: "rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,215,0,0.6)",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 11,
          fontFamily: "monospace",
          letterSpacing: "0.12em",
          color: "#ffd700",
        }}>
          🏆 BLOOD &amp; CHROME — COMPLETE
        </div>
      )}

      {/* Active mission tracker */}
      {state.activeMission && !state.story.cutscene && (
        <div
          className="hud-mission"
          style={{ borderColor: state.activeMission.markerColor }}
        >
          <div
            className="hud-mission-tag"
            style={{ color: state.activeMission.markerColor }}
          >
            {state.activeMission.storyId ? "STORY MISSION" : "ACTIVE MISSION"}
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

      {/* Mini-map — player-centered radar */}
      {(() => {
        const MS = 200; // minimap pixel size
        const LR = 900; // world-pixel radius shown on the radar
        const msc = (MS / 2) / LR; // scale: world-px → minimap-px
        const mcx = MS / 2;
        const mcy = MS / 2;
        const wx2m = (wx: number) => (wx - p.x) * msc + mcx;
        const wy2m = (wy: number) => (wy - p.y) * msc + mcy;
        const inView = (wx: number, wy: number) => {
          const mx = wx2m(wx), my = wy2m(wy);
          return mx > -8 && mx < MS + 8 && my > -8 && my < MS + 8;
        };

        // Player direction arrow
        const pAngle = p.inVehicle ? p.inVehicle.angle : p.angle;
        const as = 7;
        const arrowPts = [
          [mcx + Math.cos(pAngle) * as, mcy + Math.sin(pAngle) * as],
          [mcx + Math.cos(pAngle + 2.4) * as * 0.6, mcy + Math.sin(pAngle + 2.4) * as * 0.6],
          [mcx + Math.cos(pAngle - 2.4) * as * 0.6, mcy + Math.sin(pAngle - 2.4) * as * 0.6],
        ].map(([x, y]) => `${x},${y}`).join(" ");

        // Active mission direction: clamp to edge of radar if outside view
        let missionEdge: { x: number; y: number; col: string } | null = null;
        const am = state.activeMission;
        if (am) {
          const mxr = wx2m(am.targetX), myr = wy2m(am.targetY);
          if (!inView(am.targetX, am.targetY)) {
            // Project to edge of radar circle
            const a = Math.atan2(myr - mcy, mxr - mcx);
            const edgeR = MS / 2 - 8;
            missionEdge = {
              x: mcx + Math.cos(a) * edgeR,
              y: mcy + Math.sin(a) * edgeR,
              col: am.markerColor,
            };
          }
        }

        return (
          <div className="hud-minimap">
            <svg width={MS} height={MS} viewBox={`0 0 ${MS} ${MS}`}
              style={{ display: "block", borderRadius: "50%", overflow: "hidden" }}>
              <defs>
                <clipPath id="radar-clip">
                  <circle cx={mcx} cy={mcy} r={MS / 2} />
                </clipPath>
              </defs>
              <g clipPath="url(#radar-clip)">
                {/* Background */}
                <rect width={MS} height={MS} fill="#0c1018" />

                {/* Road grid — horizontal roads */}
                {world.roadHorizontals.map((ry) => {
                  const worldY = (ry + 2) * TILE;
                  const my = wy2m(worldY);
                  if (my < -4 || my > MS + 4) return null;
                  return (
                    <line key={`rh${ry}`}
                      x1={0} x2={MS} y1={my} y2={my}
                      stroke="#2e3540" strokeWidth={4}
                    />
                  );
                })}

                {/* Road grid — vertical roads */}
                {world.roadVerticals.map((rx) => {
                  const worldX = (rx + 2) * TILE;
                  const mx = wx2m(worldX);
                  if (mx < -4 || mx > MS + 4) return null;
                  return (
                    <line key={`rv${rx}`}
                      x1={mx} x2={mx} y1={0} y2={MS}
                      stroke="#2e3540" strokeWidth={4}
                    />
                  );
                })}

                {/* Road lane center lines */}
                {world.roadHorizontals.map((ry) => {
                  const worldY = (ry + 2) * TILE;
                  const my = wy2m(worldY);
                  if (my < -4 || my > MS + 4) return null;
                  return (
                    <line key={`rhl${ry}`}
                      x1={0} x2={MS} y1={my} y2={my}
                      stroke="#3a4050" strokeWidth={1} strokeDasharray="5 6"
                    />
                  );
                })}
                {world.roadVerticals.map((rx) => {
                  const worldX = (rx + 2) * TILE;
                  const mx = wx2m(worldX);
                  if (mx < -4 || mx > MS + 4) return null;
                  return (
                    <line key={`rvl${rx}`}
                      x1={mx} x2={mx} y1={0} y2={MS}
                      stroke="#3a4050" strokeWidth={1} strokeDasharray="5 6"
                    />
                  );
                })}

                {/* Shops */}
                {world.shops.filter(s => inView(s.doorX, s.doorY)).map((s) => (
                  <rect key={`sh${s.id}`}
                    x={wx2m(s.doorX) - 3} y={wy2m(s.doorY) - 3}
                    width={6} height={6}
                    fill={s.color} stroke="#000" strokeWidth={0.8}
                  />
                ))}

                {/* Pickups */}
                {state.pickups.filter(pk => inView(pk.x, pk.y)).map((pk, i) => (
                  <circle key={i}
                    cx={wx2m(pk.x)} cy={wy2m(pk.y)} r={2.5}
                    fill="#ffd040"
                  />
                ))}

                {/* Police vehicles */}
                {state.vehicles.filter(v => v.kind === "police" && !v.driver?.isPlayer && inView(v.x, v.y)).map((v) => (
                  <circle key={v.id}
                    cx={wx2m(v.x)} cy={wy2m(v.y)} r={2.5}
                    fill="#4a90ff"
                  />
                ))}

                {/* Gang / hostile humans */}
                {state.humans.filter(h => (h.kind === "police" || h.kind === "gang") && !h.isPlayer && inView(h.x, h.y)).map((h) => (
                  <circle key={h.id}
                    cx={wx2m(h.x)} cy={wy2m(h.y)} r={2}
                    fill={h.kind === "police" ? "#4a90ff" : "#e84040"}
                  />
                ))}

                {/* Available mission markers */}
                {state.missions.filter(m => inView(m.targetX, m.targetY)).map((m) => (
                  <g key={m.id}>
                    <circle cx={wx2m(m.targetX)} cy={wy2m(m.targetY)} r={5}
                      fill={m.markerColor} opacity={0.35}
                    />
                    <circle cx={wx2m(m.targetX)} cy={wy2m(m.targetY)} r={2.5}
                      fill={m.markerColor}
                    />
                  </g>
                ))}

                {/* Active mission — line + pulsing ring */}
                {am && inView(am.targetX, am.targetY) && (
                  <g>
                    <line
                      x1={mcx} y1={mcy}
                      x2={wx2m(am.targetX)} y2={wy2m(am.targetY)}
                      stroke={am.markerColor} strokeWidth={0.8}
                      strokeDasharray="3 4" opacity={0.6}
                    />
                    <circle cx={wx2m(am.targetX)} cy={wy2m(am.targetY)} r={6}
                      fill="none" stroke={am.markerColor} strokeWidth={1.5}
                    />
                    <circle cx={wx2m(am.targetX)} cy={wy2m(am.targetY)} r={3}
                      fill={am.markerColor}
                    />
                  </g>
                )}

                {/* Mission off-screen edge indicator */}
                {missionEdge && (
                  <polygon
                    points={`${missionEdge.x},${missionEdge.y - 6} ${missionEdge.x - 4},${missionEdge.y + 3} ${missionEdge.x + 4},${missionEdge.y + 3}`}
                    fill={missionEdge.col}
                    transform={`rotate(${Math.atan2(missionEdge.y - mcy, missionEdge.x - mcx) * 180 / Math.PI + 90} ${missionEdge.x} ${missionEdge.y})`}
                  />
                )}

                {/* Player arrow */}
                <circle cx={mcx} cy={mcy} r={6} fill="rgba(58,255,144,0.18)" />
                <polygon points={arrowPts} fill="#3aff90" stroke="#fff" strokeWidth={0.6} />

                {/* Radar edge vignette */}
                <circle cx={mcx} cy={mcy} r={MS / 2 - 1}
                  fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth={6}
                />
              </g>

              {/* Compass — outside clip, top center */}
              <text x={mcx} y={10} textAnchor="middle"
                fill="#aab" fontSize={9} fontFamily="monospace" fontWeight="bold">N</text>
              <text x={MS - 6} y={mcy + 4} textAnchor="middle"
                fill="#778" fontSize={8} fontFamily="monospace">E</text>
              <text x={6} y={mcy + 4} textAnchor="middle"
                fill="#778" fontSize={8} fontFamily="monospace">W</text>
              <text x={mcx} y={MS - 2} textAnchor="middle"
                fill="#778" fontSize={8} fontFamily="monospace">S</text>

              {/* Outer ring border */}
              <circle cx={mcx} cy={mcy} r={MS / 2 - 1}
                fill="none" stroke="rgba(80,120,180,0.5)" strokeWidth={2}
              />
            </svg>
          </div>
        );
      })()}

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
        <span>Q weapon wheel</span>
        <span>Space/Click fire</span>
        <span>Shift sprint / handbrake</span>
        <span>P pause</span>
      </div>

      {/* Gun Shop Menu Overlay */}
      {state.gunShopMenu && state.interior && (() => {
        const menu = state.gunShopMenu!;
        const items = menu.shopKind === "gun_shop" ? GUN_SHOP_ITEMS : AMMU_SHOP_ITEMS;
        const shopName = menu.shopKind === "gun_shop" ? "AMMU-NATION" : "GUN STORE";
        const shopColor = menu.shopKind === "gun_shop" ? "#a8e0ff" : "#ff7a30";
        return (
          <div className="hud-gun-shop-overlay">
            <div className="gun-shop-panel" style={{ borderColor: shopColor }}>
              <div className="gun-shop-header" style={{ color: shopColor, borderBottomColor: shopColor }}>
                🏪 {shopName}
                <span className="gun-shop-wallet">💵 ${state.money}</span>
              </div>
              <div className="gun-shop-item-list">
                {items.map((item, idx) => {
                  const canAfford = state.money >= item.cost;
                  const alreadyOwn = item.givesGun && state.player.ownedGuns.includes(item.givesGun);
                  const isSelected = idx === menu.selectedIdx;
                  return (
                    <div
                      key={item.id}
                      className={`gun-shop-item ${isSelected ? "selected" : ""} ${!canAfford ? "unaffordable" : ""}`}
                      style={isSelected ? { borderColor: shopColor, backgroundColor: `${shopColor}22` } : {}}
                      onMouseEnter={() => { menu.selectedIdx = idx; }}
                      onClick={() => {
                        menu.selectedIdx = idx;
                        // Simulate pressing enter
                        state.input.enter = true;
                      }}
                    >
                      <span className="gun-shop-icon">{item.icon}</span>
                      <div className="gun-shop-item-info">
                        <div className="gun-shop-item-name">
                          {item.label}
                          {alreadyOwn && <span className="gun-shop-owned"> (owned)</span>}
                        </div>
                        <div className="gun-shop-item-desc">{item.desc}</div>
                      </div>
                      <div className={`gun-shop-item-cost ${!canAfford ? "cant-afford" : ""}`}>
                        ${item.cost}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="gun-shop-hint">
                <kbd>W/S</kbd> navigate · <kbd>E</kbd> buy · <kbd>A</kbd> close
              </div>
            </div>
          </div>
        );
      })()}

      {/* Weapon Wheel Overlay — only shows fist + owned guns */}
      {state.input.weaponWheelOpen && (
        <div className="hud-weapon-wheel" onClick={() => (state.input.weaponWheelOpen = false)}>
          <div className="wheel-container" onClick={(e) => e.stopPropagation()}>
            <div className="wheel-center">
              <div className="wheel-center-label">{state.player.weapon.toUpperCase()}</div>
              <div className="wheel-center-ammo">{state.player.weapon !== "fist" ? `${state.player.ammo} rds` : ""}</div>
            </div>
            {(
              [
                { kind: "fist" as WeaponKind, icon: "👊" },
                { kind: "pistol" as WeaponKind, icon: "🔫" },
                { kind: "smg" as WeaponKind, icon: "📟" },
                { kind: "shotgun" as WeaponKind, icon: "💥" },
                { kind: "rifle" as WeaponKind, icon: "🏹" },
                { kind: "sniper" as WeaponKind, icon: "🔭" },
                { kind: "rpg" as WeaponKind, icon: "🚀" },
                { kind: "flamethrower" as WeaponKind, icon: "🔥" },
              ] as { kind: WeaponKind; icon: string }[]
            )
            .filter(w => w.kind === "fist" || state.player.ownedGuns.includes(w.kind))
            .map((w, i, arr) => {
              const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
              const radius = arr.length <= 2 ? 100 : 180;
              const x = 250 + Math.cos(angle) * radius;
              const y = 250 + Math.sin(angle) * radius;
              const canUse = w.kind === "fist" || state.player.ammo > 0;
              return (
                <div
                  key={w.kind}
                  className={`wheel-item ${state.player.weapon === w.kind ? "active" : ""} ${!canUse ? "empty" : ""}`}
                  style={{ left: x, top: y }}
                  onClick={() => {
                    if (canUse || w.kind === "fist") {
                      state.player.weapon = w.kind;
                      state.input.weaponWheelOpen = false;
                    }
                  }}
                >
                  <div className="wheel-item-icon">{w.icon}</div>
                  <div className="wheel-item-label">{w.kind}</div>
                  {!canUse && w.kind !== "fist" && (
                    <div className="wheel-item-empty">EMPTY</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
