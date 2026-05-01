import { useEffect, useRef, useState } from "react";
import type { StoryCutscene, DialogueLine } from "@/game/types";

interface Props {
  cutscene: StoryCutscene;
  actBanner: string;
  actBannerTimer: number;
}

const TYPEWRITER_SPEED = 28; // chars per second

export function Cutscene({ cutscene, actBanner, actBannerTimer }: Props) {
  const line: DialogueLine | undefined = cutscene.lines[cutscene.index];
  const [displayedText, setDisplayedText] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevKey = useRef("");

  // Restart typewriter whenever the line or index changes
  const key = `${cutscene.missionIdx}-${cutscene.index}`;
  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;

    setDisplayedText("");
    setDone(false);

    if (!line) return;

    let idx = 0;
    const full = line.text;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      idx++;
      setDisplayedText(full.slice(0, idx));
      if (idx >= full.length) {
        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000 / TYPEWRITER_SPEED);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [key, line]);

  if (!line) return null;

  const isLeft = line.side === "left";
  const initial = line.speaker.charAt(0).toUpperCase();

  return (
    <>
      {/* Top letterbox bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "12vh",
          background: "rgba(0,0,0,0.88)",
          zIndex: 100,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Act banner */}
      {actBannerTimer > 0 && actBanner && (
        <div
          style={{
            position: "fixed",
            top: "12vh",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "12px 0",
            background: "rgba(0,0,0,0.55)",
            zIndex: 101,
            opacity: Math.min(1, actBannerTimer, 4 - actBannerTimer > 0 ? 4 - actBannerTimer : 1),
            transition: "opacity 0.5s",
          }}
        >
          <span
            style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: "clamp(18px, 3vw, 36px)",
              color: "#e8b820",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              textShadow: "0 2px 12px rgba(0,0,0,0.9)",
            }}
          >
            {actBanner}
          </span>
        </div>
      )}

      {/* Bottom letterbox bar + dialogue */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "28vh",
          background: "rgba(0,0,0,0.86)",
          zIndex: 100,
          backdropFilter: "blur(2px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "16px 24px 20px",
        }}
      >
        {/* Speaker row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "14px",
            flexDirection: isLeft ? "row" : "row-reverse",
            marginBottom: "10px",
          }}
        >
          {/* Portrait circle */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, ${line.color}bb, ${line.color}55)`,
              border: `2px solid ${line.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 900,
              color: "#fff",
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              flexShrink: 0,
              boxShadow: `0 0 14px ${line.color}66`,
            }}
          >
            {initial}
          </div>

          {/* Name + role */}
          <div style={{ textAlign: isLeft ? "left" : "right" }}>
            <div
              style={{
                fontFamily: "'Impact', 'Arial Black', sans-serif",
                fontSize: "clamp(13px, 2vw, 18px)",
                color: line.color,
                letterSpacing: "0.08em",
                textShadow: `0 0 10px ${line.color}99`,
              }}
            >
              {line.speaker}
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "clamp(9px, 1.2vw, 11px)",
                color: "#aaaaaa",
                letterSpacing: "0.2em",
                marginTop: 2,
              }}
            >
              {line.role}
            </div>
          </div>
        </div>

        {/* Dialogue text */}
        <div
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontSize: "clamp(14px, 2.2vw, 20px)",
            color: "#f0f0f0",
            lineHeight: 1.5,
            minHeight: "3em",
            textAlign: isLeft ? "left" : "right",
            textShadow: "0 1px 6px rgba(0,0,0,0.9)",
            padding: "0 4px",
            borderLeft: isLeft ? `3px solid ${line.color}66` : "none",
            borderRight: !isLeft ? `3px solid ${line.color}66` : "none",
            paddingLeft: isLeft ? 12 : 4,
            paddingRight: !isLeft ? 12 : 4,
          }}
        >
          {displayedText}
          {/* Cursor blink while typing */}
          {!done && (
            <span
              style={{
                display: "inline-block",
                width: "2px",
                height: "1em",
                background: line.color,
                marginLeft: 3,
                verticalAlign: "middle",
                animation: "blink 0.6s step-end infinite",
              }}
            />
          )}
        </div>

        {/* Continue hint */}
        <div
          style={{
            marginTop: 10,
            textAlign: "right",
            fontFamily: "monospace",
            fontSize: "clamp(10px, 1.3vw, 13px)",
            color: done ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
            letterSpacing: "0.15em",
            transition: "color 0.4s",
          }}
        >
          {cutscene.index < cutscene.lines.length - 1
            ? "[ SPACE / E ] CONTINUE"
            : cutscene.phase === "outro"
            ? "[ SPACE / E ] CLOSE"
            : "[ SPACE / E ] START MISSION"}
        </div>
      </div>

      {/* CSS keyframe for cursor blink */}
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </>
  );
}
