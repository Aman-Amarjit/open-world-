import { useEffect, useRef, useState } from "react";
import type { StoryCutscene, DialogueLine } from "@/game/types";

interface Props {
  cutscene: StoryCutscene;
  actBanner: string;
  actBannerTimer: number;
}

const TYPEWRITER_SPEED = 36;
const NARRATION_SPEED  = 22;

// ── Per-character portrait data ───────────────────────────────────────────────
interface CharStyle {
  bg: string;       // background gradient
  shape: string;    // clip-path for the bust silhouette
  accent: string;   // secondary color
  detail: JSX.Element; // inline detail drawn inside portrait
}

function PortraitDetail({ speaker, color }: { speaker: string; color: string }) {
  // Draw a minimal stylised bust per character using SVG
  const s = speaker;

  if (s.startsWith("Marcus")) return (
    <svg viewBox="0 0 60 70" width="60" height="70" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
      {/* Head */}
      <ellipse cx="30" cy="22" rx="14" ry="17" fill="#c8a882" />
      {/* Short fade haircut */}
      <ellipse cx="30" cy="9" rx="14" ry="10" fill="#3a2a1a" />
      {/* Jaw */}
      <rect x="17" y="30" width="26" height="6" rx="3" fill="#c8a882" />
      {/* Jacket collar */}
      <polygon points="20,36 14,56 30,48 46,56 40,36 30,44" fill="#1a2235" />
      <polygon points="27,36 30,48 33,36" fill="#ccc" />
      {/* Eyes */}
      <ellipse cx="24" cy="20" rx="2.5" ry="3" fill="#1a1a2a" />
      <ellipse cx="36" cy="20" rx="2.5" ry="3" fill="#1a1a2a" />
    </svg>
  );

  if (s.startsWith("Jimmy")) return (
    <svg viewBox="0 0 60 70" width="60" height="70" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
      {/* Baseball cap */}
      <ellipse cx="30" cy="13" rx="17" ry="8" fill="#222" />
      <rect x="13" y="11" width="34" height="7" rx="3" fill="#333" />
      <rect x="7" y="14" width="12" height="4" rx="2" fill="#444" />
      {/* Head */}
      <ellipse cx="30" cy="26" rx="13" ry="15" fill="#d4a870" />
      {/* Stubble */}
      <ellipse cx="30" cy="36" rx="10" ry="5" fill="#b8904a" opacity="0.5" />
      {/* Jacket */}
      <polygon points="18,40 12,60 30,52 48,60 42,40 30,50" fill="#2a1e10" />
      {/* Eyes */}
      <ellipse cx="24" cy="24" rx="2" ry="2.5" fill="#2a1a0a" />
      <ellipse cx="36" cy="24" rx="2" ry="2.5" fill="#2a1a0a" />
    </svg>
  );

  if (s.startsWith("Vinnie")) return (
    <svg viewBox="0 0 60 70" width="60" height="70" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
      {/* Head — wide, powerful */}
      <ellipse cx="30" cy="22" rx="16" ry="18" fill="#b88a60" />
      {/* Receding hair */}
      <path d="M14,14 Q18,6 30,8 Q42,6 46,14 Q42,10 30,12 Q18,10 14,14" fill="#1a1010" />
      {/* Wide neck */}
      <rect x="20" y="37" width="20" height="8" fill="#b88a60" />
      {/* Suit / wide lapels */}
      <polygon points="18,42 8,65 30,55 52,65 42,42 30,54" fill="#0a0a14" />
      <polygon points="27,42 30,54 33,42" fill="#e8b820" />
      {/* Gold chain */}
      <ellipse cx="30" cy="57" rx="8" ry="2" fill="none" stroke="#e8b820" strokeWidth="1.5" />
      {/* Eyes — small, shrewd */}
      <ellipse cx="24" cy="21" rx="2" ry="2" fill="#100a00" />
      <ellipse cx="36" cy="21" rx="2" ry="2" fill="#100a00" />
      {/* Scar */}
      <line x1="37" y1="18" x2="40" y2="27" stroke="#8a5a30" strokeWidth="1.2" />
    </svg>
  );

  if (s.startsWith("Tanya")) return (
    <svg viewBox="0 0 60 70" width="60" height="70" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
      {/* Long flowing hair (left) */}
      <path d="M16,12 Q8,30 10,55 L17,54 Q16,32 20,16Z" fill="#1a1020" />
      {/* Long flowing hair (right) */}
      <path d="M44,12 Q52,30 50,55 L43,54 Q44,32 40,16Z" fill="#1a1020" />
      {/* Head */}
      <ellipse cx="30" cy="24" rx="13" ry="15" fill="#e8b090" />
      {/* Hair top */}
      <ellipse cx="30" cy="12" rx="14" ry="8" fill="#1a1020" />
      {/* Jacket */}
      <polygon points="20,38 14,62 30,50 46,62 40,38 30,48" fill="#2a0a1a" />
      <polygon points="27,38 30,48 33,38" fill="#ff60c0" />
      {/* Eyes */}
      <ellipse cx="24" cy="23" rx="2.5" ry="3" fill="#1a0a10" />
      <ellipse cx="36" cy="23" rx="2.5" ry="3" fill="#1a0a10" />
      {/* Lips */}
      <path d="M25,34 Q30,37 35,34" stroke="#cc2266" strokeWidth="1.5" fill="none" />
    </svg>
  );

  if (s.startsWith("Capt")) return (
    <svg viewBox="0 0 60 70" width="60" height="70" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
      {/* Police cap flat brim */}
      <rect x="12" y="14" width="36" height="6" rx="1" fill="#14206a" />
      <rect x="10" y="17" width="40" height="3" rx="1" fill="#1a2c8a" />
      {/* Cap top */}
      <ellipse cx="30" cy="11" rx="16" ry="7" fill="#14206a" />
      {/* Badge on cap */}
      <polygon points="30,13 32,17 30,16 28,17" fill="#e8c840" />
      {/* Head */}
      <ellipse cx="30" cy="26" rx="12" ry="13" fill="#c8a060" />
      {/* Uniform collar */}
      <rect x="20" y="38" width="20" height="4" fill="#1a2c8a" />
      {/* Uniform */}
      <polygon points="18,40 12,62 30,52 48,62 42,40 30,50" fill="#14206a" />
      {/* Badge on chest */}
      <polygon points="30,48 33,54 30,52 27,54" fill="#e8c840" />
      {/* Eyes */}
      <ellipse cx="25" cy="25" rx="2" ry="2.5" fill="#0a0a1a" />
      <ellipse cx="35" cy="25" rx="2" ry="2.5" fill="#0a0a1a" />
      {/* Mustache */}
      <path d="M23,32 Q30,35 37,32" stroke="#4a3010" strokeWidth="2" fill="none" />
    </svg>
  );

  if (s.startsWith("Dwayne") || s.startsWith("King")) return (
    <svg viewBox="0 0 60 70" width="60" height="70" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
      {/* Big shaved head */}
      <ellipse cx="30" cy="22" rx="17" ry="18" fill="#6a3818" />
      {/* Very thick neck */}
      <rect x="16" y="36" width="28" height="10" fill="#6a3818" />
      {/* Tattoo on neck */}
      <text x="22" y="44" fontSize="6" fill="#3a1808" fontFamily="serif">KING</text>
      {/* Hoodie */}
      <polygon points="14,44 6,68 30,56 54,68 46,44 30,58" fill="#1a0808" />
      {/* Eyes */}
      <ellipse cx="23" cy="20" rx="2.5" ry="2.5" fill="#0a0000" />
      <ellipse cx="37" cy="20" rx="2.5" ry="2.5" fill="#0a0000" />
      {/* Scar across face */}
      <line x1="19" y1="15" x2="25" y2="28" stroke="#3a1808" strokeWidth="1.8" />
    </svg>
  );

  if (s.startsWith("Solomon")) return (
    <svg viewBox="0 0 60 70" width="60" height="70" style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)" }}>
      {/* Top hat */}
      <rect x="20" y="2" width="20" height="14" rx="1" fill="#111" />
      <rect x="14" y="14" width="32" height="4" rx="1" fill="#1a1a1a" />
      {/* Thin head */}
      <ellipse cx="30" cy="28" rx="11" ry="14" fill="#d8c8b0" />
      {/* Thin hair sides */}
      <rect x="18" y="18" width="4" height="12" rx="2" fill="#1a1a1a" />
      <rect x="38" y="18" width="4" height="12" rx="2" fill="#1a1a1a" />
      {/* Pointed chin */}
      <polygon points="22,38 38,38 30,46" fill="#d8c8b0" />
      {/* Suit — narrow */}
      <polygon points="22,40 17,64 30,56 43,64 38,40 30,52" fill="#0a001a" />
      <polygon points="28,40 30,52 32,40" fill="#c060ff" />
      {/* Monocle */}
      <circle cx="37" cy="27" r="4" fill="none" stroke="#c060ff" strokeWidth="1" />
      <line x1="40" y1="30" x2="43" y2="33" stroke="#c060ff" strokeWidth="0.8" />
      {/* Eyes */}
      <ellipse cx="24" cy="27" rx="2" ry="2.5" fill="#0a000a" />
      <ellipse cx="37" cy="27" rx="2" ry="2.5" fill="#0a000a" />
    </svg>
  );

  // Generic fallback — just use a styled initial
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontSize: 40, fontWeight: 900,
      fontFamily: "'Impact','Arial Black',sans-serif",
      color: `${color}cc`,
    }}>
      {speaker.charAt(0)}
    </div>
  );
}

