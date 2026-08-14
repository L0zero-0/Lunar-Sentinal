/**
 * Dashboard.jsx
 * Three input mode tabs:
 *  🛸 IMAGE UPLOAD  — upload a still image, get YOLO annotated result
 *  📡 LIVE STREAM   — MJPEG stream from /video-feed with bounding boxes
 *  📷 CAMERA        — browser getUserMedia live camera
 */
import { useRef } from "react";
import { useAnalysis, PHASES } from "../hooks/useAnalysis";
import { Panel, HudLabel, GlowBar, BlinkDot, SectionHeader } from "./ui";
import LandingStatusCard from "./LandingStatusCard";
import CoordinatePanel   from "./CoordinatePanel";
import TelemetryPanel    from "./TelemetryPanel";
import LiveStreamPanel   from "./LiveStreamPanel";
import { LSITrendChart, TerrainRadarChart, TelemetryAreaChart } from "./ChartsSection";
import { ZONE_CFG } from "../utils/zoneConfig";
import { useState as useDashState } from "react";

// ── Loading animation ─────────────────────────────────────────────────────────
function LoadingOverlay({ progress, stepText }) {
  return (
    <div style={{padding:"20px 18px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <div style={{position:"relative",width:38,height:38,flexShrink:0}}>
          {[0,1].map(i=>(
            <div key={i} style={{position:"absolute",inset:i*9,borderRadius:"50%",
              border:`1.5px solid rgba(0,200,255,${0.7-i*0.2})`,
              borderTopColor:i===0?"#00e5ff":"transparent",
              borderBottomColor:i===1?"rgba(0,200,255,0.4)":"transparent",
              animation:`${i===0?"spinFwd":"spinRev"} ${1.5+i*0.5}s linear infinite`}}/>
          ))}
        </div>
        <div>
          <div style={{fontFamily:"var(--f-hud)",fontSize:11,fontWeight:700,
            letterSpacing:"0.2em",color:"#00e5ff",marginBottom:3,
            animation:"blink 1.5s infinite",textShadow:"0 0 16px rgba(0,200,255,0.6)"}}>
            ANALYZING TERRAIN
          </div>
          <div style={{fontFamily:"var(--f-hud)",fontSize:8,letterSpacing:"0.2em",
            color:"rgba(0,200,255,0.45)",animation:"blink 2.2s infinite"}}>{stepText}</div>
        </div>
      </div>
      <GlowBar value={progress} max={100} color="#00c8ff" height={8} animated/>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <HudLabel>PROCESSING</HudLabel>
        <span style={{fontFamily:"var(--f-mono)",fontSize:10,color:"#00e5ff"}}>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}

// ── Scan section (image viewer with zoom + pan) ───────────────────────────────
function ScanSection({ preview, annotatedImg, isLoading }) {
  const [zoom, setZoom] = useDashState(1);
  const [pan,  setPan]  = useDashState({x:0,y:0});
  const dragRef = useRef({dragging:false,startX:0,startY:0,panX:0,panY:0});

  const onWheel = e => {
    e.preventDefault();
    setZoom(z=>Math.min(4,Math.max(1,z-e.deltaY*0.001)));
  };
  const onMouseDown = e => {
    dragRef.current={dragging:true,startX:e.clientX,startY:e.clientY,panX:pan.x,panY:pan.y};
  };
  const onMouseMove = e => {
    if(!dragRef.current.dragging) return;
    setPan({x:dragRef.current.panX+(e.clientX-dragRef.current.startX),
             y:dragRef.current.panY+(e.clientY-dragRef.current.startY)});
  };
  const onMouseUp=()=>{ dragRef.current.dragging=false; };
  const resetZoom=()=>{ setZoom(1); setPan({x:0,y:0}); };
  const displaySrc = annotatedImg||preview;

  return (
    <div style={{position:"relative",width:"100%",borderRadius:4,
      border:`1px solid ${annotatedImg?"rgba(0,255,136,0.3)":isLoading?"rgba(0,200,255,0.3)":"rgba(0,200,255,0.12)"}`,
      transition:"border-color 0.6s",background:"#000",overflow:"hidden"}}>

      {/* Zoom controls */}
      <div style={{position:"absolute",top:10,right:10,zIndex:30,display:"flex",gap:4,alignItems:"center"}}>
        {[{l:"−",fn:()=>setZoom(z=>Math.max(1,+(z-0.5).toFixed(1)))},
          {l:"+",fn:()=>setZoom(z=>Math.min(4,+(z+0.5).toFixed(1)))},
          {l:"⊡",fn:resetZoom}].map(({l,fn})=>(
          <button key={l} onClick={fn}
            style={{fontFamily:"var(--f-mono)",fontSize:13,fontWeight:700,
              width:26,height:26,borderRadius:3,cursor:"pointer",
              background:"rgba(0,0,0,0.8)",color:"#00e5ff",
              border:"1px solid rgba(0,200,255,0.35)",lineHeight:1,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,200,255,0.2)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.8)";}}>
            {l}
          </button>
        ))}
        <span style={{fontFamily:"var(--f-mono)",fontSize:9,color:"rgba(0,200,255,0.5)",
          background:"rgba(0,0,0,0.7)",padding:"3px 7px",borderRadius:2,
          border:"1px solid rgba(0,200,255,0.2)"}}>{zoom.toFixed(1)}×</span>
      </div>

      {/* Viewport */}
      <div onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        style={{width:"100%",minHeight:300,display:"flex",alignItems:"center",
          justifyContent:"center",cursor:zoom>1?"grab":"default",
          overflow:"hidden",userSelect:"none"}}>
        {displaySrc ? (
          <img src={displaySrc} alt={annotatedImg?"annotated":"uploaded"} draggable={false}
            style={{maxWidth:"100%",maxHeight:"70vh",width:"auto",height:"auto",
              objectFit:"contain", display:"block",
              transform:`scale(${zoom}) translate(${pan.x/zoom}px,${pan.y/zoom}px)`,
              transformOrigin:"center center",
              transition:zoom===1?"transform 0.3s ease":"none",
              animation:annotatedImg?"fadeIn 0.9s ease":"none"}}/>
        ) : (
          <div style={{padding:40,color:"rgba(0,200,255,0.2)",
            fontFamily:"var(--f-hud)",fontSize:10,letterSpacing:"0.2em"}}>NO IMAGE</div>
        )}
      </div>

      {/* Scan grid + beam while loading */}
      {isLoading && (<>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",
          backgroundImage:`linear-gradient(rgba(0,200,255,0.05) 1px,transparent 1px),
            linear-gradient(90deg,rgba(0,200,255,0.05) 1px,transparent 1px)`,
          backgroundSize:"36px 36px"}}/>
        <div style={{position:"absolute",left:0,right:0,height:2,
          background:"linear-gradient(90deg,transparent,#00e5ff,transparent)",
          boxShadow:"0 0 14px #00e5ff",
          animation:"scanBeam 1.6s ease-in-out infinite",
          pointerEvents:"none",zIndex:10}}/>
      </>)}

      {/* Corner brackets */}
      {[{top:8,left:8,borderTop:"2px solid #00e5ff",borderLeft:"2px solid #00e5ff"},
        {top:8,right:8,borderTop:"2px solid #00e5ff",borderRight:"2px solid #00e5ff"},
        {bottom:8,left:8,borderBottom:"2px solid #00e5ff",borderLeft:"2px solid #00e5ff"},
        {bottom:8,right:8,borderBottom:"2px solid #00e5ff",borderRight:"2px solid #00e5ff"},
      ].map((s,i)=>(
        <div key={i} style={{position:"absolute",width:16,height:16,pointerEvents:"none",zIndex:15,...s}}/>
      ))}

      {/* Status badge */}
      <div style={{position:"absolute",top:10,left:10,zIndex:20,
        display:"flex",alignItems:"center",gap:6,background:"rgba(0,0,0,0.82)",
        border:`1px solid ${annotatedImg?"rgba(0,255,136,0.5)":"rgba(0,200,255,0.4)"}`,
        padding:"4px 10px",borderRadius:2}}>
        <BlinkDot color={annotatedImg?"#00ff88":"#00e5ff"} size={7}/>
        <span style={{fontFamily:"var(--f-hud)",fontSize:8,letterSpacing:"0.18em",
          color:annotatedImg?"#00ff88":"#00e5ff"}}>
          {annotatedImg?"YOLO ANNOTATION COMPLETE":isLoading?"SCANNING...":"TARGET ACQUIRED"}
        </span>
      </div>
      {annotatedImg && (
        <div style={{position:"absolute",top:10,right:68,zIndex:20,
          background:"rgba(0,0,0,0.82)",border:"1px solid rgba(0,255,136,0.3)",
          padding:"4px 10px",borderRadius:2,animation:"fadeIn 0.5s ease"}}>
          <span style={{fontFamily:"var(--f-mono)",fontSize:8,color:"#00ff88"}}>CRATER BOXES RENDERED</span>
        </div>
      )}
    </div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({ preview, onFile, disabled }) {
  const ref = useRef();
  const handle = f=>{ if(f?.type?.startsWith("image/")) onFile(f); };
  return (
    <div onClick={()=>!disabled&&ref.current?.click()}
      onDragOver={e=>e.preventDefault()}
      onDrop={e=>{e.preventDefault();handle(e.dataTransfer.files[0]);}}
      style={{position:"relative",width:"100%",minHeight:220,
        border:"1.5px dashed rgba(0,200,255,0.25)",borderRadius:4,
        background:"rgba(2,4,14,0.8)",cursor:disabled?"not-allowed":"crosshair",overflow:"hidden"}}>
      {preview ? (
        <>
          <img src={preview} alt="preview"
            style={{width:"100%",height:220,objectFit:"contain",display:"block",opacity:0.82}}/>
          <div style={{position:"absolute",left:0,right:0,height:2,
            background:"linear-gradient(90deg,transparent,#00e5ff,transparent)",
            boxShadow:"0 0 12px #00e5ff",
            animation:"scanBeam 2.5s ease-in-out infinite",pointerEvents:"none"}}/>
          <div style={{position:"absolute",inset:0,
            background:"linear-gradient(to top,rgba(0,0,0,0.88) 0%,transparent 50%)",
            display:"flex",alignItems:"flex-end",padding:"12px 16px"}}>
            <HudLabel style={{display:"block"}}>TARGET ACQUIRED — READY TO ANALYZE</HudLabel>
          </div>
        </>
      ) : (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",
          justifyContent:"center",gap:18,padding:40}}>
          <div style={{animation:"floatBob 4s ease-in-out infinite"}}>
            <svg viewBox="0 0 100 100" width="80" height="80">
              <circle cx="50" cy="50" r="40" fill="rgba(0,10,30,0.7)" stroke="rgba(0,200,255,0.3)" strokeWidth="1"/>
              {[[34,38,7],[58,34,5],[44,62,6],[66,60,4],[28,57,4],[60,72,5]].map(([x,y,r],i)=>(
                <g key={i}><circle cx={x} cy={y} r={r} fill="rgba(0,8,25,0.8)" stroke="rgba(0,200,255,0.28)" strokeWidth="0.6"/></g>
              ))}
              <circle cx="50" cy="50" r="3.5" fill="rgba(0,200,255,0.6)" style={{filter:"drop-shadow(0 0 4px #00c8ff)"}}/>
              <line x1="10" y1="50" x2="90" y2="50" stroke="rgba(0,200,255,0.08)" strokeWidth="0.5"/>
              <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(0,200,255,0.08)" strokeWidth="0.5"/>
            </svg>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"var(--f-hud)",fontSize:13,fontWeight:700,
              letterSpacing:"0.25em",color:"#00e5ff",marginBottom:7,
              textShadow:"0 0 18px rgba(0,200,255,0.5)"}}>DROP LUNAR IMAGE HERE</div>
            <HudLabel style={{display:"block",marginBottom:5}}>or click to browse</HudLabel>
            <span style={{fontFamily:"var(--f-mono)",fontSize:9,color:"rgba(0,200,255,0.2)"}}>PNG · JPG · TIFF · WEBP</span>
          </div>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>handle(e.target.files[0])}/>
    </div>
  );
}

