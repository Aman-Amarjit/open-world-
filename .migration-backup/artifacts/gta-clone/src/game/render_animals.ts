import type { Animal } from "./types";
import { shadeHex } from "./utils";

function drawAnimal(ctx: CanvasRenderingContext2D, a: Animal) {
  ctx.save();
  const lift = a.flyZ * 10;
  ctx.translate(a.x, a.y - lift);
  ctx.rotate(a.angle);
  if (a.hp <= 0) {
    ctx.fillStyle = a.furColor;
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (a.kind === "dog") {
    // Dog breeds - 0: Shepherd, 1: Golden, 2: Black, 3: Pug/Tan
    let bodyColor = a.furColor;
    let accentColor = shadeHex(bodyColor, -25);
    if (a.breed === 0) { bodyColor = "#6b4a2b"; accentColor = "#1a1a1a"; } 
    else if (a.breed === 1) { bodyColor = "#dcb98a"; accentColor = "#c9a06b"; }
    
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(5, 0);
    if (a.state === "bark") ctx.rotate(Math.sin(a.walkPhase * 10) * 0.2 - 0.2);
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accentColor; ctx.fillRect(1.5, -0.8, 2, 1.6);
    ctx.beginPath(); ctx.moveTo(0.5, -1.5); ctx.lineTo(2, -3.5); ctx.lineTo(1, -0.5); ctx.fill();
    ctx.restore();

    const tw = Math.sin(a.walkPhase * (a.state === "chase" ? 15 : 6)) * 2;
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-8, tw); ctx.stroke();

    ctx.fillStyle = accentColor;
    const lp = a.state === "sit" ? 0 : Math.sin(a.walkPhase) * 1.5;
    ctx.beginPath();
    ctx.arc(-2, 2.2 + lp, 1, 0, Math.PI * 2);
    ctx.arc(2.2, 2.2 - lp, 1, 0, Math.PI * 2);
    ctx.arc(-2, -2.2 - lp, 1, 0, Math.PI * 2);
    ctx.arc(2.2, -2.2 + lp, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (a.kind === "cat") {
    let bodyColor = a.furColor;
    if (a.breed === 0) bodyColor = "#e67e22";
    else if (a.breed === 1) bodyColor = "#1a1a1a";
    else if (a.breed === 2) bodyColor = "#fdfdfd";

    const isSitting = a.state === "sit";
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    if (isSitting) ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2);
    else ctx.ellipse(0, 0, 5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(isSitting ? 3 : 4, 0);
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeHex(bodyColor, -15);
    ctx.beginPath(); ctx.moveTo(-0.5, -1.5); ctx.lineTo(0.5, -4); ctx.lineTo(1.5, -1.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.5, 1.5); ctx.lineTo(0.5, 4); ctx.lineTo(1.5, 1.2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-4, 0);
    if (isSitting) ctx.quadraticCurveTo(-2, 4, 3, 3);
    else ctx.quadraticCurveTo(-7, Math.sin(a.walkPhase) * 2, -8, -2);
    ctx.stroke();
  } else if (a.kind === "deer") {
    ctx.fillStyle = "#8b5e3c";
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.save();
    ctx.translate(7, -2);
    ctx.beginPath(); ctx.ellipse(0, 0, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    // Antlers
    ctx.strokeStyle = "#5a3a2a";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(1, -5); ctx.lineTo(3, -7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(-2, -6); ctx.lineTo(-1, -9); ctx.stroke();
    ctx.restore();
    // Legs
    const lp = Math.sin(a.walkPhase * 8) * 2;
    ctx.fillStyle = "#5a3a2a";
    ctx.fillRect(-5, 3 + lp, 1.5, 4);
    ctx.fillRect(4, 3 - lp, 1.5, 4);
    ctx.fillRect(-5, -7 - lp, 1.5, 4);
    ctx.fillRect(4, -7 + lp, 1.5, 4);
  } else if (a.kind === "bear") {
    ctx.fillStyle = "#3d2b1f";
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.save();
    ctx.translate(10, 0);
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath(); ctx.arc(4, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Legs
    const lp = Math.sin(a.walkPhase * 5) * 2;
    ctx.fillStyle = "#2a1a0a";
    ctx.fillRect(-7, 7 + lp, 3, 5);
    ctx.fillRect(5, 7 - lp, 3, 5);
    ctx.fillRect(-7, -12 - lp, 3, 5);
    ctx.fillRect(5, -12 + lp, 3, 5);
  } else if (a.kind === "wolf") {
    ctx.fillStyle = "#7f8c8d";
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.save();
    ctx.translate(7, 0);
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(2, -0.8, 2.5, 1.6);
    ctx.restore();
    // Tail
    ctx.strokeStyle = "#7f8c8d";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-11, Math.sin(a.walkPhase * 10) * 2); ctx.stroke();
  } else if (a.kind === "cow") {
    ctx.fillStyle = "#fdfdfd"; // White base
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    // Spots
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath(); ctx.arc(-4, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 3, 3, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.save();
    ctx.translate(12, 0);
    ctx.fillStyle = "#fdfdfd";
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffb6c1"; // Pink nose
    ctx.beginPath(); ctx.ellipse(4, 0, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (a.kind === "boar") {
    ctx.fillStyle = "#4a3a2a";
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Head
    ctx.save();
    ctx.translate(8, 0);
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    // Tusks
    ctx.strokeStyle = "#ecf0f1";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(5, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(5, -4); ctx.stroke();
    ctx.restore();
  } else {
    // PIGEON / BIRD
    ctx.fillStyle = "#7e8a99";
    ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, 0, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(100, 255, 150, 0.35)";
    ctx.beginPath(); ctx.arc(2.5, 0, 1.5, -Math.PI/2, Math.PI/2); ctx.fill();
    ctx.fillStyle = "#e8a83a";
    ctx.beginPath(); ctx.moveTo(4.2, 0); ctx.lineTo(5.5, -0.4); ctx.lineTo(5.5, 0.4); ctx.fill();
    
    const wf = (a.flyZ > 0.05) ? Math.sin(a.walkPhase * 2.5) * 2.5 : 0;
    ctx.fillStyle = "#657080";
    ctx.beginPath(); ctx.ellipse(-0.5, -2, 3, 1.2 + wf, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.5, 2, 3, 1.2 + wf, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
