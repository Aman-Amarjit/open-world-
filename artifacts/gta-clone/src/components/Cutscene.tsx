import { useEffect, useRef, useState } from "react";
import type { StoryCutscene, DialogueLine } from "@/game/types";

interface Props {
  cutscene: StoryCutscene;
  actBanner: string;
  actBannerTimer: number;
}

const TYPEWRITER_SPEED = 32; // chars per second
const NARRATION_SPEED  = 22; // slower for internal monologue

export function Cutscene({ cutscene, actBanner, actBannerTimer }: Props) {
  const line: DialogueLine | undefined = cutscene.lines[cutscene.index];
  const [displayedText, setDisplayedText] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevKey  = useRef("");

  const key = `${cutscene.missionIdx}-${cutscene.index}`;

  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    setDisplayedText("");
    setDone(false);
    if (!line) return;

    let idx = 0;
    const full  = line.text;
    const speed = line.isNarration ? NARRATION_SPEED : TYPEWRITER_SPEED;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      idx++;
      setDisplayedText(full.slice(0, idx));
      if (idx >= full.length) {
        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000 / speed);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [key, line]);

  if (!line) return null;

  const isNarration = !!line.isNarration;
  const isLeft      = line.side === "left";
  const initial     = line.speaker.charAt(0).toUpperCase();
  const total       = cutscene.lines.length;
  const current     = cutscene.index;

  const continueLabel =
    current < total - 1
      ? "[ SPACE / E ]  CONTINUE"
      : cutscene.phase === "outro"
      ? "[ SPACE / E ]  CLOSE"
      : "[ SPACE / E ]  START MISSION";

  // -- Fade opacity for act banner --
  const bannerOpacity = actBannerTimer > 0
    ? Math.min(1, actBannerTimer, Math.max(0, 4 - actBannerTimer))
    : 0;

  return (
    <>
      {/* ─── Global styles ─────────────────────────────────────────── */}
      <style>{`
        @keyframes blink    { 50%  { opacity: 0; } }
        @keyframes fadeIn   { from { opacity: 0; transform: translateY(6px); }
                              to   { opacity: 1; transform: translateY(0);   } }
        @keyframes slideUp  { from { transform: translateY(24px); opacity: 0; }
                              to   { transform: translateY(0);     opacity: 1; } }
        @keyframes pulse    { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes scanline {
          0%   { background-position: 0 0;    }
          100% { background-position: 0 100%; }
        }
        .cs-narration-text {
          animation: fadeIn 0.5s ease forwards;
        }
        .cs-panel {
          animation: slideUp 0.35s cubic-bezier(0.22,0.61,0.36,1) forwards;
        }
        .cs-line-change {
          animation: fadeIn 0.2s ease forwards;
        }
      `}</style>

      {/* ─── Top letterbox ─────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "10vh", zIndex: 200,
        background: "linear-gradient(to bottom, #000000 60%, rgba(0,0,0,0.82) 100%)",
      }} />

      {/* ─── Act banner ─────────────────────────────────────────────── */}
      {actBannerTimer > 0 && actBanner && (
        <div style={{
          position: "fixed", top: "10vh", left: 0, right: 0,
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "10px 0", zIndex: 201,
          background: "rgba(0,0,0,0.5)",
          opacity: bannerOpacity,
          transition: "opacity 0.5s",
        }}>
          <span style={{
            fontFamily: "'Impact', 'Arial Black', sans-serif",
            fontSize: "clamp(16px, 2.8vw, 34px)",
            color: "#e8b820",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            textShadow: "0 0 24px rgba(232,184,32,0.6), 0 2px 8px rgba(0,0,0,1)",
          }}>
            {actBanner}
          </span>
        </div>
      )}

      {/* ─── Narration overlay (full-screen, centered subtitle style) ─ */}
      {isNarration && (
        <div style={{
          position: "fixed", top: "10vh", left: 0, right: 0, bottom: "38vh",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          padding: "0 10vw 24px",
          zIndex: 199,
          pointerEvents: "none",
        }}>
          <div className="cs-narration-text" key={key} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 8, width: "100%", maxWidth: 720,
          }}>
            {/* Narration label */}
            <div style={{
              fontFamily: "monospace",
              fontSize: "clamp(9px, 1vw, 11px)",
              color: "#606068",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginBottom: 2,
            }}>
              ◆ &nbsp; MARCUS COLE — INTERNAL MONOLOGUE &nbsp; ◆
            </div>
            {/* Narration text */}
            <div style={{
              fontFamily: "'Georgia', 'Times New Roman', serif",
              fontSize: "clamp(15px, 2.1vw, 22px)",
              color: "rgba(230,224,210,0.92)",
              lineHeight: 1.65,
              textAlign: "center",
              fontStyle: "italic",
              textShadow: "0 2px 16px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.8)",
              letterSpacing: "0.01em",
            }}>
              {displayedText}
              {!done && (
                <span style={{
                  display: "inline-block", width: 2, height: "1em",
                  background: "#9090a0", marginLeft: 4,
                  verticalAlign: "middle",
                  animation: "blink 0.7s step-end infinite",
                }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom dialogue panel ──────────────────────────────────── */}
      <div className="cs-panel" style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "38vh", zIndex: 200,
        background: "linear-gradient(to top, #000000 55%, rgba(0,0,0,0.91) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        padding: "0 0 0 0",
        overflow: "hidden",
      }}>

        {/* ── Progress dots ── */}
        <div style={{
          display: "flex", gap: 5, justifyContent: "center",
          padding: "10px 0 0",
          flexShrink: 0,
        }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              width: i === current ? 20 : 6,
              height: 3,
              borderRadius: 2,
              background: i < current
                ? "rgba(255,255,255,0.3)"
                : i === current
                ? line.color
                : "rgba(255,255,255,0.1)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* ── Main dialogue row ── */}
        {!isNarration && (
          <div key={key} className="cs-line-change" style={{
            display: "flex",
            flexDirection: isLeft ? "row" : "row-reverse",
            alignItems: "flex-start",
            flex: 1,
            gap: 0,
            padding: "14px 20px 0",
            overflow: "hidden",
          }}>

            {/* Portrait column */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 8, flexShrink: 0, width: 80,
              paddingTop: 4,
            }}>
              {/* Avatar hex */}
              <div style={{
                width: 66, height: 66,
                borderRadius: "50%",
                background: `radial-gradient(circle at 38% 32%, ${line.color}cc 0%, ${line.color}44 50%, #111 100%)`,
                border: `2.5px solid ${line.color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 900, color: "#fff",
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                boxShadow: `0 0 20px ${line.color}55, 0 4px 20px rgba(0,0,0,0.9)`,
                flexShrink: 0,
                position: "relative",
              }}>
                {initial}
                {/* Active glow ring */}
                <div style={{
                  position: "absolute", inset: -5,
                  borderRadius: "50%",
                  border: `1px solid ${line.color}44`,
                  animation: "pulse 2s ease-in-out infinite",
                }} />
              </div>

              {/* Speaker label below avatar */}
              <div style={{
                textAlign: "center",
                fontFamily: "monospace",
                fontSize: "clamp(7px, 0.9vw, 9px)",
                color: "#666",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                lineHeight: 1.3,
                maxWidth: 80,
                wordBreak: "break-word",
              }}>
                {line.role}
              </div>
            </div>

            {/* Text column */}
            <div style={{
              flex: 1,
              display: "flex", flexDirection: "column",
              padding: isLeft ? "0 16px 0 20px" : "0 20px 0 16px",
              overflow: "hidden",
            }}>
              {/* Speaker name */}
              <div style={{
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                fontSize: "clamp(13px, 1.9vw, 20px)",
                color: line.color,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textShadow: `0 0 16px ${line.color}88`,
                marginBottom: 8,
                marginTop: 2,
              }}>
                {line.speaker}
              </div>

              {/* Dialogue text */}
              <div style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontSize: "clamp(14px, 2vw, 21px)",
                color: "#f0ece2",
                lineHeight: 1.6,
                textAlign: "left",
                textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                paddingLeft: 14,
                borderLeft: `3px solid ${line.color}88`,
                flex: 1,
                overflowY: "auto",
              }}>
                {displayedText}
                {!done && (
                  <span style={{
                    display: "inline-block", width: 2, height: "0.9em",
                    background: line.color, marginLeft: 3,
                    verticalAlign: "middle",
                    animation: "blink 0.6s step-end infinite",
                  }} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Narration spacer (keeps layout consistent when narration is showing) ── */}
        {isNarration && <div style={{ flex: 1 }} />}

        {/* ── Continue prompt ── */}
        <div style={{
          padding: "10px 28px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          {/* Phase indicator */}
          <div style={{
            fontFamily: "monospace",
            fontSize: "clamp(8px, 1vw, 10px)",
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}>
            {cutscene.phase === "intro" ? "PRE-MISSION" : "DEBRIEF"}
            &nbsp;·&nbsp;
            {current + 1} / {total}
          </div>

          {/* Continue hint */}
          <div style={{
            fontFamily: "monospace",
            fontSize: "clamp(9px, 1.1vw, 12px)",
            color: done ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            transition: "color 0.4s",
            animation: done ? "pulse 1.8s ease-in-out infinite" : "none",
          }}>
            {continueLabel}
          </div>
        </div>
      </div>
    </>
  );
}
