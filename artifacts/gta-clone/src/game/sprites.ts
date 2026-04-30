// Sprite drawing - all pure Canvas paths, GTA1 style
import type { Vehicle, Human } from "./types";
import { shadeHex } from "./utils";

export function drawCarShadow(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  shadowOffsetX: number,
  shadowOffsetY: number,
) {
  ctx.save();
  ctx.translate(v.x + shadowOffsetX, v.y + shadowOffsetY);
  ctx.rotate(v.angle);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 0, v.length / 2 + 1, v.width / 2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  v: Vehicle,
  isNight = false,
  flashOnFire = false,
) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);

  const L = v.length;
  const W = v.width;
  const halfL = L / 2;
  const halfW = W / 2;

  const bodyColor = v.kind === "police" ? "#1a1a1a" : v.color;
  const dark = shadeHex(bodyColor, -30);
  const light = shadeHex(bodyColor, 22);

  // Body hull - bezier asymmetric
  ctx.beginPath();
  ctx.moveTo(-halfL, -halfW + 1);
  ctx.bezierCurveTo(
    -halfL - 2,
    -halfW + 1,
    -halfL - 2,
    halfW - 1,
    -halfL + 1,
    halfW,
  ); // rear left curve
  ctx.lineTo(halfL - 4, halfW);
  ctx.bezierCurveTo(halfL, halfW, halfL + 1, halfW - 2, halfL + 1, halfW - 4); // front right
  ctx.lineTo(halfL + 1, -halfW + 4);
  ctx.bezierCurveTo(
    halfL + 1,
    -halfW + 2,
    halfL,
    -halfW,
    halfL - 4,
    -halfW,
  );
  ctx.lineTo(-halfL + 1, -halfW);
  ctx.closePath();
  // Paint with a vertical body gradient for that "metallic" shaded look
  // (sky-reflection top edge → solid body → shadowed bottom edge)
  const bodyGrad = ctx.createLinearGradient(0, -halfW, 0, halfW);
  bodyGrad.addColorStop(0, light);
  bodyGrad.addColorStop(0.35, bodyColor);
  bodyGrad.addColorStop(0.7, bodyColor);
  bodyGrad.addColorStop(1, shadeHex(bodyColor, -22));
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Front bumper bar — slightly darker strip across the very front
  ctx.fillStyle = shadeHex(bodyColor, -18);
  ctx.fillRect(halfL - 1, -halfW + 2, 1.6, W - 4);

  // Front grille — vertical slats between headlights
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(halfL - 3, -halfW + 4, 2, W - 8);
  ctx.fillStyle = "rgba(180,180,180,0.6)";
  for (let gy = -halfW + 4.5; gy < halfW - 4; gy += 1.2) {
    ctx.fillRect(halfL - 2.8, gy, 1.6, 0.35);
  }

  // Rocker panel — dark thin strip along each side (skirt under the doors)
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(-halfL + 4, -halfW + 0.2, L - 8, 0.6);
  ctx.fillRect(-halfL + 4, halfW - 0.8, L - 8, 0.6);

  // Police two-tone
  if (v.kind === "police") {
    ctx.fillStyle = "#f0f0f0";
    ctx.beginPath();
    ctx.moveTo(-halfL + 1, -halfW + 1);
    ctx.lineTo(halfL - 4, -halfW + 1);
    ctx.lineTo(halfL - 4, 0);
    ctx.lineTo(-halfL + 1, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Roof panel - slightly inset, darker, with its own subtle gradient
  const roofGrad = ctx.createLinearGradient(0, -halfW + 2, 0, halfW - 2);
  roofGrad.addColorStop(0, shadeHex(bodyColor, -8));
  roofGrad.addColorStop(0.5, shadeHex(bodyColor, -22));
  roofGrad.addColorStop(1, shadeHex(bodyColor, -32));
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(-halfL + 4, -halfW + 2);
  ctx.lineTo(halfL - 8, -halfW + 2);
  ctx.lineTo(halfL - 8, halfW - 2);
  ctx.lineTo(-halfL + 4, halfW - 2);
  ctx.closePath();
  ctx.fill();
  // Roof spec sheen — thin bright streak along the top edge
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-halfL + 5, -halfW + 2.4, L - 13, 0.5);

  // Windshield (front) - tinted blue with reflection sheen
  const wsGrad = ctx.createLinearGradient(halfL - 8, 0, halfL - 4, 0);
  wsGrad.addColorStop(0, "rgba(120,180,230,0.65)");
  wsGrad.addColorStop(1, "rgba(180,220,250,0.55)");
  ctx.fillStyle = wsGrad;
  ctx.beginPath();
  ctx.moveTo(halfL - 8, -halfW + 2);
  ctx.lineTo(halfL - 4, -halfW + 3);
  ctx.lineTo(halfL - 4, halfW - 3);
  ctx.lineTo(halfL - 8, halfW - 2);
  ctx.closePath();
  ctx.fill();
  // Windshield reflection diagonal streak
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(halfL - 7, -halfW + 2.5);
  ctx.lineTo(halfL - 5.5, -halfW + 2.8);
  ctx.lineTo(halfL - 6.5, halfW - 2.5);
  ctx.lineTo(halfL - 7.5, halfW - 2.8);
  ctx.closePath();
  ctx.fill();

  // Rear window - smaller, also tinted
  ctx.fillStyle = "rgba(110,170,210,0.5)";
  ctx.beginPath();
  ctx.moveTo(-halfL + 4, -halfW + 2);
  ctx.lineTo(-halfL + 2, -halfW + 3);
  ctx.lineTo(-halfL + 2, halfW - 3);
  ctx.lineTo(-halfL + 4, halfW - 2);
  ctx.closePath();
  ctx.fill();
  // Rear window faint sheen
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(-halfL + 3, -halfW + 2.6, 1, W - 5);

  // Door seam line
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -halfW + 1);
  ctx.lineTo(0, halfW - 1);
  ctx.stroke();

  // Hood crease — thin specular highlight along the top of the front
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(halfL - 8, -halfW + 3);
  ctx.lineTo(halfL - 4, -halfW + 4);
  ctx.moveTo(halfL - 8, halfW - 3);
  ctx.lineTo(halfL - 4, halfW - 4);
  ctx.stroke();
  // Center body highlight along roof seam
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-halfL + 5, -halfW + 1.5);
  ctx.lineTo(halfL - 6, -halfW + 1.5);
  ctx.stroke();

  // Side mirrors — small chrome rectangles at the front edge
  ctx.fillStyle = shadeHex(bodyColor, -25);
  ctx.fillRect(halfL - 9, -halfW - 1.2, 1.6, 1.2);
  ctx.fillRect(halfL - 9, halfW, 1.6, 1.2);
  ctx.fillStyle = "rgba(220,230,240,0.7)";
  ctx.fillRect(halfL - 8.8, -halfW - 0.9, 1.0, 0.6);
  ctx.fillRect(halfL - 8.8, halfW + 0.3, 1.0, 0.6);

  // Wheels - black tire with chrome hub + spokes
  const wheelOffsets: [number, number][] = [
    [-halfL + 4, -halfW - 0.5],
    [halfL - 5, -halfW - 0.5],
    [-halfL + 4, halfW + 0.5],
    [halfL - 5, halfW + 0.5],
  ];
  for (const [wx, wy] of wheelOffsets) {
    // Tire
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.ellipse(wx, wy, 3, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sidewall highlight
    ctx.strokeStyle = "rgba(60,60,60,0.7)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.ellipse(wx, wy, 2.6, 1.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Hubcap (chrome)
    ctx.fillStyle = "#9aa0aa";
    ctx.beginPath();
    ctx.ellipse(wx, wy, 1.4, 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hub center
    ctx.fillStyle = "#3a3a3e";
    ctx.beginPath();
    ctx.ellipse(wx, wy, 0.55, 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Spokes (cross)
    ctx.strokeStyle = "rgba(40,40,44,0.85)";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(wx - 1.3, wy);
    ctx.lineTo(wx + 1.3, wy);
    ctx.moveTo(wx, wy - 0.75);
    ctx.lineTo(wx, wy + 0.75);
    ctx.stroke();
  }

  // Exhaust tip — chrome circle on the rear right
  ctx.fillStyle = "#5a5a5e";
  ctx.beginPath();
  ctx.ellipse(-halfL - 0.5, halfW - 4, 0.6, 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.ellipse(-halfL - 0.4, halfW - 4, 0.35, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Headlights (front) — brighter at night, with a hot core
  if (isNight) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#fff8d0";
    ctx.beginPath();
    ctx.ellipse(halfL, -halfW + 3, 1.8, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(halfL, halfW - 3, 1.8, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = "#fff7c0";
    ctx.beginPath();
    ctx.ellipse(halfL, -halfW + 3, 1.2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(halfL, halfW - 3, 1.2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Taillights — always glow at night (running lights)
  if (isNight) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ff5040";
    ctx.beginPath();
    ctx.ellipse(-halfL + 1, -halfW + 3, 1.5, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-halfL + 1, halfW - 3, 1.5, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = "#c81818";
    ctx.beginPath();
    ctx.ellipse(-halfL + 1, -halfW + 3, 1, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-halfL + 1, halfW - 3, 1, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Turn signals (amber blink)
  if (v.signal !== 0) {
    const blink = Math.floor(performance.now() / 250) % 2 === 0;
    if (blink) {
      ctx.fillStyle = "#ffae20";
      ctx.shadowColor = "#ff8020";
      ctx.shadowBlur = 4;
      if (v.signal > 0) {
        // right
        ctx.beginPath();
        ctx.ellipse(halfL, halfW - 1, 1.1, 1, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(halfL, -halfW + 1, 1.1, 1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  }

  // Brake lights when braking
  if (v.brake > 0.4) {
    ctx.fillStyle = "#ff4040";
    ctx.shadowColor = "#ff2020";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.ellipse(-halfL + 1, -halfW + 3, 1.4, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-halfL + 1, halfW - 3, 1.4, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Police lightbar with flashing
  if (v.kind === "police") {
    const phase = Math.floor(performance.now() / 180) % 2;
    // Halo
    ctx.fillStyle = phase === 0 ? "rgba(226,75,74,0.45)" : "rgba(55,138,221,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bar
    ctx.fillStyle = "#222";
    ctx.fillRect(-3, -2.5, 6, 5);
    ctx.fillStyle = phase === 0 ? "#E24B4A" : "#222";
    ctx.fillRect(-3, -2.5, 3, 5);
    ctx.fillStyle = phase === 1 ? "#378ADD" : "#222";
    ctx.fillRect(0, -2.5, 3, 5);
  }

  // Damage overlay
  if (v.damage > 0.3) {
    ctx.fillStyle = `rgba(40,40,40,${0.3 * v.damage})`;
    ctx.fillRect(-halfL, -halfW, L, W);
    // Cracks
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const sx = -halfL + Math.random() * L;
      const sy = -halfW + Math.random() * W;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - 0.5) * 6, sy + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }
  }

  // Fire overlay
  if (v.onFire || flashOnFire) {
    const t = performance.now() / 100;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const px = (Math.random() - 0.5) * L * 0.6;
      const py = (Math.random() - 0.5) * W * 0.6;
      const r = 2 + Math.random() * 3;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, r);
      grd.addColorStop(0, "rgba(255,220,80,0.9)");
      grd.addColorStop(0.6, "rgba(240,90,30,0.5)");
      grd.addColorStop(1, "rgba(120,30,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(px, py + Math.sin(t + i) * 0.5, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
}

function drawWeapon(ctx: CanvasRenderingContext2D, weapon: string) {
  // Weapon held in front-right hand at (3.3, -3.5)
  ctx.save();
  ctx.translate(3.5, -3.0);
  if (weapon === "pistol") {
    // grip
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(-0.4, -0.2, 0.8, 1.4);
    // slide
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-0.2, -0.5, 2.6, 0.9);
    // sight
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(2.0, -0.7, 0.4, 0.3);
  } else if (weapon === "smg") {
    // body
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-0.3, -0.6, 4.0, 1.0);
    // mag
    ctx.fillStyle = "#252525";
    ctx.fillRect(0.4, 0.4, 0.7, 1.4);
    // grip
    ctx.fillRect(-0.6, 0.4, 0.7, 1.2);
    // stock
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(-1.6, -0.3, 1.4, 0.7);
  } else if (weapon === "shotgun") {
    // long barrel + pump
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-0.3, -0.6, 5.0, 0.7);
    // pump (under barrel)
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(1.5, 0.1, 1.4, 0.6);
    // stock
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(-1.6, -0.5, 1.4, 1.4);
  }
  ctx.restore();
}

export function drawHumanShadow(
  ctx: CanvasRenderingContext2D,
  h: Human,
  shadowOffsetX: number,
  shadowOffsetY: number,
) {
  ctx.save();
  ctx.translate(h.x + shadowOffsetX, h.y + shadowOffsetY);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawHuman(ctx: CanvasRenderingContext2D, h: Human) {
  if (h.inVehicle) return;
  // DEATH ANIMATION — collapse: progressively flatten body & smear blood
  if (h.deathAnim > 0) {
    drawDyingHuman(ctx, h);
    return;
  }
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);

  // Walk cycle - leg offsets
  const moving = Math.abs(h.vx) + Math.abs(h.vy) > 0.1;
  const phase = h.walkPhase;
  const legSwing = moving ? Math.sin(phase) * 1.6 : 0;
  const armSwing = moving ? Math.sin(phase) * 1.4 : 0;

  const skinColor = "#d4a378";
  const skinDark = shadeHex(skinColor, -25);
  const shirtDark = shadeHex(h.shirtColor, -28);
  const shirtLight = shadeHex(h.shirtColor, 18);
  const pantsDark = shadeHex(h.pantsColor, -25);

  // SHOES (drawn first so legs sit on top)
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(-1.8, -1.6 + legSwing, 1.3, 0.7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-1.8, 1.6 - legSwing, 1.3, 0.7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Sole highlight
  ctx.fillStyle = "rgba(60,60,60,0.7)";
  ctx.fillRect(-2.4, -1.9 + legSwing, 1.0, 0.25);
  ctx.fillRect(-2.4, 1.4 - legSwing, 1.0, 0.25);

  // LEGS - tapered with shading
  ctx.fillStyle = h.pantsColor;
  ctx.beginPath();
  ctx.ellipse(-0.3, -1.6 + legSwing, 1.2, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-0.3, 1.6 - legSwing, 1.2, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Inner thigh shadow
  ctx.fillStyle = pantsDark;
  ctx.beginPath();
  ctx.ellipse(-0.3, -1.6 + legSwing, 0.4, 1.7, 0, 0, Math.PI * 2);
  ctx.ellipse(-0.3, 1.6 - legSwing, 0.4, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Knee highlight (mid-leg crease)
  ctx.fillStyle = shadeHex(h.pantsColor, 12);
  ctx.fillRect(-0.9, -1.7 + legSwing * 0.6, 1.2, 0.35);
  ctx.fillRect(-0.9, 1.35 - legSwing * 0.6, 1.2, 0.35);

  // BELT
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(-1, -2.2, 2.2, 0.6);
  ctx.fillRect(-1, 1.6, 2.2, 0.6);

  // TORSO - tapered with subtle shading
  ctx.fillStyle = h.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.4, 2.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // shoulder highlight (NW)
  ctx.fillStyle = shirtLight;
  ctx.beginPath();
  ctx.ellipse(0.3, -0.6, 2.4, 1.6, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // chest shadow (SE)
  ctx.fillStyle = shirtDark;
  ctx.beginPath();
  ctx.ellipse(-1.0, 1.0, 1.6, 1.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // outline
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.4, 2.9, 0, 0, Math.PI * 2);
  ctx.stroke();

  // ARMS — biceps + forearm + hand
  // While punchTimer is alive (~0.28s window), the lead (left/-y) arm
  // straightens out forward and the fist projects in front of the chest, with
  // a brief peak around 60% of the swing. The off-hand stays in walk pose.
  // Sprite-local x is the actor's "forward" axis after the rotate above.
  const punchT =
    h.punchTimer > 0
      ? Math.max(0, Math.min(1, 1 - h.punchTimer / 0.28)) // 0 → 1 across swing
      : 0;
  // Bell curve: peaks near t=0.6 then snaps back
  const punchExt = punchT > 0 ? Math.sin(punchT * Math.PI) : 0;
  const punchReachX = punchExt * 4.5; // forward extension in px
  const punchTuckY = punchExt * 1.2; // pulls the lead shoulder/hand inward
  // upper arm (shoulder)
  ctx.fillStyle = h.shirtColor;
  ctx.beginPath();
  ctx.ellipse(
    0.5 + punchReachX * 0.25,
    -3 - armSwing * 0.4 + punchTuckY,
    1.0,
    1.7,
    0.2,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.5, 3 + armSwing * 0.4, 1.0, 1.7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // forearm (slightly extended; punching arm extends much further forward)
  ctx.fillStyle = shirtDark;
  ctx.beginPath();
  ctx.ellipse(
    2.2 + punchReachX * 0.6,
    -3.2 - armSwing * 0.3 + punchTuckY,
    0.7 + punchExt * 0.2,
    1.3 + punchExt * 0.3,
    0.4 - punchExt * 0.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(2.2, 3.2 + armSwing * 0.3, 0.7, 1.3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // elbow joint hint
  ctx.fillStyle = shirtDark;
  ctx.fillRect(
    1.5 + punchReachX * 0.4,
    -3.2 - armSwing * 0.3 + punchTuckY,
    0.45,
    0.45,
  );
  ctx.fillRect(1.5, 3.0 + armSwing * 0.3, 0.45, 0.45);
  // hands (skin colored). The lead hand becomes a clenched fist when punching.
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  if (punchExt > 0) {
    // Fist: a slightly larger circle that sits at the end of the extended arm
    ctx.arc(
      3.3 + punchReachX,
      -3.5 - armSwing * 0.3 + punchTuckY,
      0.85,
      0,
      Math.PI * 2,
    );
  } else {
    ctx.arc(3.3, -3.5 - armSwing * 0.3, 0.6, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3.3, 3.5 + armSwing * 0.3, 0.6, 0, Math.PI * 2);
  ctx.fill();
  // finger hints / knuckle line
  ctx.fillStyle = skinDark;
  if (punchExt > 0) {
    // Knuckles on the fist
    ctx.fillRect(
      3.7 + punchReachX,
      -3.9 - armSwing * 0.3 + punchTuckY,
      0.55,
      0.7,
    );
  } else {
    ctx.fillRect(3.6, -3.7 - armSwing * 0.3, 0.4, 0.2);
  }
  ctx.fillRect(3.6, 3.5 + armSwing * 0.3, 0.4, 0.2);
  // Impact "speed line" — a tiny crescent of motion blur at the peak of the
  // swing so the punch reads even on a single frame.
  if (punchExt > 0.55) {
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(
      3.3 + punchReachX - 1.2,
      -3.5 - armSwing * 0.3 + punchTuckY,
      1.6,
      -0.5,
      0.5,
    );
    ctx.stroke();
  }

  // NECK
  const bob = moving ? Math.abs(Math.sin(phase * 0.5)) * 0.3 : 0;
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(1.4, 0, 0.7, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // HEAD - asymmetric ellipse with slight bob, with cheek shading
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(2 + bob, 0, 2.3, 2.6, 0.05, 0, Math.PI * 2);
  ctx.fill();
  // jawline shadow on far side
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(2 + bob, 1.2, 1.3, 1.4, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // cheek highlight
  ctx.fillStyle = shadeHex(skinColor, 20);
  ctx.beginPath();
  ctx.ellipse(2.3 + bob, -0.6, 1.2, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // ear (visible side)
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(1.5 + bob, -1.6, 0.4, 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // FACE DETAILS — small eye, brow line, nose hint (only the visible side)
  // Eye white
  ctx.fillStyle = "#f5f0e0";
  ctx.beginPath();
  ctx.ellipse(3.2 + bob, -0.4, 0.32, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(3.15 + bob, -0.46, 0.22, 0.18);
  // Brow
  ctx.fillStyle = shadeHex(h.hairColor, -10);
  ctx.fillRect(2.85 + bob, -0.85, 0.7, 0.18);
  // Nose hint (small darker line on cheek)
  ctx.fillStyle = skinDark;
  ctx.fillRect(3.55 + bob, -0.1, 0.25, 0.45);
  // Mouth
  ctx.fillStyle = "rgba(120,40,40,0.55)";
  ctx.fillRect(3.0 + bob, 0.55, 0.55, 0.18);
  // outline
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.ellipse(2 + bob, 0, 2.3, 2.6, 0.05, 0, Math.PI * 2);
  ctx.stroke();

  // HAIR - more sculpted top
  if (h.kind !== "police") {
    ctx.fillStyle = h.hairColor;
    ctx.beginPath();
    // Top crown
    ctx.ellipse(2 + bob, -1.4, 1.9, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sideburn / part
    ctx.fillStyle = shadeHex(h.hairColor, -25);
    ctx.beginPath();
    ctx.ellipse(1.4 + bob, -1.7, 0.9, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // FACTION-SPECIFIC OUTFIT DETAILS
  if (h.kind === "police") {
    // Cap with brim
    ctx.fillStyle = "#0e2a55";
    ctx.beginPath();
    ctx.ellipse(2.3 + bob, -1.1, 2.1, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cap band
    ctx.fillStyle = "#08183a";
    ctx.beginPath();
    ctx.ellipse(2.3 + bob, -0.4, 2.0, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cap badge (gold dot)
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.arc(2.5 + bob, -1.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Brim (front)
    ctx.fillStyle = "#050d20";
    ctx.beginPath();
    ctx.ellipse(3.6 + bob, -0.2, 0.8, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bulletproof vest over torso
    ctx.fillStyle = "#0e2a55";
    ctx.beginPath();
    ctx.roundRect(-1.4, -2.2, 2.6, 4.4, 0.6);
    ctx.fill();
    // Badge on chest
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.arc(-0.2, -0.8, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Radio
    ctx.fillStyle = "#222";
    ctx.fillRect(-1.4, 0.3, 0.7, 1.0);
    // Rank stripes on shoulders (gold)
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(0.7, -2.4, 0.5, 0.25);
    ctx.fillRect(0.7, -2.05, 0.5, 0.25);
    ctx.fillRect(0.7, 1.95, 0.5, 0.25);
    ctx.fillRect(0.7, 2.3, 0.5, 0.25);
    // Holster on belt
    ctx.fillStyle = "#1a1208";
    ctx.fillRect(0.7, 1.6, 0.6, 0.9);
  } else if (h.kind === "gang") {
    // Bandana over head
    ctx.fillStyle = "#a01818";
    ctx.beginPath();
    ctx.ellipse(2 + bob, -1.5, 2.0, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#601010";
    ctx.fillRect(0.5 + bob, -1.5, 1.0, 0.6);
    // Tank top straps
    ctx.fillStyle = shirtDark;
    ctx.fillRect(-0.5, -2.6, 0.5, 1.0);
    ctx.fillRect(-0.5, 1.6, 0.5, 1.0);
    // Gold chain on chest
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.arc(0.5, -1.2, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0.0, -0.4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0.5, 0.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Tattoo on bicep
    ctx.fillStyle = "rgba(20,20,40,0.7)";
    ctx.fillRect(0.2, -3.6, 0.6, 0.7);
  } else if (h.kind === "pedestrian") {
    // Use id for variety: some peds wear a jacket overlay, some a hat, some a backpack.
    const variant = h.id % 5;
    if (variant === 0) {
      // Open jacket — darker overlay on shoulders
      ctx.fillStyle = shadeHex(h.shirtColor, -45);
      ctx.beginPath();
      ctx.ellipse(0, -1.8, 1.4, 1.0, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 1.8, 1.4, 1.0, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 1) {
      // Cap with brim
      ctx.fillStyle = shadeHex(h.hairColor, -40);
      ctx.beginPath();
      ctx.ellipse(2.3 + bob, -1.1, 2.0, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shadeHex(h.hairColor, -55);
      ctx.beginPath();
      ctx.ellipse(3.6 + bob, -0.2, 0.7, 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 2) {
      // Backpack — small dark hump on back
      ctx.fillStyle = "#3a2a1a";
      ctx.beginPath();
      ctx.ellipse(-2.0, 0, 1.2, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(-2.4, -0.5, 0.4, 1.0);
    } else if (variant === 3) {
      // Glasses (two small dark dots over eyes)
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(2.9 + bob, -0.6, 0.9, 0.45);
      ctx.fillRect(3.0 + bob, -0.5, 0.7, 0.25);
    }
  }

  // WEAPON — drawn after body so it sits over the hand
  if (h.weapon !== "fist") {
    drawWeapon(ctx, h.weapon);
  }

  // Player highlight - subtle yellow ring
  if (h.isPlayer) {
    ctx.strokeStyle = "rgba(255,220,40,0.7)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(1, 0, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // ----- World-space overlays (no rotation) -----
  // Panic icon. Only show briefly when the ped JUST became scared (the last
  // ~0.6s of their fresh panic window) — after that they're still fleeing
  // but the icon hides so the screen isn't covered in exclamation marks.
  // We also fade it instead of harsh blinking.
  if (
    (h.aiState === "panic" || h.aiState === "flee") &&
    h.aiTimer > 1.0
  ) {
    // Fade in over 0.2s, then hold; goes 1.0 → 0.0 across the visible
    // window. This makes the icon a quick "alert" pop, not a permanent tag.
    const visT = Math.min(1, (h.aiTimer - 1.0) / 0.6); // 0..1
    const alpha = visT;
    ctx.save();
    ctx.translate(h.x, h.y - 8);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffe040";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.5;
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText("!", 0, 0);
    ctx.fillText("!", 0, 0);
    ctx.restore();
  }
  // Witness state - speech bubble with phone
  if (h.aiState === "witness") {
    ctx.save();
    ctx.translate(h.x, h.y - 9);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "#1a3a6a";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a3a6a";
    ctx.font = "bold 5px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📞", 0, 1.5);
    ctx.restore();
  }
  // Cover state - shield icon
  if (h.aiState === "cover") {
    ctx.save();
    ctx.translate(h.x, h.y - 8);
    ctx.fillStyle = "rgba(180,180,200,0.9)";
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(2, 0);
    ctx.lineTo(0, 3);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Death animation: body slumps, becomes a flat mass with arms outstretched
function drawDyingHuman(ctx: CanvasRenderingContext2D, h: Human) {
  const t = h.deathAnim;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);
  // Body squashes flat as t -> 1
  const sy = 1 - t * 0.6;
  const sx = 1 + t * 0.4;
  ctx.scale(sx, sy);
  // Limbs splay out
  const splay = t * 1.5;
  // Legs splay
  ctx.fillStyle = h.pantsColor;
  ctx.beginPath();
  ctx.ellipse(-1, -2 - splay, 1.1, 1.8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-1, 2 + splay, 1.1, 1.8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Torso
  ctx.fillStyle = h.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms outstretched
  ctx.fillStyle = h.shirtColor;
  ctx.beginPath();
  ctx.ellipse(0.5, -3 - splay, 0.8, 1.6, 0.4 + splay * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.5, 3 + splay, 0.8, 1.6, -0.4 - splay * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Head tilted
  ctx.fillStyle = '#d4a378';
  ctx.beginPath();
  ctx.ellipse(2 + t * 0.6, -0.3, 2.2, 2.5, 0.2 + t * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = h.hairColor;
  ctx.beginPath();
  ctx.ellipse(2 + t * 0.6, -1.4, 1.6, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // X eyes if player to make it cinematic
  if (h.isPlayer && t > 0.6) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(2.0 + t * 0.6, -0.6);
    ctx.lineTo(3.0 + t * 0.6, 0.4);
    ctx.moveTo(3.0 + t * 0.6, -0.6);
    ctx.lineTo(2.0 + t * 0.6, 0.4);
    ctx.stroke();
  }
  ctx.restore();

  // Blood pool grows under body
  if (t > 0.2) {
    ctx.save();
    ctx.translate(h.x, h.y + 1);
    ctx.fillStyle = 'rgba(120,12,12,' + (0.3 + t * 0.5) + ')';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 + t * 8, 4 + t * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

