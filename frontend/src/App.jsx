/**
 * App.jsx — Root application shell
 */
import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import { LiveClock, BlinkDot, Panel, HudLabel } from "./components/ui";
import { HISTORY_SEED } from "./data/mockData";
import { ZONE_CFG } from "./utils/zoneConfig";
import LsiMapViewer from "./components/LsiMapViewer";

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Exo+2:ital,wght@0,300;0,400;0,700;0,900;1,300&family=JetBrains+Mono:wght@300;400;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --black:#000000; --bg:#020510; --surface:#060b1a;
    --f-hud:'Orbitron',sans-serif; --f-body:'Exo 2',sans-serif; --f-mono:'JetBrains Mono',monospace;
  }
  html,body,#root { height:100%; }
  body { background:var(--black); color:#fff; font-family:var(--f-body);
    overflow-x:hidden; cursor:crosshair; -webkit-font-smoothing:antialiased; }
  body::before { content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
    background-image:
      radial-gradient(1px 1px at  7% 11%,rgba(255,255,255,0.85) 0%,transparent 100%),
      radial-gradient(1px 1px at 22% 54%,rgba(255,255,255,0.5) 0%,transparent 100%),
      radial-gradient(1px 1px at 38% 27%,rgba(0,200,255,0.75) 0%,transparent 100%),
      radial-gradient(1px 1px at 51% 77%,rgba(255,255,255,0.45) 0%,transparent 100%),
      radial-gradient(1px 1px at 67% 17%,rgba(255,255,255,0.65) 0%,transparent 100%),
      radial-gradient(1px 1px at 79% 62%,rgba(0,200,255,0.55) 0%,transparent 100%),
      radial-gradient(1px 1px at 93%  8%,rgba(255,255,255,0.75) 0%,transparent 100%),
      radial-gradient(1px 1px at 14% 87%,rgba(255,255,255,0.4) 0%,transparent 100%),
      radial-gradient(1.5px 1.5px at 44% 44%,rgba(0,200,255,0.85) 0%,transparent 100%),
      radial-gradient(1px 1px at 84% 73%,rgba(255,255,255,0.55) 0%,transparent 100%),
      radial-gradient(1px 1px at  3% 38%,rgba(255,255,255,0.5) 0%,transparent 100%),
      radial-gradient(1px 1px at 60% 91%,rgba(255,140,0,0.45) 0%,transparent 100%),
      radial-gradient(1px 1px at 95% 51%,rgba(255,255,255,0.65) 0%,transparent 100%),
      radial-gradient(1px 1px at 30%  5%,rgba(255,255,255,0.5) 0%,transparent 100%),
      radial-gradient(1px 1px at 56% 33%,rgba(255,255,255,0.35) 0%,transparent 100%),
      radial-gradient(1px 1px at 72% 82%,rgba(0,200,255,0.4) 0%,transparent 100%),
      radial-gradient(1px 1px at 18% 66%,rgba(255,255,255,0.45) 0%,transparent 100%),
      radial-gradient(1px 1px at 87% 30%,rgba(255,255,255,0.5) 0%,transparent 100%); }
  body::after { content:''; position:fixed; inset:0; z-index:1; pointer-events:none;
    background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.042) 3px,rgba(0,0,0,0.042) 4px); }
  ::-webkit-scrollbar { width:3px; height:3px; }
  ::-webkit-scrollbar-track { background:#000; }
  ::-webkit-scrollbar-thumb { background:rgba(0,200,255,0.4); border-radius:2px; }
  @keyframes blink { 0%,100%{opacity:1} 47%{opacity:0.08} 53%{opacity:0.08} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes spinFwd { to{transform:rotate(360deg)} }
  @keyframes spinRev { to{transform:rotate(-360deg)} }
  @keyframes floatBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
  @keyframes scanBeam { 0%{top:-3px;opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{top:100%;opacity:0} }
  @keyframes progressGlow {
    0%,100%{box-shadow:0 0 8px #00c8ff,0 0 18px rgba(0,200,255,0.28);}
    50%{box-shadow:0 0 16px #00e5ff,0 0 36px rgba(0,229,255,0.48);} }
  @keyframes glitchTitle {
    0%,93%,100%{clip-path:none;transform:none}
    94%{clip-path:polygon(0 22%,100% 22%,100% 27%,0 27%);transform:translate(-3px,0)}
    96%{clip-path:polygon(0 56%,100% 56%,100% 62%,0 62%);transform:translate(3px,0)}
    98%{clip-path:polygon(0 40%,100% 40%,100% 46%,0 46%);transform:translate(-1px,0)} }
  @keyframes pulseGlow {
    0%,100%{text-shadow:0 0 20px rgba(0,200,255,0.4);}
    50%{text-shadow:0 0 36px rgba(0,200,255,0.7),0 0 60px rgba(0,200,255,0.2);} }
`;

function InjectStyles() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

function StatsBanner({ history }) {
  const safe   = history.filter(h=>h.zone==="SAFE").length;
  const risky  = history.filter(h=>h.zone==="RISKY").length;
  const unsafe = history.filter(h=>h.zone==="UNSAFE").length;
  const avgLsi = history.length ? (history.reduce((a,b)=>a+b.lsi,0)/history.length).toFixed(1) : "—";
  const items = [
    {label:"TOTAL SCANS",  value:history.length, color:"#00e5ff"},
    {label:"SAFE ZONES",   value:safe,           color:"#00ff88"},
    {label:"RISKY ZONES",  value:risky,          color:"#ffcc00"},
    {label:"UNSAFE ZONES", value:unsafe,         color:"#ff3366"},
    {label:"AVG LSI",      value:avgLsi,         color:"#00e5ff"},
  ];
  return (
    <div style={{borderBottom:"1px solid rgba(0,200,255,0.08)",background:"rgba(0,0,0,0.6)"}}>
      <div style={{maxWidth:1440,margin:"0 auto",padding:"8px 24px",display:"flex",gap:0,overflowX:"auto"}}>
        {items.map(({label,value,color},i)=>(
          <div key={label} style={{flex:1,minWidth:120,padding:"6px 20px",
            borderRight:i<items.length-1?"1px solid rgba(0,200,255,0.08)":"none",textAlign:"center"}}>
            <div style={{fontFamily:"var(--f-mono)",fontSize:18,fontWeight:700,color,textShadow:`0 0 14px ${color}`,lineHeight:1}}>{value}</div>
            <div style={{fontFamily:"var(--f-hud)",fontSize:7,letterSpacing:"0.24em",color:"rgba(0,200,255,0.35)",marginTop:3}}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ history }) {
  return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      <Panel>
        <div style={{padding:"20px 22px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <div style={{fontFamily:"var(--f-hud)",fontSize:13,fontWeight:700,letterSpacing:"0.2em",color:"white",marginBottom:4}}>
                MISSION TELEMETRY ARCHIVE
              </div>
              <HudLabel>{history.length} records · ordered most recent first</HudLabel>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <BlinkDot color="#00ff88"/>
              <HudLabel>DATABASE CONNECTED</HudLabel>
            </div>
          </div>
        </div>
        <div style={{overflowX:"auto",padding:"0 0 22px"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
            <thead>
              <tr style={{borderBottom:"1px solid rgba(0,200,255,0.1)"}}>
                {["#","File","Craters","Slope","Roughness","Elevation","Lat","Lon","LSI","Zone","Time"].map(h=>(
                  <th key={h} style={{padding:"9px 14px",textAlign:"left",fontFamily:"var(--f-hud)",fontSize:8,
                    letterSpacing:"0.22em",color:"rgba(0,200,255,0.32)",fontWeight:600,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((r,i)=>{
                const cfg=ZONE_CFG[r.zone];
                return (
                  <tr key={r.id} style={{borderBottom:"1px solid rgba(0,200,255,0.05)",
                    transition:"background 0.2s",animation:`fadeUp 0.4s ease ${i*22}ms both`}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(0,200,255,0.03)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:9,color:"rgba(0,200,255,0.28)"}}>#{i+1}</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:9,color:"rgba(0,200,255,0.75)",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.filename}</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:11,color:"#ff3366",fontWeight:700}}>{r.crater_count}</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:10,color:"rgba(200,230,240,0.5)"}}>{r.slope.toFixed(2)}</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:10,color:"rgba(200,230,240,0.5)"}}>{r.roughness.toFixed(2)}</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:10,color:"rgba(200,230,240,0.5)"}}>{r.elevation}m</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:9,color:"rgba(0,200,255,0.5)"}}>{(r.latitude||0).toFixed(4)}°</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:9,color:"rgba(0,200,255,0.5)"}}>{(r.longitude||0).toFixed(4)}°</td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:12,fontWeight:700,color:cfg?.color,textShadow:`0 0 10px ${cfg?.color}`}}>{r.lsi.toFixed(1)}</td>
                    <td style={{padding:"9px 14px"}}>
                      <span style={{fontFamily:"var(--f-hud)",fontSize:8,letterSpacing:"0.18em",color:cfg?.color,padding:"3px 8px",background:cfg?.dim,border:`1px solid ${cfg?.border}`,borderRadius:2}}>{r.zone}</span>
                    </td>
                    <td style={{padding:"9px 14px",fontFamily:"var(--f-mono)",fontSize:8,color:"rgba(0,200,255,0.28)",whiteSpace:"nowrap"}}>
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export default function App() {
  const [tab, setTab]       = useState("analyze");
  const [history, setHistory] = useState(HISTORY_SEED);

  return (
    <>
      <InjectStyles/>
      <div style={{position:"relative",zIndex:2,minHeight:"100vh",display:"flex",flexDirection:"column"}}>

        {/* HEADER */}
        <header style={{borderBottom:"1px solid rgba(0,200,255,0.1)",background:"rgba(0,0,0,0.98)",
          backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:100}}>
          <div style={{maxWidth:1440,margin:"0 auto",padding:"0 24px",height:66,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>

            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <svg viewBox="0 0 42 42" width="38" height="38">
                <circle cx="21" cy="21" r="19" stroke="#00e5ff" strokeWidth="0.8" fill="rgba(0,200,255,0.05)"/>
                <circle cx="21" cy="21" r="12" stroke="rgba(0,200,255,0.3)" strokeWidth="0.5" fill="none"/>
                <circle cx="21" cy="21" r="4" fill="#00e5ff" style={{filter:"drop-shadow(0 0 5px #00e5ff)"}}/>
                {[[14,16,4],[23,13,3.2],[16,26,3],[25,24,2.5]].map(([x,y,r],i)=>(
                  <circle key={i} cx={x} cy={y} r={r} stroke="rgba(0,200,255,0.4)" strokeWidth="0.6" fill="none"/>
                ))}
                <ellipse cx="21" cy="21" rx="19" ry="7" fill="none"
                  stroke="rgba(0,200,255,0.15)" strokeWidth="0.6" transform="rotate(-30 21 21)"/>
              </svg>
              <div>
                <div style={{fontFamily:"var(--f-hud)",fontWeight:700,fontSize:12,letterSpacing:"0.22em",color:"white",
                  animation:"glitchTitle 12s infinite,pulseGlow 4s ease-in-out infinite"}}>
                  LUNAR SAFETY SYSTEM
                </div>
                <div style={{fontFamily:"var(--f-hud)",fontSize:7,letterSpacing:"0.24em",color:"rgba(0,200,255,0.4)",textTransform:"uppercase",marginTop:2}}>
                  AI HAZARD DETECTION · MISSION CONTROL v2.0
                </div>
              </div>
            </div>

            <nav style={{display:"flex",gap:2}}>
              {[{k:"analyze",l:"⬡ ANALYZE"},{k:"history",l:"◈ TELEMETRY"},{k:"hazardmap",l:"◈ HAZARD MAP"}].map(({k,l})=>(
                <button key={k} onClick={()=>setTab(k)} style={{
                  fontFamily:"var(--f-hud)",fontSize:10,fontWeight:700,letterSpacing:"0.22em",
                  padding:"9px 24px",background:"transparent",cursor:"pointer",border:"none",
                  borderBottom:`2px solid ${tab===k?"#00e5ff":"transparent"}`,
                  color:tab===k?"#00e5ff":"rgba(200,230,240,0.3)",
                  transition:"all 0.2s",textTransform:"uppercase"}}>{l}</button>
              ))}
            </nav>

            <div style={{display:"flex",alignItems:"center",gap:18}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <BlinkDot color="#00ff88"/>
                <span style={{fontFamily:"var(--f-hud)",fontSize:8,letterSpacing:"0.22em",color:"rgba(0,200,255,0.45)",textTransform:"uppercase"}}>
                  MISSION CONTROL ONLINE
                </span>
              </div>
              <LiveClock/>
            </div>
          </div>
        </header>

        <StatsBanner history={history}/>

        <main style={{flex:1,maxWidth:1440,width:"100%",margin:"0 auto",padding:"28px 24px"}}>
          {tab==="analyze" && <Dashboard onNewResult={r=>setHistory(p=>[r,...p])}/>}
          {tab==="history" && <HistoryTab history={history}/>}
          {tab==="hazardmap" && (
            <div style={{animation:"fadeIn 0.4s ease"}}>
              <div style={{marginBottom:16}}>
                <div style={{fontFamily:"var(--f-hud)",fontSize:13,fontWeight:700,letterSpacing:"0.2em",color:"white",marginBottom:4}}>
                  SOUTH POLE LSI HAZARD MAP
                </div>
                <div style={{fontFamily:"var(--f-hud)",fontSize:7,letterSpacing:"0.22em",color:"rgba(0,200,255,0.4)"}}>
                  LANDING SAFETY INDEX · LOLA DEM · SLOPE + TRI + TPI COMPOSITE · CLICK MARKERS FOR DETAILS
                </div>
              </div>
              <LsiMapViewer />
            </div>
          )}
        </main>

        <footer style={{borderTop:"1px solid rgba(0,200,255,0.07)",padding:"12px 24px",
          background:"rgba(0,0,0,0.99)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontFamily:"var(--f-hud)",fontSize:8,letterSpacing:"0.22em",color:"rgba(0,200,255,0.22)"}}>
            LUNAR LANDING SAFETY SYSTEM © 2025 — ALL RIGHTS RESERVED
          </span>
          <div style={{display:"flex",gap:18}}>
            {["React","Vite","Recharts","FastAPI","YOLOv8","OpenCV","PostgreSQL"].map(t=>(
              <span key={t} style={{fontFamily:"var(--f-hud)",fontSize:7,letterSpacing:"0.18em",color:"rgba(0,200,255,0.18)"}}>{t}</span>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
}
