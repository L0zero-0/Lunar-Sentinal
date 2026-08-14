/**
 * TelemetryPanel.jsx
 * Real-time telemetry: communication delay, signal, status, packet loss.
 * Polls useTelemetry hook every 2.5 seconds.
 */
import { useState } from "react";
import { Panel, HudLabel, BlinkDot, GlowBar, SectionHeader, AnimNum } from "./ui";
import { useTelemetry } from "../hooks/useTelemetry";
import { TELEMETRY_CFG } from "../utils/zoneConfig";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// Arc delay gauge
function DelayGauge({ delay }) {
  const max=360, pct=Math.min(delay/max,1);
  const color=delay<80?"#00ff88":delay<200?"#ffcc00":"#ff3366";
  const r=50,cx=65,cy=65;
  const toXY=deg=>({x:cx+r*Math.cos((deg-90)*Math.PI/180),y:cy+r*Math.sin((deg-90)*Math.PI/180)});
  const arc=(s,e)=>{const a=toXY(s),b=toXY(e),lg=(e-s)>180?1:0;
    return `M${a.x} ${a.y} A${r} ${r} 0 ${lg} 1 ${b.x} ${b.y}`;};
  const fillDeg=-150+pct*300;
  return (
    <svg width="130" height="100" viewBox="0 0 130 100" style={{overflow:"visible"}}>
      <path d={arc(-150,150)} fill="none" stroke="rgba(0,200,255,0.07)" strokeWidth="8"/>
      <path d={arc(-150,150)} fill="none" stroke="rgba(0,255,136,0.18)" strokeWidth="8"
        strokeDasharray={`${(80/360)*2*Math.PI*r} ${2*Math.PI*r}`}/>
      {delay>0&&<path d={arc(-150,Math.min(fillDeg,150))} fill="none" stroke={color}
        strokeWidth="8" strokeLinecap="round"
        style={{filter:`drop-shadow(0 0 5px ${color})`}}/>}
      <text x={cx} y={cy+6} fontSize="16" fontFamily="var(--f-mono)" fontWeight="700"
        fill={color} textAnchor="middle" style={{filter:`drop-shadow(0 0 8px ${color})`}}>
        {delay.toFixed(0)}
      </text>
      <text x={cx} y={cy+20} fontSize="8" fontFamily="var(--f-hud)" letterSpacing="3"
        fill="rgba(0,200,255,0.4)" textAnchor="middle">MS</text>
    </svg>
  );
}

const CTip = ({ active, payload }) => {
  if (!active||!payload?.length) return null;
  const d=TELEMETRY_CFG[payload[0].payload.status];
  return <div style={{ background:"rgba(4,8,20,0.95)",border:"1px solid rgba(0,200,255,0.25)",
    padding:"8px 12px",borderRadius:2,fontFamily:"var(--f-mono)",fontSize:10 }}>
    <div style={{ color:"#00e5ff" }}>{payload[0].value?.toFixed(1)} ms</div>
    <div style={{ color:d?.color||"#fff",marginTop:2 }}>{d?.label}</div>
  </div>;
};

export default function TelemetryPanel() {
  const { current, trendData } = useTelemetry(2500);
  const cfg = TELEMETRY_CFG[current.status] || TELEMETRY_CFG.STABLE;
  const [hov,setHov]=useState(false);

  return (
    <Panel glow={`0 0 24px ${cfg.color}18`}
      style={{ border:`1px solid ${cfg.color}28` }}>
      <div style={{ padding:"18px 18px 0" }}>
        <SectionHeader title="Communication Telemetry"
          subtitle="Camera → Server link monitoring" icon="📡"/>
      </div>

      <div style={{ padding:"0 18px 18px" }}>
        {/* Status row */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
          marginBottom:16,padding:"10px 14px",
          background:`${cfg.color}0d`,border:`1px solid ${cfg.color}28`,borderRadius:3 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <BlinkDot color={cfg.color} size={10}/>
            <span style={{ fontFamily:"var(--f-hud)",fontSize:12,fontWeight:700,
              letterSpacing:"0.22em",color:cfg.color,
              textShadow:`0 0 16px ${cfg.color}` }}>{cfg.label}</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <HudLabel style={{ display:"block",marginBottom:2 }}>UPTIME</HudLabel>
            <span style={{ fontFamily:"var(--f-mono)",fontSize:11,color:"rgba(0,200,255,0.7)" }}>
              {current.uptime}
            </span>
          </div>
        </div>

        {/* Gauge + stats */}
        <div style={{ display:"flex",gap:18,alignItems:"center",marginBottom:16 }}>
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}>
            <DelayGauge delay={current.delay_ms}/>
            <HudLabel style={{ marginTop:-4 }}>DELAY</HudLabel>
          </div>
          <div style={{ flex:1,display:"flex",flexDirection:"column",gap:10 }}>
            {[
              { label:"SIGNAL STRENGTH", value:current.signal, max:100, unit:"%", color:"#00e5ff" },
              { label:"PACKET LOSS",     value:current.packet_loss, max:10, unit:"%", color:"#ff8c00" },
            ].map(({ label,value,max,unit,color })=>(
              <div key={label}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                  <HudLabel>{label}</HudLabel>
                  <span style={{ fontFamily:"var(--f-mono)",fontSize:11,fontWeight:700,color }}>
                    {value.toFixed(2)}{unit}
                  </span>
                </div>
                <GlowBar value={value} max={max} color={color} height={5}/>
              </div>
            ))}
          </div>
        </div>

        {/* Delay area chart */}
        <div>
          <HudLabel style={{ display:"block",marginBottom:8 }}>DELAY TREND (LAST 20 SAMPLES)</HudLabel>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={trendData} margin={{top:2,right:4,bottom:2,left:-24}}>
              <defs>
                <linearGradient id="telGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,200,255,0.05)" strokeDasharray="3 3"/>
              <XAxis dataKey="t" tick={{ fontSize:7,fill:"rgba(0,200,255,0.3)",fontFamily:"var(--f-mono)" }}
                interval={4}/>
              <YAxis tick={{ fontSize:7,fill:"rgba(0,200,255,0.3)",fontFamily:"var(--f-mono)" }}
                domain={[0,360]}/>
              <Tooltip content={<CTip/>}/>
              <Area type="monotoneX" dataKey="delay" stroke={cfg.color} strokeWidth={1.5}
                fill="url(#telGrad)" dot={false} isAnimationActive={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  );
}
