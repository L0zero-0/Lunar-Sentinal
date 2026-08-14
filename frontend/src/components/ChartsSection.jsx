/**
 * ChartsSection.jsx
 * Three responsive Recharts panels:
 *   1) LSI trend line chart over scan history
 *   2) Radar chart: slope vs roughness vs elevation (normalised)
 *   3) Area chart for telemetry delay (imported from TelemetryPanel hook)
 */
import { Panel, HudLabel, SectionHeader } from "./ui";
import { ZONE_CFG } from "../utils/zoneConfig";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, Legend,
} from "recharts";
import { useTelemetry } from "../hooks/useTelemetry";

// ─── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTip = ({ active, payload, labelKey }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:"rgba(4,8,22,0.96)",border:"1px solid rgba(0,200,255,0.25)",
      padding:"8px 12px",borderRadius:2,fontFamily:"var(--f-mono)",fontSize:10 }}>
      {payload.map((p,i)=>(
        <div key={i} style={{ color:p.color||"#00e5ff",marginBottom:2 }}>
          {p.name}: {typeof p.value==="number"?p.value.toFixed(2):p.value}
        </div>
      ))}
    </div>
  );
};

// ─── LSI Line chart ──────────────────────────────────────────────────────────
export function LSITrendChart({ history }) {
  const data = [...history].reverse().map(r=>({
    name: r.filename.split(".")[0].slice(0,12),
    lsi:  r.lsi,
    zone: r.zone,
  }));

  return (
    <Panel>
      <div style={{ padding:"18px 18px 0" }}>
        <SectionHeader title="LSI Trend Analysis" subtitle="Landing safety index over all scans" icon="📈"/>
      </div>
      <div style={{ padding:"0 12px 18px" }}>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={data} margin={{top:4,right:8,bottom:4,left:-20}}>
            <defs>
              <filter id="lsiGlow">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke="rgba(0,200,255,0.05)" strokeDasharray="4 4"/>
            <XAxis dataKey="name"
              tick={{ fontSize:8,fill:"rgba(0,200,255,0.35)",fontFamily:"var(--f-mono)" }}/>
            <YAxis domain={[0,100]}
              tick={{ fontSize:8,fill:"rgba(0,200,255,0.35)",fontFamily:"var(--f-mono)" }}/>
            <Tooltip content={<CustomTip/>}/>
            <ReferenceLine y={70} stroke="rgba(0,255,136,0.25)" strokeDasharray="6 4"
              label={{ value:"SAFE",fill:"rgba(0,255,136,0.4)",fontSize:8,fontFamily:"var(--f-mono)" }}/>
            <ReferenceLine y={40} stroke="rgba(255,51,102,0.25)" strokeDasharray="6 4"
              label={{ value:"UNSAFE",fill:"rgba(255,51,102,0.4)",fontSize:8,fontFamily:"var(--f-mono)" }}/>
            <Line type="monotone" dataKey="lsi" stroke="#00e5ff" strokeWidth={2.5}
              filter="url(#lsiGlow)"
              dot={({ cx,cy,payload }) => (
                <circle key={cx} cx={cx} cy={cy} r={5}
                  fill={ZONE_CFG[payload.zone]?.color||"#00e5ff"}
                  stroke="#000" strokeWidth={1}
                  style={{ filter:`drop-shadow(0 0 4px ${ZONE_CFG[payload.zone]?.color})` }}/>
              )}
              activeDot={{ r:6, stroke:"#00e5ff", strokeWidth:2 }}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ─── Radar chart ─────────────────────────────────────────────────────────────
export function TerrainRadarChart({ result }) {
  const norm = (v,max) => +(Math.min((v/max)*100,100)).toFixed(1);
  const data = result ? [
    { metric:"Safety",    val: result.lsi },
    { metric:"Slope OK",  val: Math.max(0,100-result.slope) },
    { metric:"Smooth",    val: Math.max(0,100-result.roughness) },
    { metric:"ClearZone", val: Math.max(0,100-result.crater_count*11) },
    { metric:"Elevation", val: norm(Math.abs(result.elevation),4200) },
  ] : [];

  const zc = result ? (ZONE_CFG[result.zone]?.color||"#00e5ff") : "#00e5ff";

  return (
    <Panel>
      <div style={{ padding:"18px 18px 0" }}>
        <SectionHeader title="Terrain Profile Radar"
          subtitle="Slope · Roughness · Elevation · Clearance" icon="🔭"/>
      </div>
      <div style={{ padding:"0 12px 18px" }}>
        {result ? (
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={data} margin={{top:4,right:20,bottom:4,left:20}}>
              <PolarGrid stroke="rgba(0,200,255,0.1)"/>
              <PolarAngleAxis dataKey="metric"
                tick={{ fontSize:9,fill:"rgba(0,200,255,0.5)",fontFamily:"var(--f-hud)",letterSpacing:"0.1em" }}/>
              <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/>
              <Radar name="Terrain" dataKey="val" stroke={zc} fill={zc} fillOpacity={0.18}
                dot={{ fill:zc, r:3, strokeWidth:0 }}/>
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height:210,display:"flex",alignItems:"center",justifyContent:"center",
            fontFamily:"var(--f-hud)",fontSize:10,letterSpacing:"0.2em",color:"rgba(0,200,255,0.25)" }}>
            AWAITING ANALYSIS DATA
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── Telemetry area chart ─────────────────────────────────────────────────────
export function TelemetryAreaChart() {
  const { trendData, current } = useTelemetry(2500);
  const color = current.delay_ms<80?"#00ff88":current.delay_ms<200?"#ffcc00":"#ff3366";

  return (
    <Panel>
      <div style={{ padding:"18px 18px 0" }}>
        <SectionHeader title="Comm Delay Chart"
          subtitle="Real-time camera→server latency" icon="📶"/>
      </div>
      <div style={{ padding:"0 12px 18px" }}>
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={trendData} margin={{top:4,right:8,bottom:4,left:-20}}>
            <defs>
              <linearGradient id="delayGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,200,255,0.05)" strokeDasharray="4 4"/>
            <XAxis dataKey="t" tick={{ fontSize:8,fill:"rgba(0,200,255,0.3)",fontFamily:"var(--f-mono)" }} interval={3}/>
            <YAxis domain={[0,380]} tick={{ fontSize:8,fill:"rgba(0,200,255,0.3)",fontFamily:"var(--f-mono)" }}/>
            <Tooltip content={<CustomTip/>}/>
            <ReferenceLine y={80}  stroke="rgba(0,255,136,0.2)"  strokeDasharray="4 4"/>
            <ReferenceLine y={200} stroke="rgba(255,204,0,0.2)"  strokeDasharray="4 4"/>
            <Area type="monotone" dataKey="delay" stroke={color} strokeWidth={2}
              fill="url(#delayGrad)" dot={false} name="Delay (ms)" isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
