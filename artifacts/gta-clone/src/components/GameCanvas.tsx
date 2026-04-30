import { useEffect, useRef, useState } from "react";
import { createGame, tick, type Game } from "@/game/game";
import { renderWorld } from "@/game/render";
import { renderInterior } from "@/game/interior";
import { setupInput } from "@/game/input";
import { audioEngine } from "@/game/audio";
import { HUD } from "./HUD";
import { TitleOverlay } from "./TitleOverlay";

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [, setTick] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const game = createGame(Math.floor(Math.random() * 100000));
    gameRef.current = game;

    const cleanupInput = setupInput(game.state, canvas);

    let raf = 0;
    let last = performance.now();
    let hudCounter = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      let dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(game, dt);

      // Clear bg
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      if (game.state.interior) {
        renderInterior(ctx, game.state, window.innerWidth, window.innerHeight);
      } else {
        renderWorld({
          ctx,
          world: game.world,
          state: game.state,
          viewW: window.innerWidth,
          viewH: window.innerHeight,
        });
      }

      // Damage flash
      if (game.state.damageFlash > 0) {
        ctx.fillStyle = `rgba(180,20,20,${game.state.damageFlash * 0.4})`;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      }

      // BUSTED / WASTED end-screen overlay
      if (game.state.endScreen) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const es = game.state.endScreen;
        // While the death animation is playing, draw a slow red vignette only
        if (es.dyingTimer > 0) {
          const dt = 1 - es.dyingTimer / 1.4; // 0..1
          // red vignette
          const grd = ctx.createRadialGradient(
            w / 2,
            h / 2,
            Math.min(w, h) * 0.2,
            w / 2,
            h / 2,
            Math.max(w, h) * 0.7,
          );
          grd.addColorStop(0, `rgba(80,0,0,0)`);
          grd.addColorStop(1, `rgba(120,0,0,${0.3 + dt * 0.45})`);
          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, w, h);
          // gentle desaturation/dim
          ctx.fillStyle = `rgba(0,0,0,${dt * 0.25})`;
          ctx.fillRect(0, 0, w, h);
          raf = requestAnimationFrame(loop);
          hudCounter++;
          if (hudCounter % 4 === 0) setTick((v) => v + 1);
          return;
        }
        // Fade-in over first half-second, fade-out at the very end
        const t = 3 - es.timer; // elapsed
        const alpha = Math.min(1, t / 0.5) * Math.min(1, es.timer / 0.4);
        const isBusted = es.kind === "busted";
        ctx.fillStyle = isBusted
          ? `rgba(10,30,90,${0.78 * alpha})`
          : `rgba(120,10,10,${0.78 * alpha})`;
        ctx.fillRect(0, 0, w, h);
        // Tilted text band
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-0.06);
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Black band
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(-w, -90, w * 2, 180);
        // Big title
        ctx.font = "bold 140px Impact, 'Arial Black', sans-serif";
        ctx.fillStyle = isBusted ? "#5fa8ff" : "#ff5050";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 18;
        ctx.fillText(isBusted ? "BUSTED" : "WASTED", 0, -8);
        // Subtitle
        ctx.shadowBlur = 0;
        ctx.font = "bold 22px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillText(
          isBusted ? "the cops took you in" : "you bled out on the asphalt",
          0,
          54,
        );
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(
          isBusted
            ? "weapons confiscated · 30% of cash gone"
            : "50% of cash lost",
          0,
          82,
        );
        ctx.restore();
      }

      // Update HUD periodically (avoid React re-render every frame)
      hudCounter++;
      if (hudCounter % 4 === 0) {
        setTick((v) => v + 1);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      cleanupInput();
    };
  }, []);

  const handleStart = () => {
    audioEngine.start();
    audioEngine.resume();
    setStarted(true);
  };

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
      />
      <div className="vignette" />
      <div className="scanlines" />
      {gameRef.current && started && (
        <HUD state={gameRef.current.state} world={gameRef.current.world} />
      )}
      {!started && <TitleOverlay onStart={handleStart} />}
      {gameRef.current?.state.paused && started && (
        <div className="pause-overlay">
          <div className="pause-card">
            <h2>PAUSED</h2>
            <p>Press P or Esc to resume</p>
          </div>
        </div>
      )}
    </div>
  );
}