function Portrait({
  line, active, mirrorX,
}: {
  line: DialogueLine;
  active: boolean;
  mirrorX?: boolean;
}) {
  return (
    <div style={{
      position: "relative",
      width: 100, height: 110,
      flexShrink: 0,
      transition: "all 0.4s cubic-bezier(0.22,0.61,0.36,1)",
      opacity: active ? 1 : 0.25,
      filter: active ? "none" : "saturate(0)",
      transform: `scale(${active ? 1 : 0.88}) ${mirrorX ? "scaleX(-1)" : ""}`,
    }}>
      {/* Glow ring */}
      {active && (
        <div style={{
          position: "absolute", inset: -8,
          borderRadius: 12,
          background: `radial-gradient(ellipse at 50% 100%, ${line.color}44 0%, transparent 70%)`,
          animation: "portraitGlow 2s ease-in-out infinite",
        }} />
      )}
      {/* Frame */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: 10,
        background: `linear-gradient(160deg, ${line.color}18 0%, rgba(0,0,0,0.7) 100%)`,
        border: `1.5px solid ${active ? line.color + "88" : "rgba(255,255,255,0.06)"}`,
        overflow: "hidden",
        transition: "border-color 0.4s",
      }}>
        {/* Scanline on portrait */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
          pointerEvents: "none",
        }} />
        {/* Character art */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <PortraitDetail speaker={line.speaker} color={line.color} />
        </div>
      </div>
      {/* Active talking indicator */}
      {active && (
        <div style={{
          position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 3,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 3, height: 3, borderRadius: "50%",
              background: line.color,
              animation: `talkDot 0.8s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
        </div>
      )}
      {/* Name tag */}
      <div style={{
        position: "absolute", bottom: -22, left: 0, right: 0,
        textAlign: "center",
        fontFamily: "monospace",
        fontSize: 8,
        color: active ? line.color : "rgba(255,255,255,0.25)",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        transition: "color 0.4s",
      }}>
        {line.role}
      </div>
    </div>
  );
}

// Derive "other speaker" from lines array to show both characters
function findOtherSpeaker(lines: DialogueLine[], currentLine: DialogueLine): DialogueLine | null {
  return lines.find(l => l.speaker !== currentLine.speaker && !l.isNarration) ?? null;
}

export function Cutscene({ cutscene, actBanner, actBannerTimer }: Props) {
  const line: DialogueLine | undefined = cutscene.lines[cutscene.index];
  const [displayedText, setDisplayedText] = useState("");
  const [done, setDone] = useState(false);
  const [titleVisible, setTitleVisible] = useState(cutscene.phase === "intro");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevKey   = useRef("");

  const key = `${cutscene.missionIdx}-${cutscene.index}-${cutscene.phase}`;

  // Hide the mission title after a delay
  useEffect(() => {
    if (cutscene.phase === "intro" && cutscene.index === 0) {
      setTitleVisible(true);
      const t = setTimeout(() => setTitleVisible(false), 2200);
      return () => clearTimeout(t);
    } else {
      setTitleVisible(false);
    }
  }, [cutscene.missionIdx, cutscene.phase]);

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
  const total       = cutscene.lines.length;
  const current     = cutscene.index;
  const otherLine   = findOtherSpeaker(cutscene.lines, line);

  const continueLabel =
    current < total - 1
      ? "CONTINUE"
      : cutscene.phase === "outro"
      ? "CLOSE"
      : "START MISSION";

  const bannerOpacity = actBannerTimer > 0
    ? Math.min(1, actBannerTimer, Math.max(0, 4 - actBannerTimer))
    : 0;

  // Color atmosphere based on speaker
  const atmosphereColor = line.color;

  return (
    <>
      <style>{`
        @keyframes blink        { 50%  { opacity: 0; } }
        @keyframes fadeIn       { from { opacity: 0; transform: translateY(8px); }
                                  to   { opacity: 1; transform: translateY(0);   } }
        @keyframes slideUp      { from { transform: translateY(32px); opacity: 0; }
                                  to   { transform: translateY(0);     opacity: 1; } }
        @keyframes slideDown    { from { transform: translateY(-20px); opacity: 0; }
                                  to   { transform: translateY(0);      opacity: 1; } }
        @keyframes pulse        { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes portraitGlow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }
        @keyframes talkDot      { 0%,100% { transform: scaleY(0.4); opacity: 0.4; }
                                  50%     { transform: scaleY(1.0);  opacity: 1.0; } }
        @keyframes titleIn      { 0%  { opacity: 0; letter-spacing: 0.6em; }
                                  40% { opacity: 1; letter-spacing: 0.25em; }
                                  80% { opacity: 1; letter-spacing: 0.25em; }
                                 100% { opacity: 0; letter-spacing: 0.1em;  } }
        @keyframes lineIn       { from { opacity: 0; transform: translateX(-12px); }
                                  to   { opacity: 1; transform: translateX(0);      } }
        @keyframes scanMove     { from { background-position: 0 0; }
                                  to   { background-position: 0 100px; } }
        @keyframes grainMove    {
          0%  { transform: translate(0,0); }
          10% { transform: translate(-1%,-1%); }
          20% { transform: translate(1%,1%); }
          30% { transform: translate(-2%,0); }
          40% { transform: translate(2%,-1%); }
          50% { transform: translate(-1%,2%); }
          60% { transform: translate(1%,-2%); }
          70% { transform: translate(-2%,1%); }
          80% { transform: translate(2%,0); }
          90% { transform: translate(-1%,-2%); }
         100% { transform: translate(1%,2%); }
        }
        .cs-line-in { animation: lineIn 0.3s ease forwards; }
        .cs-title   { animation: titleIn 2.2s ease-in-out forwards; }
      `}</style>

      {/* ─── Film grain overlay ───────────────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 195,
        pointerEvents: "none",
        opacity: 0.045,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "128px 128px",
        animation: "grainMove 0.12s steps(1) infinite",
        mixBlendMode: "overlay",
      }} />

      {/* ─── Full-screen atmosphere tint ─────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 196,
        pointerEvents: "none",
        background: `radial-gradient(ellipse at 50% 100%, ${atmosphereColor}0a 0%, transparent 65%)`,
        transition: "background 0.6s ease",
      }} />

      {/* ─── Top letterbox bar ───────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: 72, zIndex: 200,
        background: "#000",
        animation: "slideDown 0.3s ease-out",
        display: "flex", alignItems: "center",
        padding: "0 28px",
        gap: 16,
      }}>
        {/* Phase pill */}
        <div style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: line.color,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          border: `1px solid ${line.color}44`,
          borderRadius: 3,
          padding: "3px 8px",
        }}>
          {cutscene.phase === "intro" ? "PRE-MISSION" : "DEBRIEF"}
        </div>

        {/* Thin colored line separator */}
        <div style={{
          flex: 1, height: 1,
          background: `linear-gradient(to right, ${line.color}60, transparent)`,
          transition: "background 0.5s",
        }} />

        {/* Mission index */}
        <div style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.2em",
        }}>
          {current + 1} / {total}
        </div>
      </div>

      {/* ─── Act banner ──────────────────────────────────────────────── */}
      {actBannerTimer > 0 && actBanner && (
        <div style={{
          position: "fixed", top: 72, left: 0, right: 0,
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "8px 0", zIndex: 201,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.3))",
          opacity: bannerOpacity,
          transition: "opacity 0.5s",
        }}>
          <span style={{
            fontFamily: "'Impact','Arial Black',sans-serif",
            fontSize: "clamp(18px, 3vw, 38px)",
            color: "#e8b820",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            textShadow: "0 0 30px rgba(232,184,32,0.7), 0 2px 8px rgba(0,0,0,1)",
          }}>
            {actBanner}
          </span>
        </div>
      )}

      {/* ─── Narration (internal monologue, centered) ─────────────────── */}
      {isNarration && (
        <div style={{
          position: "fixed",
          top: "72px", left: 0, right: 0, bottom: "220px",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          padding: "0 12vw 32px",
          zIndex: 199,
          pointerEvents: "none",
        }}>
          <div key={key} style={{
            animation: "fadeIn 0.5s ease forwards",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            width: "100%", maxWidth: 740,
          }}>
            {/* Italic rule lines above */}
            <div style={{
              width: 200, height: 1,
              background: "linear-gradient(to right, transparent, rgba(144,144,160,0.4), transparent)",
              marginBottom: 4,
            }} />
            <div style={{
              fontFamily: "monospace", fontSize: 9,
              color: "#505060", letterSpacing: "0.32em",
              textTransform: "uppercase",
            }}>
              ◆ &nbsp; internal monologue &nbsp; ◆
            </div>
            <div style={{
              fontFamily: "'Georgia','Times New Roman',serif",
              fontSize: "clamp(16px, 2.2vw, 24px)",
              color: "rgba(230,224,210,0.95)",
              lineHeight: 1.7,
              textAlign: "center",
              fontStyle: "italic",
              textShadow: "0 2px 20px rgba(0,0,0,1), 0 0 50px rgba(0,0,0,0.9)",
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
            <div style={{
              width: 200, height: 1,
              background: "linear-gradient(to right, transparent, rgba(144,144,160,0.4), transparent)",
              marginTop: 4,
            }} />
          </div>
        </div>
      )}

      {/* ─── Bottom dialogue panel ────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: 220, zIndex: 200,
        background: "linear-gradient(to top, #000000 40%, rgba(0,0,0,0.95) 80%, rgba(0,0,0,0.0) 100%)",
        display: "flex", flexDirection: "column",
        animation: "slideUp 0.35s cubic-bezier(0.22,0.61,0.36,1) forwards",
      }}>

        {/* Progress bar — thin line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "rgba(255,255,255,0.05)",
        }}>
          <div style={{
            height: "100%",
            width: `${((current + 1) / total) * 100}%`,
            background: `linear-gradient(to right, ${line.color}88, ${line.color})`,
            transition: "width 0.4s ease",
          }} />
        </div>

        {!isNarration && (
          <div key={key} className="cs-line-in" style={{
            flex: 1,
            display: "flex",
            flexDirection: line.side === "left" ? "row" : "row-reverse",
            alignItems: "flex-end",
            padding: "18px 32px 12px",
            gap: 28,
          }}>

            {/* Active speaker portrait */}
            <Portrait line={line} active={true} />

            {/* Text content */}
            <div style={{
              flex: 1,
              display: "flex", flexDirection: "column",
              gap: 10,
              paddingBottom: 2,
              minWidth: 0,
            }}>
              {/* Speaker name + role */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{
                  fontFamily: "'Impact','Arial Black',sans-serif",
                  fontSize: "clamp(15px, 2.2vw, 22px)",
                  color: line.color,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textShadow: `0 0 20px ${line.color}66`,
                }}>
                  {line.speaker}
                </div>
                <div style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}>
                  {line.role}
                </div>
              </div>

              {/* Accent bar */}
              <div style={{
                height: 2, width: 40,
                background: line.color,
                borderRadius: 2,
                marginTop: -4,
                boxShadow: `0 0 8px ${line.color}`,
              }} />

              {/* Dialogue text */}
              <div style={{
                fontFamily: "'Georgia','Times New Roman',serif",
                fontSize: "clamp(14px, 2vw, 20px)",
                color: "#f0ece4",
                lineHeight: 1.65,
                textShadow: "0 1px 10px rgba(0,0,0,0.9)",
                paddingLeft: 16,
                borderLeft: `2px solid ${line.color}55`,
                minHeight: 52,
              }}>
                {displayedText}
                {!done && (
                  <span style={{
                    display: "inline-block", width: 2, height: "0.9em",
                    background: line.color, marginLeft: 3,
                    verticalAlign: "middle",
                    animation: "blink 0.55s step-end infinite",
                  }} />
                )}
              </div>
            </div>

            {/* Inactive (listener) portrait — opposite side */}
            {otherLine && (
              <Portrait line={otherLine} active={false} mirrorX={line.side === "right"} />
            )}
          </div>
        )}

        {isNarration && <div style={{ flex: 1 }} />}

        {/* ── Footer: continue prompt ── */}
        <div style={{
          padding: "6px 32px 14px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
        }}>
          {done && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              animation: "pulse 1.5s ease-in-out infinite",
            }}>
              <kbd style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 4, padding: "2px 8px",
                fontFamily: "monospace", fontSize: 10,
                color: "rgba(255,255,255,0.7)",
                letterSpacing: "0.1em",
              }}>
                E / SPACE
              </kbd>
              <span style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: done ? line.color : "rgba(255,255,255,0.2)",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                transition: "color 0.4s",
              }}>
                {continueLabel} ›
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Mission title card (shown first ~2s of intro) ────────────── */}
      {titleVisible && cutscene.phase === "intro" && (
        <div style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 202,
          textAlign: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            fontFamily: "'Impact','Arial Black',sans-serif",
            fontSize: "clamp(22px, 4vw, 48px)",
            color: "#fff",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            textShadow: "0 0 40px rgba(255,255,255,0.3), 0 4px 20px rgba(0,0,0,1)",
            animation: "titleIn 2.2s ease-in-out forwards",
          }}>
            {cutscene.lines[0]?.speaker === "Marcus Cole" ||
             cutscene.lines[1]?.speaker !== undefined
              ? `MISSION ${cutscene.missionIdx + 1}`
              : ""}
          </div>
        </div>
      )}
    </>
  );
}
