/**
 * LiveStreamPanel.jsx
 * Complete live camera panel with:
 *  - MJPEG stream display (<img src="/video-feed">)
 *  - Camera source switcher (webcam index / IP URL)
 *  - Live stats overlay (crater count, FPS)
 *  - Start / Stop stream controls
 *  - Error display + reconnect
 */
import { useState, useRef } from "react";
import { useLiveStream } from "../hooks/useLiveStream";

// ── Small UI primitives ───────────────────────────────────────────────────────
const HUD = ({ children, style = {} }) => (
  <span style={{ fontFamily:"'Orbitron',monospace", fontSize:8,
    letterSpacing:"0.22em", textTransform:"uppercase",
    color:"rgba(0,200,255,0.5)", ...style }}>{children}</span>
);

const Dot = ({ color = "#00e5ff", size = 7 }) => (
  <span style={{ display:"inline-block", width:size, height:size,
    borderRadius:"50%", background:color,
    boxShadow:`0 0 6px ${color}`, animation:"blink 1.5s infinite",
    flexShrink:0 }}/>
);

function StatChip({ label, value, color = "#00e5ff" }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      padding:"8px 14px", background:"rgba(0,0,0,0.7)",
      border:`1px solid ${color}40`, borderRadius:3, minWidth:70 }}>
      <HUD style={{ marginBottom:4, color:`${color}99` }}>{label}</HUD>
      <span style={{ fontFamily:"'Orbitron',monospace", fontSize:20,
        fontWeight:700, color, textShadow:`0 0 12px ${color}` }}>{value}</span>
    </div>
  );
}

