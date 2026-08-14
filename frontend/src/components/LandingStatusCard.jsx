/**
 * LandingStatusCard.jsx
 * Handles Phase 1 (crater + LSI only) + future null fields gracefully.
 * Null values show a "MODULE PENDING" badge instead of crashing or showing 0.
 */
import { useState } from "react";
import { Panel, HudLabel, AnimNum, ZoneBadge, GlowBar } from "./ui";
import { ZONE_CFG } from "../utils/zoneConfig";

// ── Pending badge shown when a module isn't ready yet ────────────────────────
function PendingBadge() {
  return (
    <span style={{
      fontFamily: "var(--f-hud)", fontSize: 8, letterSpacing: "0.18em",
      color: "rgba(200,200,200,0.35)",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      padding: "2px 8px", borderRadius: 2,
    }}>
      MODULE PENDING
    </span>
  );
}

// ── Single metric row ─────────────────────────────────────────────────────────
function MetricRow({ label, value, dec = 2, color, highlight = false, icon, unit = "" }) {
  const [hovered, setHovered] = useState(false);
  const isPending = value === null || value === undefined;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(0,200,255,0.07)",
        background: hovered
          ? highlight ? "rgba(255,204,0,0.06)" : "rgba(0,200,255,0.03)"
          : "transparent",
        transition: "background 0.2s",
        cursor: "default",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom: isPending ? 0 : 8 }}>
        <div style={{ display:"flex", alignItems:"center", gap: 8 }}>
          <span style={{ fontSize: 15, opacity: 0.5 }}>{icon}</span>
          <HudLabel style={{ color: highlight ? "rgba(255,204,0,0.6)" : "rgba(0,200,255,0.5)" }}>
            {label}
          </HudLabel>
          {highlight && !isPending && (
            <span style={{
              fontFamily: "var(--f-hud)", fontSize: 8, letterSpacing: "0.2em",
              color: "#ffcc00", background: "rgba(255,204,0,0.12)",
              border: "1px solid rgba(255,204,0,0.3)",
              padding: "1px 6px", borderRadius: 2,
            }}>WATCH</span>
          )}
        </div>

        {isPending ? (
          <PendingBadge />
        ) : (
          <div style={{
            fontFamily: "var(--f-mono)", fontSize: 20, fontWeight: 700,
            color, textShadow: `0 0 16px ${color}`,
          }}>
            <AnimNum value={value} dec={dec} />
            {unit && <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.6 }}>{unit}</span>}
          </div>
        )}
      </div>

      {/* Progress bar only when value is available */}
      {!isPending && (
        <GlowBar value={value} max={100} color={color} height={4} />
      )}
    </div>
  );
}

