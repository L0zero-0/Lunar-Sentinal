import { useState, useEffect } from "react";

export function AnimNum({ value, dec=0, duration=1100 }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    let s=0; const end=parseFloat(value)||0, step=16, inc=end/(duration/step);
    const t=setInterval(()=>{ s+=inc; if(s>=end){setD(end);clearInterval(t);}else setD(s); },step);
    return ()=>clearInterval(t);
  },[value,duration]);
  return <>{d.toFixed(dec)}</>;
}

export function BlinkDot({ color="#00e5ff", size=8 }) {
  return <span style={{ display:"inline-block",width:size,height:size,borderRadius:"50%",
    background:color,boxShadow:`0 0 8px ${color}`,
    animation:"blink 1.8s ease-in-out infinite",flexShrink:0 }}/>;
}

export function HudLabel({ children, style={} }) {
  return <span style={{ fontFamily:"var(--f-hud)",fontSize:9,letterSpacing:"0.28em",
    textTransform:"uppercase",color:"rgba(0,200,255,0.5)",fontWeight:600,...style }}>
    {children}
  </span>;
}

export function Panel({ children, style={}, glow, onMouseEnter, onMouseLeave }) {
  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{ background:"rgba(6,10,22,0.88)",backdropFilter:"blur(14px)",
        WebkitBackdropFilter:"blur(14px)",border:"1px solid rgba(0,200,255,0.14)",
        borderRadius:4,position:"relative",overflow:"hidden",
        boxShadow:glow||"0 4px 32px rgba(0,0,0,0.5)",
        transition:"box-shadow 0.35s,transform 0.25s",...style }}>
      <span style={{ position:"absolute",top:0,left:0,width:13,height:13,
        borderTop:"1.5px solid rgba(0,200,255,0.4)",borderLeft:"1.5px solid rgba(0,200,255,0.4)",
        pointerEvents:"none" }}/>
      <span style={{ position:"absolute",bottom:0,right:0,width:13,height:13,
        borderBottom:"1.5px solid rgba(0,200,255,0.4)",borderRight:"1.5px solid rgba(0,200,255,0.4)",
        pointerEvents:"none" }}/>
      <span style={{ position:"absolute",inset:0,
        background:"linear-gradient(135deg,rgba(0,200,255,0.025) 0%,transparent 60%)",
        pointerEvents:"none" }}/>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, icon }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:3 }}>
        {icon&&<span style={{ fontSize:14,opacity:0.7 }}>{icon}</span>}
        <span style={{ fontFamily:"var(--f-hud)",fontSize:11,fontWeight:700,
          letterSpacing:"0.28em",color:"rgba(0,200,255,0.9)",textTransform:"uppercase" }}>
          {title}
        </span>
        <div style={{ flex:1,height:1,background:"linear-gradient(90deg,rgba(0,200,255,0.3),transparent)" }}/>
      </div>
      {subtitle&&<span style={{ fontFamily:"var(--f-hud)",fontSize:8,
        letterSpacing:"0.22em",color:"rgba(0,200,255,0.32)",textTransform:"uppercase" }}>
        {subtitle}
      </span>}
    </div>
  );
}

export function ZoneBadge({ zone, cfg, large=false }) {
  if (!cfg) return null;
  return (
    <div style={{ display:"inline-flex",alignItems:"center",gap:8,
      background:cfg.dim,border:`1px solid ${cfg.border}`,
      padding:large?"10px 20px":"4px 12px",borderRadius:2,
      boxShadow:cfg.glow,transition:"box-shadow 0.3s" }}>
      <span style={{ color:cfg.color,fontSize:large?18:12,animation:"blink 2s infinite" }}>{cfg.icon}</span>
      <span style={{ fontFamily:"var(--f-hud)",fontWeight:700,letterSpacing:"0.26em",
        fontSize:large?16:10,color:cfg.color,textShadow:`0 0 18px ${cfg.color}` }}>
        {cfg.label}
      </span>
    </div>
  );
}

export function GlowBar({ value, max=100, color="#00c8ff", height=6, animated=false }) {
  const pct=Math.min((value/max)*100,100);
  return (
    <div style={{ width:"100%",height,borderRadius:height/2,
      background:"rgba(0,0,0,0.5)",border:"1px solid rgba(0,200,255,0.12)",overflow:"hidden" }}>
      <div style={{ height:"100%",width:`${pct}%`,
        background:`linear-gradient(90deg,${color}88,${color})`,
        boxShadow:`0 0 10px ${color}`,borderRadius:height/2,
        transition:"width 0.5s ease",
        animation:animated?"progressGlow 2s ease-in-out infinite":"none" }}/>
    </div>
  );
}

export function LiveClock() {
  const [t,setT]=useState(new Date());
  useEffect(()=>{ const id=setInterval(()=>setT(new Date()),1000); return ()=>clearInterval(id); },[]);
  return <span style={{ fontFamily:"var(--f-mono)",fontSize:10,color:"rgba(0,200,255,0.45)",letterSpacing:"0.1em" }}>
    {t.toUTCString().replace(" GMT","")+" UTC"}
  </span>;
}