// ── Camera source selector ────────────────────────────────────────────────────
function CameraSelector({ current, onSwitch, switching, disabled, adbLoading, adbStatus, setupAdb }) {
  const [customUrl, setCustomUrl] = useState("");
  const [mode,      setMode]      = useState("local"); // "local" | "wifi" | "usb"
  const [usbPort,   setUsbPort]   = useState("4747");

  const PRESETS = [
    { label:"Webcam (0)",  value:0,  icon:"💻" },
    { label:"USB Cam (1)", value:1,  icon:"🔌" },
    { label:"USB Cam (2)", value:2,  icon:"🔌" },
  ];

  const WIFI_PRESETS = [
    { label:"DroidCam (Standard)",  template:"http://192.168.1.x:4747/video" },
    { label:"DroidCam (MJPEG Feed)", template:"http://192.168.1.x:4747/mjpegfeed" },
    { label:"IP Webcam (Android)",   template:"http://192.168.1.x:8080/video" },
    { label:"RTSP IP Stream",        template:"rtsp://192.168.1.x:554/h264" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12,
      padding:"16px 18px", background:"rgba(4,8,20,0.85)",
      border:"1px solid rgba(0,200,255,0.18)", borderRadius:4,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>

      {/* Header and Mode Selector */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <HUD style={{ fontWeight:700, fontSize:9, color:"#00e5ff" }}>CAMERA CONNECTOR</HUD>
          <span style={{ fontSize:10, opacity:0.6 }}>—</span>
          <span style={{ fontSize:9, fontFamily:"monospace", color:"rgba(200,230,240,0.6)" }}>
            Current: {typeof current === "string" ? current : `Local Index ${current}`}
          </span>
        </div>
        <div style={{ display:"flex", gap:4, background:"rgba(0,0,0,0.4)", padding:2, borderRadius:3 }}>
          {[
            { id: "local", label: "💻 Local / USB" },
            { id: "wifi",  label: "📶 WiFi (Wireless)" },
            { id: "usb",   label: "🔌 USB Cable (ADB)" },
          ].map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)}
              style={{ fontFamily:"'Orbitron',monospace", fontSize:8,
                letterSpacing:"0.12em", padding:"5px 12px", cursor:"pointer",
                background:mode===m.id?"rgba(0,200,255,0.18)":"transparent",
                border:"none",
                color:mode===m.id?"#00e5ff":"rgba(0,200,255,0.4)", borderRadius:2,
                transition:"all 0.2s",
                fontWeight: mode===m.id?700:400,
                textTransform:"uppercase" }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Local Mode */}
      {mode==="local" && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", animation:"fadeIn 0.3s ease" }}>
          {PRESETS.map(p=>(
            <button key={p.value} onClick={()=>onSwitch(p.value)}
              disabled={switching||disabled}
              style={{ display:"flex", alignItems:"center", gap:8,
                fontFamily:"'Orbitron',monospace", fontSize:9,
                letterSpacing:"0.12em", padding:"9px 18px", cursor:"pointer",
                background: current===p.value ? "rgba(0,200,255,0.22)" : "rgba(0,0,0,0.6)",
                border:`1px solid ${current===p.value?"#00e5ff":"rgba(0,200,255,0.15)"}`,
                color: current===p.value ? "#00e5ff" : "rgba(0,200,255,0.55)",
                borderRadius:3, transition:"all 0.15s",
                boxShadow: current===p.value ? "0 0 10px rgba(0,200,255,0.2)" : "none",
                opacity: switching||disabled ? 0.5 : 1 }}
              onMouseEnter={e => { if (current!==p.value) e.currentTarget.style.borderColor = "rgba(0,200,255,0.4)"; }}
              onMouseLeave={e => { if (current!==p.value) e.currentTarget.style.borderColor = "rgba(0,200,255,0.15)"; }}>
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
          <div style={{ width:"100%", fontSize:9, color:"rgba(0,200,255,0.35)", fontFamily:"monospace", marginTop:4 }}>
            💡 Pro-Tip: DirectShow driver integration is active to ensure the lowest physical delay for local virtual cameras.
          </div>
        </div>
      )}

      {/* WiFi Mode */}
      {mode==="wifi" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"fadeIn 0.3s ease" }}>
          <div>
            <HUD style={{ color:"rgba(0,200,255,0.4)", display:"block", marginBottom:4 }}>
              Presets — click to template:
            </HUD>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {WIFI_PRESETS.map(p=>(
                <button key={p.label} onClick={()=>setCustomUrl(p.template)}
                  style={{ fontFamily:"'Orbitron',monospace", fontSize:8,
                    letterSpacing:"0.08em", padding:"5px 10px", cursor:"pointer",
                    background:"rgba(0,0,0,0.5)",
                    border:"1px solid rgba(0,200,255,0.15)",
                    color:"rgba(0,200,255,0.45)", borderRadius:2, transition:"all 0.2s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#00e5ff"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(0,200,255,0.15)"}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={customUrl}
              onChange={e=>setCustomUrl(e.target.value)}
              placeholder="http://<PHONE_IP>:4747/video"
              style={{ flex:1, fontFamily:"var(--f-mono)", fontSize:11,
                padding:"8px 12px", background:"rgba(0,0,0,0.7)",
                border:"1px solid rgba(0,200,255,0.25)",
                color:"#00e5ff", borderRadius:3, outline:"none",
                boxShadow:"inset 0 1px 3px rgba(0,0,0,0.5)" }}/>
            <button
              onClick={()=>{ if(customUrl.trim()) onSwitch(customUrl.trim()); }}
              disabled={!customUrl.trim()||switching}
              style={{ fontFamily:"'Orbitron',monospace", fontSize:9,
                letterSpacing:"0.15em", padding:"8px 20px", cursor:"pointer",
                background:"rgba(0,200,255,0.15)",
                border:"1px solid #00e5ff",
                color:"#00e5ff", borderRadius:3,
                fontWeight:700,
                transition:"all 0.2s",
                boxShadow:"0 0 10px rgba(0,200,255,0.1)",
                opacity:!customUrl.trim()||switching?0.4:1 }}
              onMouseEnter={e => { e.currentTarget.style.background = "#00e5ff"; e.currentTarget.style.color = "#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,200,255,0.15)"; e.currentTarget.style.color = "#00e5ff"; }}>
              {switching?"...":"CONNECT"}
            </button>
          </div>
          <div style={{ fontSize:9, color:"rgba(0,200,255,0.35)", fontFamily:"monospace" }}>
            ⚡ Low-Latency Mode Active: This URL will bypass standard buffering filters, reading raw multipart frames instantly.
          </div>
        </div>
      )}

      {/* USB Cable Mode */}
      {mode==="usb" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10, animation:"fadeIn 0.3s ease" }}>
          
          {/* Instructions Panel */}
          <div style={{ background:"rgba(0,0,0,0.5)", border:"1px solid rgba(0,200,255,0.08)", padding:"10px 14px", borderRadius:3 }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:9, color:"#ffcc00", fontWeight:700, marginBottom:6, letterSpacing:"0.08em" }}>
              🛠 USB CABLE CONNECTION SETUP GUIDE (ULTRA-LOW LATENCY)
            </div>
            <ol style={{ fontSize:10, color:"rgba(200,230,240,0.75)", paddingLeft:14, display:"flex", flexDirection:"column", gap:4, fontFamily:"var(--f-body)" }}>
              <li>Connect your Android phone to the PC using a USB cable.</li>
              <li>Ensure <strong>USB Debugging</strong> is enabled in your phone's Developer Options.</li>
              <li>Open the <strong>DroidCam</strong> app on your mobile device.</li>
              <li>Specify the DroidCam port below and click <strong>Run ADB Port Forward</strong>.</li>
            </ol>
          </div>

          {/* ADB Input and Button Action */}
          <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:4 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <span style={{ fontSize:7, fontFamily:"'Orbitron',monospace", color:"rgba(0,200,255,0.4)", letterSpacing:"0.1em" }}>PORT</span>
              <input
                value={usbPort}
                onChange={e=>setUsbPort(e.target.value.replace(/\D/g,''))}
                placeholder="4747"
                style={{ width:70, fontFamily:"var(--f-mono)", fontSize:11,
                  padding:"7px 10px", background:"rgba(0,0,0,0.7)",
                  border:"1px solid rgba(0,200,255,0.25)",
                  color:"#ffcc00", borderRadius:3, outline:"none", textAlign:"center" }}/>
            </div>

            <button
              onClick={() => setupAdb(parseInt(usbPort) || 4747)}
              disabled={adbLoading}
              style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                fontFamily:"'Orbitron',monospace", fontSize:10, fontWeight:900,
                letterSpacing:"0.15em", padding:"12px 24px", cursor:"pointer",
                background: adbLoading ? "rgba(0,0,0,0.6)" : "linear-gradient(135deg, rgba(255,140,0,0.2) 0%, rgba(0,200,255,0.2) 100%)",
                border:`1.5px solid ${adbLoading?"rgba(0,200,255,0.15)":"#00e5ff"}`,
                color: "#00e5ff", borderRadius:3,
                transition:"all 0.3s",
                boxShadow: adbLoading ? "none" : "0 0 14px rgba(0,229,255,0.15)",
                textTransform:"uppercase",
                marginTop: 10,
                animation: adbLoading ? "none" : "progressGlow 3s infinite" }}
              onMouseEnter={e => { if(!adbLoading) { e.currentTarget.style.background = "#00e5ff"; e.currentTarget.style.color = "#000"; } }}
              onMouseLeave={e => { if(!adbLoading) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,140,0,0.2) 0%, rgba(0,200,255,0.2) 100%)"; e.currentTarget.style.color = "#00e5ff"; } }}>
              {adbLoading ? (
                <>
                  <span style={{ display:"inline-block", width:10, height:10, border:"2px solid #00e5ff", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
                  ESTABLISHING FORWARDING...
                </>
              ) : "⚡ RUN ADB PORT FORWARD ⚡"}
            </button>
          </div>

          {/* ADB Status Badge Display */}
          {adbStatus && (
            <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px",
              background: adbStatus.success ? "rgba(0,255,136,0.06)" : "rgba(255,51,102,0.06)",
              border: `1px solid ${adbStatus.success ? "rgba(0,255,136,0.3)" : "rgba(255,51,102,0.3)"}`,
              borderRadius:3, marginTop:4, transition:"all 0.3s", animation:"fadeIn 0.3s ease" }}>
              <span style={{ fontSize:14 }}>{adbStatus.success ? "✅" : "❌"}</span>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <span style={{ fontFamily:"'Orbitron',monospace", fontSize:8, fontWeight:700,
                  color: adbStatus.success ? "#00ff88" : "#ff3366", letterSpacing:"0.1em" }}>
                  {adbStatus.success ? "PORT FORWARD SUCCESSFUL" : "ADB ERROR ENCOUNTERED"}
                </span>
                <span style={{ fontSize:10, color:"rgba(220,240,255,0.8)", fontFamily:"var(--f-body)", marginTop:2 }}>
                  {adbStatus.message}
                </span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function LiveStreamPanel() {
  const {
    isStreaming, streamError, streamUrl, stats,
    cameraSource, switching, imgRef,
    startStream, stopStream, switchCamera, setStreamError, BACKEND,
    adbLoading, adbStatus, setupAdb,
  } = useLiveStream();

  const craterCount = stats?.crater_count ?? 0;
  const fps         = stats?.fps          ?? 0;
  const camOk       = stats?.camera_ok    ?? false;

  const zoneColor = craterCount === 0 ? "#00ff88"
                  : craterCount < 5   ? "#ffcc00"
                  :                     "#ff3366";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14,
      padding:18, background:"rgba(6,10,22,0.9)",
      border:"1px solid rgba(0,200,255,0.15)", borderRadius:4 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center",
        justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14,
            fontWeight:700, letterSpacing:"0.22em", color:"#00e5ff",
            textShadow:"0 0 18px rgba(0,200,255,0.5)", marginBottom:3 }}>
            LIVE CRATER DETECTION
          </div>
          <HUD>Real-time YOLO inference · multipart/x-mixed-replace stream</HUD>
        </div>

        {/* Start / Stop */}
        <button
          onClick={isStreaming ? stopStream : startStream}
          style={{ fontFamily:"'Orbitron',monospace", fontSize:11,
            fontWeight:700, letterSpacing:"0.18em", padding:"9px 22px",
            cursor:"pointer",
            background: isStreaming ? "rgba(255,51,102,0.12)" : "rgba(0,200,255,0.1)",
            border:`1.5px solid ${isStreaming?"rgba(255,51,102,0.5)":"rgba(0,200,255,0.5)"}`,
            color: isStreaming ? "#ff3366" : "#00e5ff",
            borderRadius:3, transition:"all 0.2s",
            textTransform:"uppercase" }}>
          {isStreaming ? "■ STOP STREAM" : "▶ START STREAM"}
        </button>
      </div>

      {/* Live stats row */}
      {isStreaming && (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <StatChip label="Craters"  value={craterCount} color={zoneColor}/>
          <StatChip label="FPS"      value={fps}         color="#00e5ff"/>
          <div style={{ display:"flex", alignItems:"center", gap:8,
            padding:"8px 14px", background:"rgba(0,0,0,0.6)",
            border:`1px solid ${camOk?"rgba(0,255,136,0.3)":"rgba(255,51,102,0.3)"}`,
            borderRadius:3 }}>
            <Dot color={camOk?"#00ff88":"#ff3366"}/>
            <HUD style={{ color:camOk?"rgba(0,255,136,0.7)":"rgba(255,51,102,0.7)" }}>
              {camOk ? "CAMERA LIVE" : stats?.camera_error ? `NO SIGNAL (${stats.camera_error})` : "NO SIGNAL"}
            </HUD>
          </div>
          {craterCount>0 && (
            <div style={{ padding:"8px 14px", background:"rgba(0,0,0,0.6)",
              border:`1px solid ${zoneColor}40`, borderRadius:3 }}>
              <HUD style={{ color:`${zoneColor}99` }}>ZONE: </HUD>
              <span style={{ fontFamily:"'Orbitron',monospace", fontSize:11,
                fontWeight:700, color:zoneColor, marginLeft:6 }}>
                {craterCount===0?"SAFE":craterCount<5?"RISKY":"UNSAFE"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Video viewport */}
      <div style={{ position:"relative", width:"100%",
        background:"#000", borderRadius:4, overflow:"hidden",
        border:`1px solid ${isStreaming?"rgba(0,200,255,0.3)":"rgba(0,200,255,0.1)"}`,
        minHeight:320 }}>

        {/* MJPEG stream — just an <img> tag */}
        {isStreaming && (
          <img
            ref={imgRef}
            src={streamUrl}
            alt="Live crater detection stream"
            onError={() => setStreamError("Stream connection failed. Is the backend running?")}
            style={{ width:"100%", height:"auto", display:"block",
              maxHeight:"65vh", objectFit:"contain" }}/>
        )}

        {/* Offline state */}
        {!isStreaming && (
          <div style={{ display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            minHeight:320, gap:16 }}>
            <div style={{ fontSize:48, opacity:0.2 }}>📷</div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:12,
              letterSpacing:"0.25em", color:"rgba(0,200,255,0.2)",
              textTransform:"uppercase" }}>
              STREAM OFFLINE
            </div>
            <HUD style={{ color:"rgba(0,200,255,0.2)" }}>
              Click START STREAM to begin
            </HUD>
          </div>
        )}

        {/* Live badge */}
        {isStreaming && (
          <div style={{ position:"absolute", top:10, left:10, zIndex:10,
            display:"flex", alignItems:"center", gap:6,
            background:"rgba(0,0,0,0.82)",
            border:"1px solid rgba(255,51,102,0.5)",
            padding:"4px 10px", borderRadius:2 }}>
            <Dot color="#ff3366" size={7}/>
            <HUD style={{ color:"#ff3366" }}>LIVE</HUD>
          </div>
        )}

        {/* Crater count overlay */}
        {isStreaming && (
          <div style={{ position:"absolute", bottom:10, left:10, zIndex:10,
            background:"rgba(0,0,0,0.82)",
            border:"1px solid rgba(0,200,255,0.3)",
            padding:"5px 12px", borderRadius:2 }}>
            <span style={{ fontFamily:"monospace", fontSize:11, color:"#00e5ff" }}>
              🔍 {craterCount} CRATER{craterCount!==1?"S":""} DETECTED
            </span>
          </div>
        )}
      </div>

      {/* Error display */}
      {streamError && (
        <div style={{ padding:"10px 14px",
          background:"rgba(255,51,102,0.08)",
          border:"1px solid rgba(255,51,102,0.3)",
          borderRadius:3, fontFamily:"monospace",
          fontSize:11, color:"#ff3366" }}>
          ⚠ {streamError}
          <div style={{ fontSize:9, color:"rgba(255,100,100,0.6)", marginTop:4 }}>
            Make sure backend is running: python -m uvicorn main:app --port 8001
          </div>
        </div>
      )}

      {/* Camera source switcher */}
      <CameraSelector
        current={cameraSource}
        onSwitch={switchCamera}
        switching={switching}
        disabled={false}
        adbLoading={adbLoading}
        adbStatus={adbStatus}
        setupAdb={setupAdb}/>

      {/* URL reference */}
      <div style={{ padding:"10px 14px", background:"rgba(0,0,0,0.4)",
        border:"1px solid rgba(0,200,255,0.08)", borderRadius:3 }}>
        <HUD style={{ display:"block", marginBottom:6 }}>Stream URLs</HUD>
        {[
          ["MJPEG Stream",    `${BACKEND}/video-feed`],
          ["Health Check",    `${BACKEND}/health`],
          ["Live Stats",      `${BACKEND}/stats`],
          ["API Docs",        `${BACKEND}/docs`],
        ].map(([label, url])=>(
          <div key={label} style={{ display:"flex", gap:10,
            marginBottom:4, alignItems:"center" }}>
            <HUD style={{ color:"rgba(0,200,255,0.3)", minWidth:90 }}>{label}</HUD>
            <a href={url} target="_blank" rel="noreferrer"
              style={{ fontFamily:"monospace", fontSize:10,
                color:"rgba(0,200,255,0.6)",
                textDecoration:"none" }}
              onMouseEnter={e=>e.target.style.color="#00e5ff"}
              onMouseLeave={e=>e.target.style.color="rgba(0,200,255,0.6)"}>
              {url}
            </a>
          </div>
        ))}
      </div>

    </div>
  );
}