// ── History table ─────────────────────────────────────────────────────────────
function HistoryTable({ history }) {
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{borderBottom:"1px solid rgba(0,200,255,0.1)"}}>
            {["File","Craters","Slope","Rough","LSI","Zone"].map(h=>(
              <th key={h} style={{padding:"7px 12px",textAlign:"left",fontFamily:"var(--f-hud)",
                fontSize:8,letterSpacing:"0.22em",color:"rgba(0,200,255,0.3)",
                fontWeight:600,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.slice(0,8).map((r,i)=>{
            const cfg=ZONE_CFG[r.zone];
            return (
              <tr key={r.id}
                style={{borderBottom:"1px solid rgba(0,200,255,0.05)",
                  transition:"background 0.2s",animation:`fadeUp 0.4s ease ${i*30}ms both`}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(0,200,255,0.03)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"8px 12px",fontFamily:"var(--f-mono)",fontSize:9,
                  color:"rgba(0,200,255,0.7)",maxWidth:110,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.filename}</td>
                <td style={{padding:"8px 12px",fontFamily:"var(--f-mono)",fontSize:10,color:"#ff3366",fontWeight:700}}>{r.crater_count}</td>
                <td style={{padding:"8px 12px",fontFamily:"var(--f-mono)",fontSize:10,color:"rgba(200,230,240,0.5)"}}>
                  {r.slope!=null?r.slope.toFixed(1):"—"}</td>
                <td style={{padding:"8px 12px",fontFamily:"var(--f-mono)",fontSize:10,color:"rgba(200,230,240,0.5)"}}>
                  {r.roughness!=null?r.roughness.toFixed(1):"—"}</td>
                <td style={{padding:"8px 12px",fontFamily:"var(--f-mono)",fontSize:11,fontWeight:700,color:cfg?.color}}>
                  {r.lsi.toFixed(1)}</td>
                <td style={{padding:"8px 12px"}}>
                  <span style={{fontFamily:"var(--f-hud)",fontSize:8,letterSpacing:"0.18em",
                    color:cfg?.color,padding:"2px 7px",background:cfg?.dim,
                    border:`1px solid ${cfg?.border}`,borderRadius:2}}>{r.zone}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ onNewResult }) {
  const { phase, progress, stepText, result, annotatedImg,
          history, error, file, preview,
          selectFile, analyze, reset } = useAnalysis();

  const isLoading = phase === PHASES.LOADING;

  const [dashTab, setDashTab] = useDashState("upload"); // upload | stream | camera

  const TABS = [
    { k:"upload", l:"🛸  IMAGE UPLOAD",  sub:"Upload still image" },
    { k:"stream", l:"📡  LIVE STREAM",   sub:"MJPEG from backend" },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* ── Tabs ── */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid rgba(0,200,255,0.1)"}}>
        {TABS.map(({k,l,sub})=>(
          <button key={k} onClick={()=>setDashTab(k)} style={{
            fontFamily:"var(--f-hud)",fontSize:11,fontWeight:700,letterSpacing:"0.18em",
            padding:"12px 28px",background:"transparent",cursor:"pointer",border:"none",
            borderBottom:`2px solid ${dashTab===k?"#00e5ff":"transparent"}`,
            color:dashTab===k?"#00e5ff":"rgba(200,230,240,0.3)",
            transition:"all 0.2s",textTransform:"uppercase"}}>
            {l}
            <div style={{fontFamily:"var(--f-hud)",fontSize:7,letterSpacing:"0.15em",
              color:dashTab===k?"rgba(0,200,255,0.5)":"rgba(200,230,240,0.18)",marginTop:2}}>
              {sub}
            </div>
          </button>
        ))}
      </div>

      {/* ── LIVE STREAM tab — full width ── */}
      {dashTab==="stream" && (
        <LiveStreamPanel/>
      )}

      {/* ── UPLOAD tab ── */}
      {dashTab==="upload" && (
        <>
          {/* ROW 1 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <Panel>
              <div style={{padding:"18px 18px 0"}}>
                <SectionHeader title="Image Analysis Dashboard"
                  subtitle="Upload lunar surface imagery for YOLO detection" icon="🛸"/>
              </div>
              <div style={{padding:"0 18px"}}>
                {(file||annotatedImg) ? (
                  <ScanSection preview={preview} annotatedImg={annotatedImg} isLoading={isLoading}/>
                ) : (
                  <UploadZone preview={preview} onFile={selectFile} disabled={isLoading}/>
                )}
                {isLoading && <LoadingOverlay progress={progress} stepText={stepText}/>}
              </div>
              <div style={{padding:"14px 18px",display:"flex",gap:10,flexWrap:"wrap"}}>
                <button onClick={analyze} disabled={!file||isLoading}
                  style={{flex:1,fontFamily:"var(--f-hud)",fontWeight:700,fontSize:13,
                    letterSpacing:"0.2em",textTransform:"uppercase",
                    background:"transparent",border:"1.5px solid #00e5ff",color:"#00e5ff",
                    padding:"12px 24px",cursor:(!file||isLoading)?"not-allowed":"crosshair",
                    clipPath:"polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)",
                    transition:"color 0.3s",opacity:(!file||isLoading)?0.35:1}}
                  onMouseEnter={e=>{if(file&&!isLoading){e.currentTarget.style.background="#00e5ff";e.currentTarget.style.color="#000";}}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#00e5ff";}}>
                  ▶ {isLoading?"PROCESSING...":"INITIATE ANALYSIS"}
                </button>
                {(result||annotatedImg) && (
                  <button onClick={reset}
                    style={{fontFamily:"var(--f-hud)",fontSize:11,letterSpacing:"0.15em",
                      background:"transparent",border:"1px solid rgba(0,200,255,0.2)",
                      color:"rgba(0,200,255,0.4)",padding:"12px 18px",cursor:"pointer",
                      transition:"color 0.2s",borderRadius:2}}
                    onMouseEnter={e=>e.currentTarget.style.color="#00e5ff"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(0,200,255,0.4)"}>
                    ← NEW SCAN
                  </button>
                )}
              </div>
              {error && (
                <div style={{margin:"0 18px 14px",padding:"10px 14px",
                  background:"rgba(255,51,102,0.08)",border:"1px solid rgba(255,51,102,0.3)",
                  fontFamily:"var(--f-mono)",fontSize:10,color:"#ff3366",borderRadius:2}}>
                  ⚠ {error}
                </div>
              )}
            </Panel>
            <LandingStatusCard result={result}/>
          </div>

          {/* ROW 2 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <CoordinatePanel result={result}/>
            <TelemetryPanel/>
          </div>

          {/* ROW 3 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
            <LSITrendChart history={history}/>
            <TerrainRadarChart result={result}/>
            <TelemetryAreaChart/>
          </div>

          {/* ROW 4 */}
          <Panel>
            <div style={{padding:"18px 18px 0"}}>
              <SectionHeader title="Scan History" subtitle={`${history.length} records stored`} icon="📋"/>
            </div>
            <div style={{padding:"0 0 18px"}}>
              <HistoryTable history={history}/>
            </div>
          </Panel>
        </>
      )}

    </div>
  );
}