// ── LSI arc gauge ─────────────────────────────────────────────────────────────
function LSIGauge({ lsi }) {
  const zc = lsi > 70 ? "#00ff88" : lsi > 40 ? "#ffcc00" : "#ff3366";
  const r = 58, cx = 70, cy = 70;
  const toXY = deg => ({
    x: cx + r * Math.cos((deg - 90) * Math.PI / 180),
    y: cy + r * Math.sin((deg - 90) * Math.PI / 180),
  });
  const arc = (s, e) => {
    const a = toXY(s * 1.8 - 90), b = toXY(e * 1.8 - 90);
    return `M${a.x} ${a.y} A${r} ${r} 0 ${(e - s) > 50 ? 1 : 0} 1 ${b.x} ${b.y}`;
  };
  const needle = toXY(lsi * 1.8 - 90);
  return (
    <svg width="140" height="80" viewBox="0 0 140 80" style={{ overflow: "visible" }}>
      <path d={arc(0, 100)} fill="none" stroke="rgba(0,200,255,0.07)" strokeWidth="8" />
      {[[0,40,"rgba(255,51,102,0.3)"],[40,70,"rgba(255,204,0,0.3)"],[70,100,"rgba(0,255,136,0.3)"]].map(([s,e,c]) => (
        <path key={s} d={arc(s, e)} fill="none" stroke={c} strokeWidth="8" />
      ))}
      {lsi > 0 && (
        <path d={arc(0, lsi)} fill="none" stroke={zc} strokeWidth="8"
          strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${zc})` }} />
      )}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y}
        stroke="white" strokeWidth="2" strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px white)" }} />
      <circle cx={cx} cy={cy} r="4" fill="#00e5ff"
        style={{ filter: "drop-shadow(0 0 5px #00e5ff)" }} />
      {[["0",14,76],["50",68,16],["100",118,76]].map(([l,x,y]) => (
        <text key={l} x={x} y={y} fontSize="7" fontFamily="var(--f-mono)"
          fill="rgba(0,200,255,0.4)" textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
}

// ── Module readiness strip ────────────────────────────────────────────────────
function ModuleStrip({ modulesReady }) {
  if (!modulesReady) return null;
  const modules = [
    { key: "crater_detection", label: "CRATERS" },
    { key: "slope",            label: "SLOPE"   },
    { key: "roughness",        label: "ROUGHNESS"},
    { key: "elevation",        label: "ELEVATION"},
    { key: "gps",              label: "GPS"      },
  ];
  return (
    <div style={{
      display: "flex", gap: 6, flexWrap: "wrap",
      padding: "10px 18px",
      borderTop: "1px solid rgba(0,200,255,0.07)",
    }}>
      {modules.map(({ key, label }) => {
        const active = modulesReady[key];
        return (
          <div key={key} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 2,
            background: active ? "rgba(0,255,136,0.07)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${active ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}>
            <span style={{ fontSize: 8, color: active ? "#00ff88" : "rgba(255,255,255,0.2)" }}>
              {active ? "●" : "○"}
            </span>
            <span style={{
              fontFamily: "var(--f-hud)", fontSize: 7, letterSpacing: "0.18em",
              color: active ? "rgba(0,255,136,0.7)" : "rgba(255,255,255,0.2)",
            }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingStatusCard({ result }) {
  const zone = result?.zone || "SAFE";
  const cfg  = ZONE_CFG[zone];
  const lsi  = result?.lsi ?? 0;
  const isRisky = zone === "RISKY";

  return (
    <Panel glow={cfg?.glow}
      style={{ border: `1px solid ${cfg?.border || "rgba(0,200,255,0.14)"}` }}>

      {/* Header */}
      <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(0,200,255,0.08)" }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", flexWrap:"wrap", gap: 12 }}>
          <div>
            <HudLabel style={{ marginBottom: 8, display: "block" }}>
              LANDING ZONE ASSESSMENT
            </HudLabel>
            <ZoneBadge zone={zone} cfg={cfg} large />
          </div>
          <div style={{ textAlign: "right" }}>
            <HudLabel style={{ display: "block", marginBottom: 4 }}>LSI SCORE</HudLabel>
            <div style={{
              fontFamily: "var(--f-mono)", fontSize: 44, fontWeight: 700,
              lineHeight: 1, color: cfg?.color,
              textShadow: `0 0 28px ${cfg?.color}, 0 0 56px ${cfg?.color}44`,
            }}>
              <AnimNum value={lsi} dec={1} />
            </div>
            <HudLabel style={{ marginTop: 4, display: "block" }}>/ 100 pts</HudLabel>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"center", marginTop: 12 }}>
          <LSIGauge lsi={lsi} />
        </div>

        {/* LSI formula — shows "PENDING" for missing values */}
        <div style={{
          padding: "7px 12px", marginTop: 8, borderRadius: 2,
          background: "rgba(0,200,255,0.04)",
          border: "1px solid rgba(0,200,255,0.1)",
          fontFamily: "var(--f-mono)", fontSize: 10,
          color: "rgba(0,200,255,0.45)", textAlign: "center",
        }}>
          {result?.slope !== null && result?.roughness !== null ? (
            <>
              LSI = 100 − (0.5×{result?.crater_count ?? 0} + 0.2×{result?.slope ?? 0} + 0.3×{result?.roughness ?? 0})
              = <span style={{ color: "#00e5ff", fontWeight: 700 }}>{lsi}</span>
            </>
          ) : (
            <>
              LSI = 100 − (0.5×{result?.crater_count ?? 0} + <span style={{ color:"rgba(255,255,255,0.25)" }}>0.2×[slope] + 0.3×[roughness]</span>)
              &nbsp;→ <span style={{ color:"#00e5ff", fontWeight:700 }}>{lsi}</span>
              <span style={{ color:"rgba(255,255,255,0.25)", marginLeft: 8 }}>
                (slope/roughness pending)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Risky zone warning banner */}
      {isRisky && (
        <div style={{
          padding: "8px 18px",
          background: "rgba(255,204,0,0.07)",
          borderBottom: "1px solid rgba(255,204,0,0.2)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 14, animation: "blink 1.2s infinite" }}>⚠</span>
          <span style={{
            fontFamily: "var(--f-hud)", fontSize: 9,
            letterSpacing: "0.22em", color: "#ffcc00", textTransform: "uppercase",
          }}>
            CAUTION — ELEVATED CRATER DENSITY. VERIFY BEFORE DESCENT.
          </span>
        </div>
      )}

      {/* Metric rows */}
      <MetricRow
        label="Crater Count" icon="◎"
        value={result?.crater_count ?? null}
        dec={0} color="#ff3366"
      />
      <MetricRow
        label="Surface Slope" icon="⟋"
        value={result?.slope ?? null}
        dec={2} color={isRisky ? "#ffcc00" : "#ff8c00"}
        highlight={isRisky && (result?.slope ?? 0) > 35}
      />
      <MetricRow
        label="Surface Roughness" icon="∿"
        value={result?.roughness ?? null}
        dec={2} color={isRisky ? "#ffcc00" : "#ff8c00"}
        highlight={isRisky && (result?.roughness ?? 0) > 45}
      />

      {/* Module readiness strip */}
      <ModuleStrip modulesReady={result?.modules_ready} />

      {/* Filename */}
      {result?.filename && (
        <div style={{ padding: "8px 18px", display:"flex", justifyContent:"space-between" }}>
          <HudLabel>Source</HudLabel>
          <span style={{ fontFamily:"var(--f-mono)", fontSize:10, color:"rgba(0,200,255,0.6)" }}>
            {result.filename}
          </span>
        </div>
      )}
    </Panel>
  );
}
