/**
 * CoordinatePanel.jsx
 * Shows lat/lon/elevation when available.
 * Displays "MODULE PENDING" badge when backend returns null.
 */
import { useState } from "react";
import { Panel, HudLabel, AnimNum, SectionHeader, BlinkDot } from "./ui";

function PendingCell({ label, icon }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 3,
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.06)",
      opacity: 0.55,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14, opacity: 0.35 }}>{icon}</span>
        <HudLabel>{label}</HudLabel>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap: 8 }}>
        <span style={{
          fontFamily: "var(--f-hud)", fontSize: 8, letterSpacing: "0.18em",
          color: "rgba(200,200,200,0.3)", background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "3px 10px", borderRadius: 2,
        }}>
          GPS MODULE PENDING
        </span>
      </div>
    </div>
  );
}

function CoordCell({ label, value, unit, dec, color = "#00e5ff", icon, cardinalPos, cardinalNeg }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "14px 16px", borderRadius: 3,
        background: hov ? "rgba(0,200,255,0.05)" : "rgba(0,200,255,0.02)",
        border: "1px solid rgba(0,200,255,0.12)",
        transition: "all 0.2s",
        transform: hov ? "translateY(-2px)" : "none",
      }}
    >
      <div style={{ display:"flex", alignItems:"center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14, opacity: 0.5 }}>{icon}</span>
        <HudLabel>{label}</HudLabel>
      </div>
      <div style={{
        fontFamily: "var(--f-mono)", fontSize: 22, fontWeight: 700,
        color, textShadow: `0 0 14px ${color}`,
      }}>
        <AnimNum value={Math.abs(value ?? 0)} dec={dec} />
        <span style={{ fontSize: 11, marginLeft: 3, opacity: 0.5 }}>{unit}</span>
      </div>
      {cardinalPos && (
        <div style={{ marginTop: 4 }}>
          <span style={{
            fontFamily: "var(--f-hud)", fontSize: 8, letterSpacing: "0.2em",
            color: "rgba(0,200,255,0.4)",
          }}>
            {(value ?? 0) >= 0 ? cardinalPos : cardinalNeg}
          </span>
        </div>
      )}
    </div>
  );
}

// Radar grid — only draws position dot when coords are real
function CoordRadar({ lat, lon, hasData }) {
  const cx = 80, cy = 80, r = 60;
  const nx = hasData ? cx + (lon / 180) * (r * 0.9) : cx;
  const ny = hasData ? cy - (lat / 90)  * (r * 0.9) : cy;

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      {[15,30,45,60].map(rr => (
        <circle key={rr} cx={cx} cy={cy} r={rr} fill="none"
          stroke="rgba(0,200,255,0.1)" strokeWidth="0.6" />
      ))}
      <line x1={cx-64} y1={cy} x2={cx+64} y2={cy}
        stroke="rgba(0,200,255,0.18)" strokeWidth="0.6" />
      <line x1={cx} y1={cy-64} x2={cx} y2={cy+64}
        stroke="rgba(0,200,255,0.18)" strokeWidth="0.6" />
      {/* Sweep line */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - r}
        stroke="rgba(0,200,255,0.35)" strokeWidth="1"
        style={{ transformOrigin:`${cx}px ${cy}px`, animation:"spin 8s linear infinite" }} />
      {/* Position dot — dimmed if no real data */}
      <circle cx={nx} cy={ny} r={5}
        fill={hasData ? "#00e5ff" : "rgba(0,200,255,0.2)"}
        style={{ filter: hasData ? "drop-shadow(0 0 6px #00e5ff)" : "none",
          animation: hasData ? "blink 2s infinite" : "none" }} />
      {hasData && (
        <circle cx={nx} cy={ny} r={12} fill="none"
          stroke="rgba(0,229,255,0.3)" strokeWidth="1" strokeDasharray="3 2" />
      )}
      {[["N",cx-4,10],["S",cx-4,154],["W",4,cy+4],["E",148,cy+4]].map(([l,x,y]) => (
        <text key={l} x={x} y={y} fontSize="8" fontFamily="var(--f-mono)"
          fill="rgba(0,200,255,0.4)">{l}</text>
      ))}
      {!hasData && (
        <text x={cx} y={cy + 26} fontSize="7" fontFamily="var(--f-hud)"
          fill="rgba(255,255,255,0.2)" textAnchor="middle" letterSpacing="2">
          PENDING
        </text>
      )}
    </svg>
  );
}

export default function CoordinatePanel({ result }) {
  const lat  = result?.latitude;
  const lon  = result?.longitude;
  const elev = result?.elevation;
  const hasGPS  = lat !== null && lat !== undefined;
  const hasElev = elev !== null && elev !== undefined;

  return (
    <Panel>
      <div style={{ padding: "18px 18px 0" }}>
        <SectionHeader
          title="Coordinate System"
          subtitle="Lunar surface position data"
          icon="🎯"
        />
      </div>

      <div style={{ padding: "0 18px 18px", display:"flex", gap: 18, flexWrap:"wrap" }}>
        {/* Radar */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: 8 }}>
          <CoordRadar lat={lat ?? 0} lon={lon ?? 0} hasData={hasGPS} />
          <div style={{ display:"flex", alignItems:"center", gap: 6 }}>
            <BlinkDot color={hasGPS ? "#00e5ff" : "rgba(0,200,255,0.25)"} size={6} />
            <HudLabel style={{ fontSize: 8 }}>
              {hasGPS ? "SURFACE LOCK ACQUIRED" : "AWAITING GPS MODULE"}
            </HudLabel>
          </div>
        </div>

        {/* Coordinate cells */}
        <div style={{ flex: 1, minWidth: 200, display:"flex", flexDirection:"column", gap: 10 }}>
          {hasGPS ? (
            <>
              <CoordCell label="LATITUDE"  value={lat} dec={6} unit="°" icon="↕"
                cardinalPos="NORTH" cardinalNeg="SOUTH" />
              <CoordCell label="LONGITUDE" value={lon} dec={6} unit="°" icon="↔"
                color="#00aaff" cardinalPos="EAST" cardinalNeg="WEST" />
            </>
          ) : (
            <>
              <PendingCell label="LATITUDE"  icon="↕" />
              <PendingCell label="LONGITUDE" icon="↔" />
            </>
          )}

          {hasElev ? (
            <CoordCell label="ELEVATION" value={elev} dec={1} unit="m" icon="↑"
              color={elev < 0 ? "#ff8c00" : elev > 1000 ? "#ff3366" : "#00ff88"} />
          ) : (
            <PendingCell label="ELEVATION" icon="↑" />
          )}

          {/* Raw coords row */}
          <div style={{
            padding: "10px 14px", borderRadius: 2,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(0,200,255,0.08)",
          }}>
            <HudLabel style={{ display:"block", marginBottom: 6 }}>RAW COORDINATES</HudLabel>
            <div style={{
              fontFamily: "var(--f-mono)", fontSize: 10,
              color: "rgba(0,200,255,0.6)", lineHeight: 1.8,
            }}>
              {hasGPS ? (
                <>
                  <div>{lat >= 0 ? "+" : ""}{lat.toFixed(6)}° / {lon >= 0 ? "+" : ""}{lon.toFixed(6)}°</div>
                  <div>ELEV: {hasElev ? `${elev >= 0 ? "+" : ""}${elev} m ASL` : "PENDING"}</div>
                </>
              ) : (
                <div style={{ color:"rgba(255,255,255,0.2)" }}>GPS MODULE NOT YET ACTIVE</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
